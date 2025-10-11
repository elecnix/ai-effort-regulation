import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { MemoryStorage } from '../src/memory-storage';
import { MemorySubAgent } from '../src/memory-subagent';
import { MockLLMProvider, MockLLMPresets } from '../src/mock-llm';
import { MemoryCreationRequest } from '../src/memory-types';

const TEST_DB_PATH = path.join(process.cwd(), 'test-memory-mocked.db');

describe('Memory Feature - Mocked LLM Tests (Fast)', () => {
  let db: Database.Database;
  let storage: MemoryStorage;
  let subAgent: MemorySubAgent;
  let mockLLM: MockLLMProvider;

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
      INSERT INTO apps (app_id, name) VALUES ('chat', 'Chat App');
      INSERT INTO apps (app_id, name) VALUES ('test-app', 'Test App');
    `);
    
    storage = new MemoryStorage(db);
    subAgent = new MemorySubAgent(db, false);
    
    // Replace the intelligent model with mock
    mockLLM = MockLLMPresets.memory();
    (subAgent as any).intelligentModel = mockLLM;
  });

  after(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('Fast Memory Creation', () => {
    it('should create memory quickly with mocked LLM', async () => {
      const request: MemoryCreationRequest = {
        appId: 'chat',
        conversationId: 'mock-conv-1',
        conversationSummary: 'Test conversation',
        userMessages: ['I prefer dark mode'],
        assistantMessages: ['Got it, I\'ll remember that']
      };

      const startTime = Date.now();
      const memory = await subAgent.createMemory(request);
      const duration = Date.now() - startTime;

      assert.ok(memory, 'Memory should be created');
      assert.ok(duration < 200, `Should be fast (<200ms), was ${duration}ms`);
      assert.strictEqual(memory.appId, 'chat');
      
      console.log(`  ✓ Memory created in ${duration}ms (mocked)`);
    });

    it('should track energy consumption with mocked LLM', async () => {
      subAgent.getEnergyConsumedSinceLastPoll(); // Reset

      const request: MemoryCreationRequest = {
        appId: 'chat',
        conversationId: 'mock-conv-2',
        conversationSummary: 'Energy test',
        userMessages: ['Test message'],
        assistantMessages: ['Test response']
      };

      await subAgent.createMemory(request);
      
      const energy = subAgent.getEnergyConsumedSinceLastPoll();
      assert.ok(energy > 0, 'Should consume energy');
      assert.ok(energy < 1, 'Mocked LLM should consume minimal energy');
      
      console.log(`  ✓ Energy consumed: ${energy.toFixed(3)} units (mocked)`);
    });
  });

  describe('Fast Memory Retrieval', () => {
    it('should retrieve memories without LLM calls', () => {
      const initialCount = mockLLM.getCallCount();
      
      const memories = subAgent.getMemories('chat', 10);
      
      const finalCount = mockLLM.getCallCount();
      
      assert.strictEqual(finalCount, initialCount, 'Retrieval should not call LLM');
      assert.ok(memories.length > 0, 'Should have memories');
      
      console.log(`  ✓ Retrieved ${memories.length} memories without LLM call`);
    });
  });

  describe('Fast Memory Compaction', () => {
    it('should compact memories quickly with mocked LLM', async () => {
      const appId = 'test-app';
      
      // Create 11 memories quickly
      for (let i = 1; i <= 11; i++) {
        await subAgent.createMemory({
          appId,
          conversationId: `mock-compact-${i}`,
          conversationSummary: `Test ${i}`,
          userMessages: [`Message ${i}`],
          assistantMessages: [`Response ${i}`]
        });
      }

      const finalCount = subAgent.getMemoryCount(appId);
      assert.ok(finalCount <= 10, 'Should be compacted to 10 or fewer');
      
      console.log(`  ✓ Compacted to ${finalCount} memories (mocked)`);
    });
  });

  describe('Performance Comparison', () => {
    it('should be significantly faster than real LLM', async () => {
      mockLLM.resetCallCount();
      
      const startTime = Date.now();
      
      // Create 5 memories
      for (let i = 1; i <= 5; i++) {
        await subAgent.createMemory({
          appId: 'chat',
          conversationId: `perf-test-${i}`,
          conversationSummary: `Performance test ${i}`,
          userMessages: [`Test message ${i}`],
          assistantMessages: [`Test response ${i}`]
        });
      }
      
      const duration = Date.now() - startTime;
      const callCount = mockLLM.getCallCount();
      
      assert.ok(duration < 1000, `Should complete in <1s, was ${duration}ms`);
      assert.strictEqual(callCount, 5, 'Should have made 5 LLM calls');
      
      console.log(`  ✓ Created 5 memories in ${duration}ms (avg ${(duration/5).toFixed(0)}ms each)`);
      console.log(`  ✓ Real LLM would take ~15-25 seconds for same operations`);
    });
  });

  describe('Deterministic Behavior', () => {
    it('should produce consistent results with mocked LLM', async () => {
      const results: string[] = [];
      
      for (let i = 0; i < 3; i++) {
        const memory = await subAgent.createMemory({
          appId: 'chat',
          conversationId: `deterministic-${i}`,
          conversationSummary: 'Same input',
          userMessages: ['Same message'],
          assistantMessages: ['Same response']
        });
        
        if (memory) {
          results.push(memory.content);
        }
      }
      
      // All results should be identical with mocked LLM
      assert.strictEqual(results.length, 3, 'Should create 3 memories');
      assert.strictEqual(results[0], results[1], 'Results should be identical');
      assert.strictEqual(results[1], results[2], 'Results should be identical');
      
      console.log(`  ✓ Mocked LLM produces deterministic results`);
    });
  });

  describe('Isolation Testing', () => {
    it('should isolate memories between apps', async () => {
      const app1 = 'chat';
      const app2 = 'test-app';
      
      await subAgent.createMemory({
        appId: app1,
        conversationId: 'iso-1',
        conversationSummary: 'App 1 memory',
        userMessages: ['App 1 message'],
        assistantMessages: ['App 1 response']
      });
      
      await subAgent.createMemory({
        appId: app2,
        conversationId: 'iso-2',
        conversationSummary: 'App 2 memory',
        userMessages: ['App 2 message'],
        assistantMessages: ['App 2 response']
      });
      
      const app1Memories = subAgent.getMemories(app1, 100);
      const app2Memories = subAgent.getMemories(app2, 100);
      
      const app1HasApp2Content = app1Memories.some(m => m.appId === app2);
      const app2HasApp1Content = app2Memories.some(m => m.appId === app1);
      
      assert.ok(!app1HasApp2Content, 'App 1 should not have App 2 memories');
      assert.ok(!app2HasApp1Content, 'App 2 should not have App 1 memories');
      
      console.log(`  ✓ App isolation verified`);
    });
  });

  describe('Bulk Operations', () => {
    it('should handle bulk memory creation efficiently', async () => {
      const appId = 'chat';
      const count = 20;
      
      const startTime = Date.now();
      
      for (let i = 0; i < count; i++) {
        await subAgent.createMemory({
          appId,
          conversationId: `bulk-${i}`,
          conversationSummary: `Bulk test ${i}`,
          userMessages: [`Bulk message ${i}`],
          assistantMessages: [`Bulk response ${i}`]
        });
      }
      
      const duration = Date.now() - startTime;
      const avgTime = duration / count;
      
      assert.ok(avgTime < 100, `Average time should be <100ms, was ${avgTime.toFixed(0)}ms`);
      
      console.log(`  ✓ Created ${count} memories in ${duration}ms (avg ${avgTime.toFixed(0)}ms)`);
    });
  });
});
