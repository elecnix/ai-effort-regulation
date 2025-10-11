import Database from 'better-sqlite3';
import { AppMemory } from './memory-types';

export class MemoryStorage {
  private db: Database.Database;
  private insertMemoryStmt!: Database.Statement;
  private getMemoriesStmt!: Database.Statement;
  private getMemoryCountStmt!: Database.Statement;
  private updateMemoryStmt!: Database.Statement;
  private deleteMemoryStmt!: Database.Statement;
  private deleteAppMemoriesStmt!: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.initializeSchema();
    this.prepareStatements();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        source_conversation_id TEXT,
        metadata TEXT,
        
        FOREIGN KEY (app_id) REFERENCES apps(app_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_app_memories_app_id ON app_memories(app_id);
      CREATE INDEX IF NOT EXISTS idx_app_memories_created_at ON app_memories(created_at);
      CREATE INDEX IF NOT EXISTS idx_app_memories_updated_at ON app_memories(updated_at);
    `);
  }

  private prepareStatements(): void {
    this.insertMemoryStmt = this.db.prepare(`
      INSERT INTO app_memories (app_id, content, source_conversation_id, metadata)
      VALUES (?, ?, ?, ?)
    `);

    this.getMemoriesStmt = this.db.prepare(`
      SELECT * FROM app_memories
      WHERE app_id = ?
      ORDER BY updated_at DESC
      LIMIT ?
    `);

    this.getMemoryCountStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM app_memories
      WHERE app_id = ?
    `);

    this.updateMemoryStmt = this.db.prepare(`
      UPDATE app_memories
      SET content = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    this.deleteMemoryStmt = this.db.prepare(`
      DELETE FROM app_memories WHERE id = ?
    `);

    this.deleteAppMemoriesStmt = this.db.prepare(`
      DELETE FROM app_memories WHERE app_id = ?
    `);
  }

  insertMemory(memory: Omit<AppMemory, 'id' | 'createdAt' | 'updatedAt'>): AppMemory {
    const metadataJson = memory.metadata ? JSON.stringify(memory.metadata) : null;
    
    const result = this.insertMemoryStmt.run(
      memory.appId,
      memory.content,
      memory.sourceConversationId || null,
      metadataJson
    );

    const row: any = this.db.prepare('SELECT * FROM app_memories WHERE id = ?').get(result.lastInsertRowid);
    
    return this.rowToMemory(row);
  }

  getMemories(appId: string, limit: number = 10): AppMemory[] {
    const rows: any[] = this.getMemoriesStmt.all(appId, limit);
    return rows.map(row => this.rowToMemory(row));
  }

  getMemoryCount(appId: string): number {
    const result: any = this.getMemoryCountStmt.get(appId);
    return result.count;
  }

  updateMemory(id: number, content: string): void {
    this.updateMemoryStmt.run(content, id);
  }

  deleteMemory(id: number): void {
    this.deleteMemoryStmt.run(id);
  }

  deleteAppMemories(appId: string): number {
    const result = this.deleteAppMemoriesStmt.run(appId);
    return result.changes;
  }

  private rowToMemory(row: any): AppMemory {
    return {
      id: row.id,
      appId: row.app_id,
      content: row.content,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      sourceConversationId: row.source_conversation_id,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }
}
