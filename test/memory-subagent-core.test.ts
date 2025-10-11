import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { MemorySubAgent } from '../src/memory-subagent';

const TEST_DB_PATH = path.join(process.cwd(), 'test-memory-subagent-core.db');

describe('MemorySubAgent Core', () => {
  let db: Database.Database;
  let subAgent: MemorySubAgent;

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
    `);
    
    subAgent = new MemorySubAgent(db, false);
  });

  after(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  it('should initialize correctly', () => {
    assert.ok(subAgent, 'Sub-agent should be created');
  });

  it('should track energy consumption', () => {
    const initialEnergy = subAgent.getEnergyConsumedSinceLastPoll();
    assert.strictEqual(initialEnergy, 0, 'Initial energy should be 0');
    
    const secondPoll = subAgent.getEnergyConsumedSinceLastPoll();
    assert.strictEqual(secondPoll, 0, 'Energy should reset after poll');
  });

  it('should retrieve memories for an app', () => {
    const memories = subAgent.getMemories('test-app', 10);
    assert.ok(Array.isArray(memories), 'Should return an array');
  });

  it('should count memories for an app', () => {
    const count = subAgent.getMemoryCount('test-app');
    assert.strictEqual(typeof count, 'number', 'Should return a number');
    assert.ok(count >= 0, 'Count should be non-negative');
  });

  it('should delete all memories for an app', () => {
    const deletedCount = subAgent.deleteAppMemories('test-app');
    assert.strictEqual(typeof deletedCount, 'number', 'Should return a number');
    assert.ok(deletedCount >= 0, 'Deleted count should be non-negative');
  });
});
