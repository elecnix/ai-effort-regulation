import Database from 'better-sqlite3';
import * as path from 'path';

export interface Message {
  id: string;
  content: string;
  timestamp: Date;
}

export interface ConversationData {
  requestId: string;
  inputMessage: string;
  responses: Array<{
    timestamp: string;
    content: string;
    energyLevel: number;
    modelUsed: string;
  }>;
  metadata: {
    totalEnergyConsumed: number;
    sleepCycles: number;
  };
}

export interface ConversationStats {
  total_conversations: number;
  total_responses: number;
  avg_energy_level: number | null;
  urgent_responses: number | null;
}

const DB_PATH = path.join(process.cwd(), 'conversations.db');

export class Inbox {
  private db: Database.Database;
  private pendingMessages: Message[] = [];
  private readonly MAX_PENDING = 50; // Limit pending messages to prevent memory issues

  // Prepared statements for better performance
  private getConversationStmt!: Database.Statement;
  private insertConversationStmt!: Database.Statement;
  private updateConversationStmt!: Database.Statement;
  private insertResponseStmt!: Database.Statement;

  constructor() {
    this.db = new Database(DB_PATH);
    this.initializeDatabase();
    this.prepareStatements();
  }

  open() {
    this.loadPendingMessages();
  }

  private initializeDatabase() {
    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT UNIQUE NOT NULL,
        input_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_energy_consumed INTEGER DEFAULT 0,
        sleep_cycles INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        content TEXT NOT NULL,
        energy_level INTEGER NOT NULL,
        model_used TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations (id)
      );

