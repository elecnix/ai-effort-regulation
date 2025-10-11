import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { MemoryStorage } from '../src/memory-storage';

const TEST_DB_PATH = path.join(process.cwd(), 'test-memory-storage.db');

describe('MemoryStorage', () => {
  let db: Database.Database;
  let storage: MemoryStorage;

  before(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    db = new Database(TEST_DB_PATH);
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS apps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL
      );
      INSERT INTO apps (app_id, name) VALUES ('test-app', 'Test App');
      INSERT INTO apps (app_id, name) VALUES ('other-app', 'Other App');
    `);
    
    storage = new MemoryStorage(db);
  });

  after(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  it('should create app_memories table', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_memories'").all();
    assert.strictEqual(tables.length, 1, 'app_memories table should exist');
  });

  it('should insert a memory', () => {
    const memory = storage.insertMemory({
      appId: 'test-app',
      content: 'User prefers meetings after 2pm',
      sourceConversationId: 'conv-123',
      metadata: { importance: 8 }
    });

    assert.ok(memory.id, 'Memory should have an ID');
    assert.strictEqual(memory.appId, 'test-app');
    assert.strictEqual(memory.content, 'User prefers meetings after 2pm');
    assert.strictEqual(memory.sourceConversationId, 'conv-123');
    assert.strictEqual(memory.metadata?.importance, 8);
    assert.ok(memory.createdAt instanceof Date);
    assert.ok(memory.updatedAt instanceof Date);
  });

  it('should retrieve memories for an app', () => {
    storage.insertMemory({
      appId: 'test-app',
      content: 'Memory 1',
      sourceConversationId: 'conv-1'
    });
    
    storage.insertMemory({
      appId: 'test-app',
      content: 'Memory 2',
      sourceConversationId: 'conv-2'
    });

    const memories = storage.getMemories('test-app', 10);
    assert.ok(memories.length >= 2, 'Should have at least 2 memories');
    
    const contents = memories.map(m => m.content);
    assert.ok(contents.includes('Memory 1'));
    assert.ok(contents.includes('Memory 2'));
  });

  it('should count memories for an app', () => {
    const count = storage.getMemoryCount('test-app');
    assert.ok(count >= 3, 'Should have at least 3 memories for test-app');
  });

  it('should isolate memories between apps', () => {
    storage.insertMemory({
      appId: 'other-app',
      content: 'Other app memory',
      sourceConversationId: 'conv-other'
    });

    const testAppMemories = storage.getMemories('test-app', 10);
    const otherAppMemories = storage.getMemories('other-app', 10);

    const testContents = testAppMemories.map(m => m.content);
    const otherContents = otherAppMemories.map(m => m.content);

    assert.ok(!testContents.includes('Other app memory'), 'test-app should not see other-app memories');
    assert.ok(otherContents.includes('Other app memory'), 'other-app should see its own memory');
  });

  it('should update a memory', () => {
    const memory = storage.insertMemory({
      appId: 'test-app',
      content: 'Original content',
      sourceConversationId: 'conv-update'
    });

    storage.updateMemory(memory.id, 'Updated content');

    const memories = storage.getMemories('test-app', 100);
    const updated = memories.find(m => m.id === memory.id);
    
    assert.ok(updated, 'Memory should still exist');
    assert.strictEqual(updated?.content, 'Updated content');
  });

  it('should delete a memory', () => {
    const memory = storage.insertMemory({
      appId: 'test-app',
      content: 'To be deleted',
      sourceConversationId: 'conv-delete'
    });

    const countBefore = storage.getMemoryCount('test-app');
    storage.deleteMemory(memory.id);
    const countAfter = storage.getMemoryCount('test-app');

    assert.strictEqual(countAfter, countBefore - 1, 'Memory count should decrease by 1');
  });

  it('should delete all memories for an app', () => {
    db.exec("INSERT OR IGNORE INTO apps (app_id, name) VALUES ('delete-all-app', 'Delete All App')");
    
    storage.insertMemory({
      appId: 'delete-all-app',
      content: 'Memory 1',
      sourceConversationId: 'conv-1'
    });
    
    storage.insertMemory({
      appId: 'delete-all-app',
      content: 'Memory 2',
      sourceConversationId: 'conv-2'
    });

    const countBefore = storage.getMemoryCount('delete-all-app');
    assert.ok(countBefore >= 2, 'Should have at least 2 memories');

    const deletedCount = storage.deleteAppMemories('delete-all-app');
    assert.strictEqual(deletedCount, countBefore, 'Should delete all memories');

    const countAfter = storage.getMemoryCount('delete-all-app');
    assert.strictEqual(countAfter, 0, 'Should have no memories after deletion');
  });

  it('should limit returned memories', () => {
    db.exec("INSERT OR IGNORE INTO apps (app_id, name) VALUES ('limit-test-app', 'Limit Test App')");
    
    for (let i = 0; i < 15; i++) {
      storage.insertMemory({
        appId: 'limit-test-app',
        content: `Memory ${i}`,
        sourceConversationId: `conv-${i}`
      });
    }

    const memories = storage.getMemories('limit-test-app', 10);
    assert.strictEqual(memories.length, 10, 'Should return exactly 10 memories');
  });

  it('should return memories in reverse chronological order (most recent first)', () => {
    const app = 'order-test-app';
    db.exec("INSERT OR IGNORE INTO apps (app_id, name) VALUES ('order-test-app', 'Order Test App')");
    
    const mem1 = storage.insertMemory({
      appId: app,
      content: 'First memory',
      sourceConversationId: 'conv-1'
    });
    
    db.exec(`UPDATE app_memories SET updated_at = datetime('now', '-1 minute') WHERE id = ${mem1.id}`);
    
    const mem2 = storage.insertMemory({
      appId: app,
      content: 'Second memory',
      sourceConversationId: 'conv-2'
    });
    
    const memories = storage.getMemories(app, 10);
    assert.ok(memories.length >= 2);
    
    const first = memories.find(m => m.content === 'First memory');
    const second = memories.find(m => m.content === 'Second memory');
    
    assert.ok(first && second, 'Both memories should be present');
    
    const firstIndex = memories.indexOf(first);
    const secondIndex = memories.indexOf(second);
    
    assert.ok(secondIndex < firstIndex, 'Second memory should come before first (reverse chronological)');
  });
});
