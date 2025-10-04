import Database from 'better-sqlite3';
import * as path from 'path';

const DB_PATH = path.join(process.cwd(), 'conversations.db');

// Initialize database
const db = new Database(DB_PATH);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT UNIQUE NOT NULL,
    input_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_energy_consumed INTEGER DEFAULT 0,
    sleep_cycles INTEGER DEFAULT 0,
    model_switches INTEGER DEFAULT 0
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

// Prepared statements for better performance
const getConversationStmt = db.prepare('SELECT * FROM conversations WHERE request_id = ?');
const insertConversationStmt = db.prepare(`
  INSERT INTO conversations (request_id, input_message)
  VALUES (?, ?)
`);
const updateConversationStmt = db.prepare(`
  UPDATE conversations
  SET model_switches = ?
  WHERE request_id = ?
`);
const insertResponseStmt = db.prepare(`
  INSERT INTO responses (conversation_id, content, energy_level, model_used)
  VALUES (?, ?, ?, ?)
`);

export function respond(requestId: string, userMessage: string, response: string, energyLevel: number, modelUsed: string, modelSwitches: number) {
  try {
    // Get or create conversation
    let conversation = getConversationStmt.get(requestId) as any;

    if (!conversation) {
      // Create new conversation
      const insertResult = insertConversationStmt.run(requestId, userMessage);
      conversation = {
        id: insertResult.lastInsertRowid,
        request_id: requestId
      };
    } else if (userMessage) {
      // Update the input message if provided and different
      db.prepare('UPDATE conversations SET input_message = ? WHERE id = ?').run(userMessage, conversation.id);
    }

    // Add response only if provided
    if (response) {
      insertResponseStmt.run(conversation.id, response, energyLevel, modelUsed);
    }

    // Update metadata
    updateConversationStmt.run(modelSwitches, requestId);

    // Log only on errors, not successful saves
    // console.log(`💾 Saved response for ${requestId}`);

  } catch (error) {
    console.error('Error saving response to database:', error);
  }
}

// Add function to retrieve conversations for analysis
export function getConversation(requestId: string) {
  try {
    const conversation = getConversationStmt.get(requestId) as any;

    if (!conversation) return null;

    // Get all responses for this conversation
    const responsesStmt = db.prepare('SELECT * FROM responses WHERE conversation_id = ? ORDER BY timestamp ASC');
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
        sleepCycles: conversation.sleep_cycles,
        modelSwitches: conversation.model_switches
      }
    };
  } catch (error) {
    console.error('Error retrieving conversation:', error);
    return null;
  }
}

// Add function to get conversation statistics
export function getConversationStats() {
  try {
    const statsStmt = db.prepare(`
      SELECT
        COUNT(DISTINCT c.id) as total_conversations,
        COUNT(r.id) as total_responses,
        AVG(r.energy_level) as avg_energy_level,
        SUM(CASE WHEN r.energy_level < 0 THEN 1 ELSE 0 END) as urgent_responses
      FROM conversations c
      LEFT JOIN responses r ON c.id = r.conversation_id
    `);

    return statsStmt.get();
  } catch (error) {
    console.error('Error getting conversation stats:', error);
    return null;
  }
}

// Add function to get recent conversation IDs for reflection
export function getRecentConversationIds(limit: number = 10): string[] {
  try {
    const stmt = db.prepare(`
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