      CREATE INDEX IF NOT EXISTS idx_conversation_request_id ON conversations (request_id);
      CREATE INDEX IF NOT EXISTS idx_response_conversation_id ON responses (conversation_id);
    `);
  }

  private prepareStatements() {
    this.getConversationStmt = this.db.prepare('SELECT * FROM conversations WHERE request_id = ?');
    this.insertConversationStmt = this.db.prepare(`
      INSERT INTO conversations (request_id, input_message)
      VALUES (?, ?)
    `);
    this.updateConversationStmt = this.db.prepare(`
      UPDATE conversations
      SET sleep_cycles = sleep_cycles + 1
      WHERE request_id = ?
    `);
    this.insertResponseStmt = this.db.prepare(`
      INSERT INTO responses (conversation_id, content, energy_level, model_used)
      VALUES (?, ?, ?, ?)
    `);
  }

  private loadPendingMessages() {
    try {
      // Get conversations that have input messages but no responses
      const stmt = this.db.prepare(`
        SELECT c.request_id, c.input_message, c.created_at
        FROM conversations c
        LEFT JOIN responses r ON c.id = r.conversation_id
        WHERE c.input_message IS NOT NULL AND c.input_message != ''
        GROUP BY c.id, c.request_id, c.input_message, c.created_at
        HAVING COUNT(r.id) = 0
        ORDER BY c.created_at DESC
        LIMIT ?
      `);
      const rows = stmt.all(this.MAX_PENDING) as { request_id: string; input_message: string; created_at: string }[];
      this.pendingMessages = rows.map(row => ({
        id: row.request_id,
        content: row.input_message,
        timestamp: new Date(row.created_at)
      }));
      console.log(`📬 Inbox loaded ${this.pendingMessages.length} pending messages`);
    } catch (error) {
      console.error('Error loading pending messages to inbox:', error);
    }
  }

  // Add a new message to the inbox (called when a message is received)
  addMessage(message: Message) {
    // Check if message already exists (avoid duplicates)
    if (!this.pendingMessages.find(m => m.id === message.id)) {
      this.pendingMessages.unshift(message); // Add to front for priority
      // Keep only the most recent messages
      if (this.pendingMessages.length > this.MAX_PENDING) {
        this.pendingMessages = this.pendingMessages.slice(0, this.MAX_PENDING);
      }
      console.log(`📬 Added message ${message.id} to inbox`);
    }
  }

  // Get pending message IDs (for the LLM prompt)
  getPendingMessageIds(limit: number = 5): string[] {
    return this.pendingMessages.slice(0, limit).map(msg => msg.id);
  }

  // Get all pending messages
  getPendingMessages(): Message[] {
    return [...this.pendingMessages];
  }

  // Remove a message from pending (called when it's answered)
  removeMessage(messageId: string) {
    const initialLength = this.pendingMessages.length;
    this.pendingMessages = this.pendingMessages.filter(msg => msg.id !== messageId);
    if (this.pendingMessages.length < initialLength) {
      console.log(`📬 Removed message ${messageId} from inbox`);
    } else {
      console.log(`⚠️ Message ${messageId} not found in inbox`);
    }
  }

  // Get recent messages (for context/history)
  getRecentMessages(limit: number = 10): Message[] {
    return this.pendingMessages.slice(0, limit);
  }

  // Check if inbox is empty
  isEmpty(): boolean {
    return this.pendingMessages.length === 0;
  }

  // Get inbox stats
  getStats() {
    const hasMessages = this.pendingMessages.length > 0;
    return {
      pendingCount: this.pendingMessages.length,
      oldestMessage: hasMessages ? this.pendingMessages[this.pendingMessages.length - 1]!.timestamp : null,
      newestMessage: hasMessages ? this.pendingMessages[0]!.timestamp : null
    };
  }

  // Save a conversation response
  addResponse(requestId: string, userMessage: string, response: string, energyLevel: number, modelUsed: string) {
    try {
      // Get or create conversation
      let conversation = this.getConversationStmt.get(requestId) as any;

      if (!conversation) {
        // Create new conversation
        const insertResult = this.insertConversationStmt.run(requestId, userMessage);
        conversation = {
          id: insertResult.lastInsertRowid,
          request_id: requestId
        };
      } else if (userMessage) {
        // Update the input message if provided and different
        this.db.prepare('UPDATE conversations SET input_message = ? WHERE id = ?').run(userMessage, conversation.id);
      }

      // Add response only if provided
      if (response) {
        this.insertResponseStmt.run(conversation.id, response, energyLevel, modelUsed);
      }

      // Update metadata
      this.updateConversationStmt.run(requestId);

      // Log only on errors, not successful saves
      // console.log(`💾 Saved response for ${requestId}`);

    } catch (error) {
      console.error('Error saving response to database:', error);
    }
  }

  // Get conversation data
  getConversation(requestId: string): ConversationData | null {
    try {
      const conversation = this.getConversationStmt.get(requestId) as any;

      if (!conversation) return null;

      // Get all responses for this conversation
      const responsesStmt = this.db.prepare('SELECT * FROM responses WHERE conversation_id = ? ORDER BY timestamp ASC');
      const responses = responsesStmt.all(conversation.id);

      return {
        requestId: conversation.request_id,
        inputMessage: conversation.input_message,
        responses: responses.map((r: any) => ({
          timestamp: r.timestamp,
          content: r.content,
          energyLevel: r.energy_level,
          modelUsed: r.model_used
        })),
        metadata: {
          totalEnergyConsumed: conversation.total_energy_consumed,
          sleepCycles: conversation.sleep_cycles
        }
      };
    } catch (error) {
      console.error('Error retrieving conversation:', error);
      return null;
    }
  }

  // Get conversation statistics
  getConversationStats(): ConversationStats | null {
    try {
      const statsStmt = this.db.prepare(`
        SELECT
          COUNT(DISTINCT c.id) as total_conversations,
          COUNT(r.id) as total_responses,
          AVG(r.energy_level) as avg_energy_level,
          SUM(CASE WHEN r.energy_level < 0 THEN 1 ELSE 0 END) as urgent_responses
        FROM conversations c
        LEFT JOIN responses r ON c.id = r.conversation_id
      `);

      const result = statsStmt.get() as any;
      return result || null;
    } catch (error) {
      console.error('Error getting conversation stats:', error);
      return null;
    }
  }

  // Get recent conversation IDs for reflection
  getRecentConversationIds(limit: number = 10): string[] {
    try {
      const stmt = this.db.prepare(`
        SELECT request_id
        FROM conversations
        ORDER BY created_at DESC
        LIMIT ?
      `);

      const rows = stmt.all(limit) as { request_id: string }[];
      return rows.map(row => row.request_id);
    } catch (error) {
      console.error('Error getting recent conversation IDs:', error);
      return [];
    }
  }

  // Get recent completed conversations (those with at least one response)
  getRecentCompletedConversations(limit: number = 5): ConversationData[] {
    try {
      const stmt = this.db.prepare(`
        SELECT c.request_id
        FROM conversations c
        INNER JOIN responses r ON c.id = r.conversation_id
        GROUP BY c.id, c.request_id
        HAVING COUNT(r.id) > 0
        ORDER BY c.created_at DESC
        LIMIT ?
      `);

      const rows = stmt.all(limit) as { request_id: string }[];
      const conversations: ConversationData[] = [];
      for (const row of rows) {
        const conv = this.getConversation(row.request_id);
        if (conv) {
          conversations.push(conv);
        }
      }
      return conversations;
    } catch (error) {
      console.error('Error getting recent completed conversations:', error);
      return [];
    }
  }
}
