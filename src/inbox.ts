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
    modelUsed: string;
  }>;
  metadata: {
    totalEnergyConsumed: number;
    sleepCycles: number;
    energyBudget?: number | null;
    energyBudgetRemaining?: number | null;
    budgetStatus?: 'within' | 'exceeded' | 'depleted';
  };
  ended?: boolean;
  endedReason?: string;
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
  // Remove the confusing dual-storage - just use database queries

  // Prepared statements for better performance
  private getConversationStmt!: Database.Statement;
  private insertConversationStmt!: Database.Statement;
  private updateConversationStmt!: Database.Statement;
  private insertResponseStmt!: Database.Statement;
  private getPendingStmt!: Database.Statement;
  private getUnansweredCountStmt!: Database.Statement;
  private endConversationStmt!: Database.Statement;

  constructor() {
    this.db = new Database(DB_PATH);
    this.initializeDatabase();
    this.prepareStatements();
  }

  // Remove the old open method

  private initializeDatabase() {
    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT UNIQUE NOT NULL,
        input_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_energy_consumed INTEGER DEFAULT 0,
        sleep_cycles INTEGER DEFAULT 0,
        ended BOOLEAN DEFAULT FALSE,
        ended_reason TEXT
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

    // Migration: Add ended_reason column if it doesn't exist
    try {
      this.db.exec(`ALTER TABLE conversations ADD COLUMN ended_reason TEXT`);
    } catch (error) {
      // Column probably already exists, ignore error
    }

    // Migration: Add snooze columns if they don't exist
    try {
      this.db.exec(`ALTER TABLE conversations ADD COLUMN snooze_until DATETIME`);
    } catch (error) {
      // Column probably already exists, ignore error
    }
    try {
      this.db.exec(`ALTER TABLE conversations ADD COLUMN snooze_duration INTEGER DEFAULT 0`);
    } catch (error) {
      // Column probably already exists, ignore error
    }

    // Migration: Add energy budget columns if they don't exist
    try {
      this.db.exec(`ALTER TABLE conversations ADD COLUMN energy_budget REAL DEFAULT NULL`);
    } catch (error) {
      // Column probably already exists, ignore error
    }
  }

  private prepareStatements() {
    this.getConversationStmt = this.db.prepare('SELECT * FROM conversations WHERE request_id = ?');
    this.insertConversationStmt = this.db.prepare(`
      INSERT INTO conversations (request_id, input_message)
      VALUES (?, ?)
    `);
    this.updateConversationStmt = this.db.prepare(`
      UPDATE conversations
      SET sleep_cycles = sleep_cycles + 1,
          total_energy_consumed = total_energy_consumed + ?
      WHERE request_id = ?
    `);
    this.insertResponseStmt = this.db.prepare(`
      INSERT INTO responses (conversation_id, content, energy_level, model_used)
      VALUES (?, ?, ?, ?)
    `);
    // New statements for simplified inbox management
    this.getPendingStmt = this.db.prepare(`
      SELECT c.request_id as id, c.input_message as content, c.created_at as timestamp
      FROM conversations c
      LEFT JOIN responses r ON c.id = r.conversation_id
      WHERE c.input_message IS NOT NULL AND c.input_message != ''
        AND (c.snooze_until IS NULL OR c.snooze_until < datetime('now'))
      GROUP BY c.id, c.request_id, c.input_message, c.created_at
      HAVING COUNT(r.id) = 0
      ORDER BY c.created_at ASC
    `);
    this.getUnansweredCountStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM (
        SELECT c.id
        FROM conversations c
        LEFT JOIN responses r ON c.id = r.conversation_id
        WHERE c.input_message IS NOT NULL AND c.input_message != ''
          AND (c.snooze_until IS NULL OR c.snooze_until < datetime('now'))
        GROUP BY c.id
        HAVING COUNT(r.id) = 0
      )
    `);
    this.endConversationStmt = this.db.prepare(`
      UPDATE conversations SET ended = TRUE WHERE request_id = ?
    `);
  }

  open() {
    // No longer need to load pending messages into memory
    console.log(`📬 Inbox initialized`);
  }

  // Remove the confusing loadPendingMessages method

  // Add a new message to the inbox (called when a message is received)
  addMessage(message: Message) {
    // Messages are stored directly in database by server.ts, no in-memory management needed
    console.log(`📬 Message ${message.id} stored in database`);
  }

  // Get all pending messages - now queries database
  getPendingMessages(): Message[] {
    try {
      const rows = this.getPendingStmt.all() as { id: string; content: string; timestamp: string }[];
      return rows.map(row => ({
        id: row.id,
        content: row.content,
        timestamp: new Date(row.timestamp)
      }));
    } catch (error) {
      console.error('Error getting pending messages:', error);
      return [];
    }
  }

  // Remove a message from pending (called when it's answered) - now marks as answered in DB
  removeMessage(messageId: string) {
    // Since we use database queries, removal happens automatically when responses are added
    console.log(`📬 Message ${messageId} marked as answered in database`);
  }

  // Get recent messages (for context/history) - now queries database
  getRecentMessages(limit: number = 10): Message[] {
    return this.getPendingMessages().slice(0, limit);
  }

  // Check if inbox is empty - now queries database
  isEmpty(): boolean {
    const pending = this.getPendingMessages();
    return pending.length === 0;
  }

  // Save a conversation response
  addResponse(requestId: string, userMessage: string, response: string, energyLevel: number, modelUsed: string, energyBudget?: number | null) {
    try {
      // Get or create conversation
      let conversation = this.getConversationStmt.get(requestId) as any;

      if (!conversation) {
        // Create new conversation with optional budget
        if (energyBudget !== undefined && energyBudget !== null) {
          const insertWithBudgetStmt = this.db.prepare(`
            INSERT INTO conversations (request_id, input_message, energy_budget)
            VALUES (?, ?, ?)
          `);
          const insertResult = insertWithBudgetStmt.run(requestId, userMessage, energyBudget);
          conversation = {
            id: insertResult.lastInsertRowid,
            request_id: requestId
          };
        } else {
          const insertResult = this.insertConversationStmt.run(requestId, userMessage);
          conversation = {
            id: insertResult.lastInsertRowid,
            request_id: requestId
          };
        }
      } else if (userMessage) {
        // Update the input message if provided and different
        this.db.prepare('UPDATE conversations SET input_message = ? WHERE id = ?').run(userMessage, conversation.id);
      }

      // Add response only if provided
      if (response) {
        this.insertResponseStmt.run(conversation.id, response, energyLevel, modelUsed);
      }

      // Update metadata
      this.updateConversationStmt.run(energyLevel, requestId);

      // Log only on errors, not successful saves
      // console.log(`💾 Saved response for ${requestId}`);

    } catch (error) {
      console.error('Error saving response to database:', error);
    }
  }

  // Set energy budget for a conversation
  setEnergyBudget(requestId: string, budget: number): void {
    try {
      const stmt = this.db.prepare(`
        UPDATE conversations
        SET energy_budget = ?
        WHERE request_id = ?
      `);
      stmt.run(budget, requestId);
    } catch (error) {
      console.error('Error setting energy budget:', error);
    }
  }

  // Get remaining budget for a conversation
  getRemainingBudget(requestId: string): number | null {
    try {
      const conversation = this.getConversationStmt.get(requestId) as any;
      if (!conversation || conversation.energy_budget === null) {
        return null;
      }
      return conversation.energy_budget - conversation.total_energy_consumed;
    } catch (error) {
      console.error('Error getting remaining budget:', error);
      return null;
    }
  }

  // Get budget status for a conversation
  getBudgetStatus(requestId: string): 'within' | 'exceeded' | 'depleted' | null {
    try {
      const conversation = this.getConversationStmt.get(requestId) as any;
      if (!conversation || conversation.energy_budget === null) {
        return null;
      }
      
      const remaining = conversation.energy_budget - conversation.total_energy_consumed;
      
      if (conversation.energy_budget === 0) {
        return 'depleted';
      } else if (remaining <= 0) {
        return 'exceeded';
      } else {
        return 'within';
      }
    } catch (error) {
      console.error('Error getting budget status:', error);
      return null;
    }
  }

  // Add energy consumption to a conversation without adding a response
  addEnergyConsumption(requestId: string, energyConsumed: number) {
    try {
      this.updateConversationStmt.run(energyConsumed, requestId);
    } catch (error) {
      console.error('Error updating energy consumption:', error);
    }
  }

  // Mark a conversation as ended (won't be reviewed anymore)
  endConversation(requestId: string, reason?: string) {
    try {
      const stmt = this.db.prepare(`
        UPDATE conversations
        SET ended = TRUE, ended_reason = ?
        WHERE request_id = ?
      `);
      const result = stmt.run(reason || null, requestId);
      if (result.changes > 0) {
        console.log(`✔️ Ended conversation ${requestId}: ${reason ? `: ${reason}` : ''}`);
      } else {
        console.log(`🏁 Conversation ${requestId} not found or already ended`);
      }
    } catch (error) {
      console.error('Error ending conversation:', error);
    }
  }

  // Snooze a conversation for a specified number of minutes
  snoozeConversation(requestId: string, minutes: number): Date {
    // Defensive: validate minutes parameter
    const safeMinutes = isNaN(minutes) || minutes === null || minutes === undefined || minutes < 0 ? 5 : minutes;
    
    const snoozeUntil = new Date();
    snoozeUntil.setMinutes(snoozeUntil.getMinutes() + safeMinutes);

    const stmt = this.db.prepare(`
      UPDATE conversations
      SET snooze_until = datetime(?), snooze_duration = ?
      WHERE request_id = ?
    `);
    const result = stmt.run(snoozeUntil.toISOString(), safeMinutes, requestId);
    if (result.changes > 0) {
      console.log(`😴 Snoozed conversation ${requestId} for ${safeMinutes} minutes (until ${snoozeUntil.toISOString()})`);
      return snoozeUntil;
    } else {
      throw new Error(`😴 Conversation ${requestId} not found`);
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

      // Calculate budget information if budget exists
      let budgetInfo: {
        energyBudget?: number | null;
        energyBudgetRemaining?: number | null;
        budgetStatus?: 'within' | 'exceeded' | 'depleted';
      } = {};

      if (conversation.energy_budget !== null && conversation.energy_budget !== undefined) {
        const remaining = conversation.energy_budget - conversation.total_energy_consumed;
        budgetInfo.energyBudget = conversation.energy_budget;
        budgetInfo.energyBudgetRemaining = remaining;
        
        if (conversation.energy_budget === 0) {
          budgetInfo.budgetStatus = 'depleted';
        } else if (remaining <= 0) {
          budgetInfo.budgetStatus = 'exceeded';
        } else {
          budgetInfo.budgetStatus = 'within';
        }
      }

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
          sleepCycles: conversation.sleep_cycles,
          ...budgetInfo
        },
        ended: conversation.ended,
        endedReason: conversation.ended_reason
      };
    } catch (error) {
      console.error('Error retrieving conversation:', error);
      return null;
    }
  }

  // Get recent conversations (for LLM context)
  getRecentConversations(limit: number = 5): Array<{ id: string; requestMessage: string; responseMessages: string[]; timestamp: Date; snoozeInfo?: string }> {
    try {
      const stmt = this.db.prepare(`
        SELECT c.request_id, c.input_message, c.created_at, c.snooze_until
        FROM conversations c
        LEFT JOIN responses r ON c.id = r.conversation_id
        WHERE (c.snooze_until IS NULL OR c.snooze_until < datetime('now'))
        GROUP BY c.id, c.request_id, c.input_message, c.created_at, c.snooze_until
        ORDER BY c.created_at DESC
        LIMIT ?
      `);

      const rows = stmt.all(limit) as { request_id: string; input_message: string; created_at: string; snooze_until: string | null }[];
      const conversations: Array<{ id: string; requestMessage: string; responseMessages: string[]; timestamp: Date; snoozeInfo?: string }> = [];

      for (const row of rows) {
        // Get responses for this conversation
        const conversation = this.getConversationStmt.get(row.request_id) as any;
        if (conversation) {
          const responsesStmt = this.db.prepare('SELECT content FROM responses WHERE conversation_id = ? ORDER BY timestamp ASC');
          const responseRows = responsesStmt.all(conversation.id) as { content: string }[];
          const responseMessages = responseRows.map(r => r.content);

          const conversationData: { id: string; requestMessage: string; responseMessages: string[]; timestamp: Date; snoozeInfo?: string } = {
            id: row.request_id,
            requestMessage: row.input_message || '',
            responseMessages: responseMessages,
            timestamp: new Date(row.created_at)
          };

          if (row.snooze_until) {
            conversationData.snoozeInfo = `Previously snoozed until: ${row.snooze_until}`;
          }

          conversations.push(conversationData);
        }
      }

      return conversations;
    } catch (error) {
      console.error('Error getting recent conversations:', error);
      return [];
    }
  }

  // Get recent completed conversations (those with at least one response, not ended)
  getRecentCompletedConversations(limit: number = 5): ConversationData[] {
    try {
      const stmt = this.db.prepare(`
        SELECT c.request_id
        FROM conversations c
        INNER JOIN responses r ON c.id = r.conversation_id
        WHERE c.ended = FALSE
          AND (c.snooze_until IS NULL OR c.snooze_until < datetime('now'))
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

  // Get conversation statistics (for /stats endpoint)
  getConversationStats(): ConversationStats {
    try {
      // Total conversations
      const totalConversationsStmt = this.db.prepare('SELECT COUNT(*) as count FROM conversations');
      const totalConversationsResult = totalConversationsStmt.get() as { count: number } | undefined;
      const totalConversations = totalConversationsResult?.count ?? 0;

      // Total responses
      const totalResponsesStmt = this.db.prepare('SELECT COUNT(*) as count FROM responses');
      const totalResponsesResult = totalResponsesStmt.get() as { count: number } | undefined;
      const totalResponses = totalResponsesResult?.count ?? 0;

      // Average energy level
      const avgEnergyStmt = this.db.prepare('SELECT AVG(energy_level) as avg FROM responses');
      const avgEnergyResult = avgEnergyStmt.get() as { avg: number | null } | undefined;
      const avgEnergy = avgEnergyResult?.avg ?? null;

      // Urgent responses (energy level < 0)
      const urgentResponsesStmt = this.db.prepare('SELECT COUNT(*) as count FROM responses WHERE energy_level < 0');
      const urgentResponsesResult = urgentResponsesStmt.get() as { count: number | null } | undefined;
      const urgentResponses = urgentResponsesResult?.count ?? null;

      return {
        total_conversations: totalConversations,
        total_responses: totalResponses,
        avg_energy_level: avgEnergy,
        urgent_responses: urgentResponses
      };
    } catch (error) {
      console.error('Error getting conversation stats:', error);
      return {
        total_conversations: 0,
        total_responses: 0,
        avg_energy_level: null,
        urgent_responses: null
      };
    }
  }

  getDatabase(): Database.Database {
    return this.db;
  }
}
