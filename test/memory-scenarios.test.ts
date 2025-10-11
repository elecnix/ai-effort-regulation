import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { MemoryStorage } from '../src/memory-storage';
import { MemorySubAgent } from '../src/memory-subagent';
import { MemoryCreationRequest } from '../src/memory-types';

const TEST_DB_PATH = path.join(process.cwd(), 'test-memory-scenarios.db');

describe('Memory Feature Scenarios', () => {
  let db: Database.Database;
  let storage: MemoryStorage;
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
      INSERT INTO apps (app_id, name) VALUES ('chat', 'Chat App');
      INSERT INTO apps (app_id, name) VALUES ('email', 'Email App');
      INSERT INTO apps (app_id, name) VALUES ('calendar', 'Calendar App');
    `);
    
    storage = new MemoryStorage(db);
    subAgent = new MemorySubAgent(db, true);
  });

  after(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('Scenario 1: User Preference Memory', () => {
    it('should create memory about user preferences from conversation', async () => {
      const request: MemoryCreationRequest = {
        appId: 'chat',
        conversationId: 'conv-pref-1',
        conversationSummary: 'User shared meeting preferences',
        userMessages: [
          'I prefer to have meetings after 2pm on weekdays',
          'Also, I like to keep Fridays meeting-free if possible'
        ],
        assistantMessages: [
          'I understand you prefer meetings after 2pm on weekdays.',
          'Got it, I\'ll try to keep Fridays clear of meetings for you.'
        ]
      };

      const initialEnergy = subAgent.getEnergyConsumedSinceLastPoll();
      assert.strictEqual(initialEnergy, 0, 'Initial energy should be 0');

      const memory = await subAgent.createMemory(request);
      
      assert.ok(memory, 'Memory should be created');
      assert.ok(memory.content.length > 10, 'Memory content should be substantial');
      assert.strictEqual(memory.appId, 'chat');
      assert.strictEqual(memory.sourceConversationId, 'conv-pref-1');
      
      const energyConsumed = subAgent.getEnergyConsumedSinceLastPoll();
      assert.ok(energyConsumed > 0, 'Energy should be consumed for LLM call');
      console.log(`  ⚡ Energy consumed for memory creation: ${energyConsumed.toFixed(2)} units`);
      
      const secondPoll = subAgent.getEnergyConsumedSinceLastPoll();
      assert.strictEqual(secondPoll, 0, 'Energy should reset after poll');
    });
  });

  describe('Scenario 2: App Isolation', () => {
    it('should keep memories isolated between different apps', async () => {
      const chatRequest: MemoryCreationRequest = {
        appId: 'chat',
        conversationId: 'conv-chat-1',
        conversationSummary: 'Chat conversation',
        userMessages: ['What is the capital of France?'],
        assistantMessages: ['The capital of France is Paris.']
      };

      const emailRequest: MemoryCreationRequest = {
        appId: 'email',
        conversationId: 'conv-email-1',
        conversationSummary: 'Email conversation',
        userMessages: ['Send email to john@example.com'],
        assistantMessages: ['I will send an email to john@example.com.']
      };

      await subAgent.createMemory(chatRequest);
      await subAgent.createMemory(emailRequest);

      const chatMemories = subAgent.getMemories('chat', 10);
      const emailMemories = subAgent.getMemories('email', 10);

      assert.ok(chatMemories.length > 0, 'Chat should have memories');
      assert.ok(emailMemories.length > 0, 'Email should have memories');
      
      const chatHasEmailContent = chatMemories.some(m => 
        m.content.toLowerCase().includes('email') || 
        m.content.toLowerCase().includes('john@example.com')
      );
      
      const emailHasChatContent = emailMemories.some(m => 
        m.content.toLowerCase().includes('france') || 
        m.content.toLowerCase().includes('paris')
      );

      assert.ok(!chatHasEmailContent, 'Chat memories should not contain email content');
      assert.ok(!emailHasChatContent, 'Email memories should not contain chat content');
    });
  });

  describe('Scenario 3: Memory Compaction at Limit', () => {
    it('should compact memories when limit of 10 is exceeded', async () => {
      const appId = 'calendar';
      
      for (let i = 1; i <= 11; i++) {
        const request: MemoryCreationRequest = {
          appId,
          conversationId: `conv-cal-${i}`,
          conversationSummary: `Calendar conversation ${i}`,
          userMessages: [`Schedule meeting ${i}`],
          assistantMessages: [`Meeting ${i} scheduled`]
        };

        console.log(`  Creating memory ${i}/11...`);
        await subAgent.createMemory(request);
        
        const count = subAgent.getMemoryCount(appId);
        console.log(`  Memory count after creation ${i}: ${count}`);
        
        if (i <= 10) {
          assert.strictEqual(count, i, `Should have ${i} memories`);
        } else {
          assert.strictEqual(count, 10, 'Should be compacted back to 10 memories');
        }
      }

      const finalCount = subAgent.getMemoryCount(appId);
      assert.strictEqual(finalCount, 10, 'Final count should be exactly 10');
      
      const memories = subAgent.getMemories(appId, 10);
      assert.strictEqual(memories.length, 10, 'Should retrieve exactly 10 memories');
    });
  });

  describe('Scenario 4: Energy Tracking Accuracy', () => {
    it('should track energy consumption based on actual LLM time', async () => {
      const request: MemoryCreationRequest = {
        appId: 'chat',
        conversationId: 'conv-energy-1',
        conversationSummary: 'Test energy tracking',
        userMessages: ['This is a test message for energy tracking'],
        assistantMessages: ['This is a response for energy tracking']
      };

      subAgent.getEnergyConsumedSinceLastPoll();

      const startTime = Date.now();
      await subAgent.createMemory(request);
      const endTime = Date.now();
      const totalTimeSeconds = (endTime - startTime) / 1000;

      const energyConsumed = subAgent.getEnergyConsumedSinceLastPoll();
      
      assert.ok(energyConsumed > 0, 'Energy should be consumed');
      assert.ok(energyConsumed < totalTimeSeconds * 2, 'Energy should be less than total time * 2 (LLM is subset of total)');
      
      console.log(`  Total time: ${totalTimeSeconds.toFixed(2)}s`);
      console.log(`  Energy consumed: ${energyConsumed.toFixed(2)} units`);
      console.log(`  Implied LLM time: ${(energyConsumed / 2).toFixed(2)}s`);
    });
  });

  describe('Scenario 5: Multiple Memory Creations', () => {
    it('should accumulate energy across multiple memory operations', async () => {
      subAgent.getEnergyConsumedSinceLastPoll();

      const requests: MemoryCreationRequest[] = [
        {
          appId: 'chat',
          conversationId: 'conv-multi-1',
          conversationSummary: 'First conversation',
          userMessages: ['First message'],
          assistantMessages: ['First response']
        },
        {
          appId: 'chat',
          conversationId: 'conv-multi-2',
          conversationSummary: 'Second conversation',
          userMessages: ['Second message'],
          assistantMessages: ['Second response']
        },
        {
          appId: 'chat',
          conversationId: 'conv-multi-3',
          conversationSummary: 'Third conversation',
          userMessages: ['Third message'],
          assistantMessages: ['Third response']
        }
      ];

      for (const request of requests) {
        await subAgent.createMemory(request);
      }

      const totalEnergy = subAgent.getEnergyConsumedSinceLastPoll();
      
      assert.ok(totalEnergy > 0, 'Total energy should be consumed');
      console.log(`  Total energy for 3 memory creations: ${totalEnergy.toFixed(2)} units`);
      console.log(`  Average per memory: ${(totalEnergy / 3).toFixed(2)} units`);
    });
  });

  describe('Scenario 6: Memory Retrieval Performance', () => {
    it('should retrieve memories quickly without consuming energy', async () => {
      const appId = 'chat';
      
      subAgent.getEnergyConsumedSinceLastPoll();

      const startTime = Date.now();
      const memories = subAgent.getMemories(appId, 10);
      const endTime = Date.now();
      const retrievalTime = endTime - startTime;

      const energyConsumed = subAgent.getEnergyConsumedSinceLastPoll();
      
      assert.strictEqual(energyConsumed, 0, 'Memory retrieval should not consume energy');
      assert.ok(retrievalTime < 100, 'Retrieval should be fast (<100ms)');
      assert.ok(memories.length > 0, 'Should retrieve memories');
      
      console.log(`  Retrieved ${memories.length} memories in ${retrievalTime}ms`);
    });
  });

  describe('Scenario 7: Memory Content Quality', () => {
    it('should create concise, informative memories', async () => {
      const request: MemoryCreationRequest = {
        appId: 'chat',
        conversationId: 'conv-quality-1',
        conversationSummary: 'User shared important information',
        userMessages: [
          'My name is Alice and I work at TechCorp as a software engineer',
          'I have been working on AI systems for 5 years',
          'I prefer Python over JavaScript for backend development'
        ],
        assistantMessages: [
          'Nice to meet you, Alice! It\'s great to hear about your work at TechCorp.',
          'That\'s impressive experience in AI systems!',
          'I understand your preference for Python in backend development.'
        ]
      };

      const memory = await subAgent.createMemory(request);
      
      assert.ok(memory, 'Memory should be created');
      assert.ok(memory.content.length >= 20, 'Memory should be substantial (>=20 chars)');
      assert.ok(memory.content.length <= 500, 'Memory should be concise (<=500 chars)');
      
      console.log(`  Memory content (${memory.content.length} chars): ${memory.content}`);
    });
  });

  describe('Scenario 8: Memory Deletion', () => {
    it('should delete specific memory and update count', async () => {
      const appId = 'email';
      const initialCount = subAgent.getMemoryCount(appId);
      
      const memories = subAgent.getMemories(appId, 10);
      assert.ok(memories.length > 0, 'Should have memories to test deletion');
      
      const memoryToDelete = memories[0];
      assert.ok(memoryToDelete, 'Should have a memory to delete');
      
      subAgent.deleteMemory(memoryToDelete.id);
      
      const newCount = subAgent.getMemoryCount(appId);
      assert.strictEqual(newCount, initialCount - 1, 'Count should decrease by 1');
      
      const remainingMemories = subAgent.getMemories(appId, 10);
      const stillExists = remainingMemories.some(m => m.id === memoryToDelete.id);
      assert.ok(!stillExists, 'Deleted memory should not exist');
    });
  });

  describe('Scenario 9: Bulk Memory Deletion', () => {
    it('should delete all memories for an app', async () => {
      const appId = 'chat';
      const initialCount = subAgent.getMemoryCount(appId);
      
      assert.ok(initialCount > 0, 'Should have memories to delete');
      
      const deletedCount = subAgent.deleteAppMemories(appId);
      
      assert.strictEqual(deletedCount, initialCount, 'Should delete all memories');
      
      const finalCount = subAgent.getMemoryCount(appId);
      assert.strictEqual(finalCount, 0, 'Should have no memories after deletion');
    });
  });

  describe('Scenario 10: Memory Ordering', () => {
    it('should return memories in reverse chronological order (most recent first)', async () => {
      const appId = 'email';
      
      subAgent.deleteAppMemories(appId);
      
      const requests: MemoryCreationRequest[] = [
        {
          appId,
          conversationId: 'conv-order-1',
          conversationSummary: 'First',
          userMessages: ['Message 1'],
          assistantMessages: ['Response 1']
        },
        {
          appId,
          conversationId: 'conv-order-2',
          conversationSummary: 'Second',
          userMessages: ['Message 2'],
          assistantMessages: ['Response 2']
        },
        {
          appId,
          conversationId: 'conv-order-3',
          conversationSummary: 'Third',
          userMessages: ['Message 3'],
          assistantMessages: ['Response 3']
        }
      ];

      for (const request of requests) {
        await subAgent.createMemory(request);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const memories = subAgent.getMemories(appId, 10);
      
      assert.ok(memories.length >= 3, 'Should have at least 3 memories');
      
      for (let i = 0; i < memories.length - 1; i++) {
        const currentMem = memories[i];
        const nextMem = memories[i + 1];
        assert.ok(currentMem && nextMem, 'Memories should exist');
        const current = new Date(currentMem.updatedAt).getTime();
        const next = new Date(nextMem.updatedAt).getTime();
        assert.ok(current >= next, 'Memories should be in reverse chronological order');
      }
      
      console.log(`  Verified ${memories.length} memories are in correct order`);
    });
  });
});
