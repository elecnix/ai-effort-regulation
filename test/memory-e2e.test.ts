import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { AppRegistry } from '../src/apps/registry';
import { MemorySubAgent } from '../src/memory-subagent';
import { MemoryCreationRequest } from '../src/memory-types';

const TEST_DB_PATH = path.join(process.cwd(), 'test-memory-e2e.db');

describe('Memory Feature - End-to-End Realistic Tests', () => {
  let db: Database.Database;
  let appRegistry: AppRegistry;
  let memorySubAgent: MemorySubAgent;

  before(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    
    db = new Database(TEST_DB_PATH);
    
    // Create required tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS apps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        version TEXT,
        config TEXT,
        enabled INTEGER DEFAULT 1,
        endpoint TEXT,
        hourly_energy_budget REAL,
        daily_energy_budget REAL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS app_conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (app_id) REFERENCES apps(app_id) ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS app_energy (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id TEXT NOT NULL,
        amount REAL NOT NULL,
        conversation_id TEXT,
        operation TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (app_id) REFERENCES apps(app_id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_app_energy_app_id ON app_energy(app_id);
      CREATE INDEX IF NOT EXISTS idx_app_energy_timestamp ON app_energy(timestamp);
    `);
    
    appRegistry = new AppRegistry(db);
    memorySubAgent = new MemorySubAgent(db, true);
  });

  after(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('E2E Scenario 1: Customer Support Conversation', () => {
    it('should remember customer preferences across multiple conversations', async () => {
      const appId = 'support';
      
      // Install support app
      await appRegistry.install({
        id: appId,
        name: 'Customer Support',
        description: 'Customer support chat',
        type: 'in-process',
        version: '1.0.0',
        enabled: true
      });

      console.log('\n  === Conversation 1: Initial Contact ===');
      
      // First conversation: Customer shares preferences
      const conv1Id = 'support-conv-1';
      appRegistry.associateConversation(appId, conv1Id);
      
      // Create memory from first conversation
      const memory1Request: MemoryCreationRequest = {
        appId,
        conversationId: conv1Id,
        conversationSummary: 'Customer shared communication preference',
        userMessages: ['Hi, I need help with my account. By the way, I prefer email communication over phone calls.'],
        assistantMessages: ['I understand you need help with your account and I\'ve noted your preference for email communication. How can I assist you today?']
      };
      
      const memory1 = await memorySubAgent.createMemory(memory1Request);
      assert.ok(memory1, 'First memory should be created');
      console.log(`  ✓ Memory created: "${memory1.content.substring(0, 80)}..."`);

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('\n  === Conversation 2: Follow-up ===');
      
      // Second conversation: Customer returns with new issue
      const conv2Id = 'support-conv-2';
      appRegistry.associateConversation(appId, conv2Id);
      
      // Retrieve memories to simulate context injection
      const memories = memorySubAgent.getMemories(appId, 10);
      console.log(`  ✓ Retrieved ${memories.length} memories for context`);
      assert.ok(memories.length > 0, 'Should have memories from previous conversation');
      
      // Verify memory contains preference information
      const hasPreference = memories.some(m => 
        m.content.toLowerCase().includes('email') || 
        m.content.toLowerCase().includes('communication')
      );
      assert.ok(hasPreference, 'Memory should contain communication preference');
      console.log('  ✓ Memory contains customer preference (email communication)');
      
      // Simulate response using memory context
      console.log('  ✓ System would use memory: "As per your preference, I\'ll send you via email"');
      
      // Create memory from second conversation
      const memory2Request: MemoryCreationRequest = {
        appId,
        conversationId: conv2Id,
        conversationSummary: 'Billing inquiry',
        userMessages: ['I have another question about billing.'],
        assistantMessages: ['I\'ll help you with your billing question. As per your preference, I\'ll send you a detailed explanation via email.']
      };
      
      const memory2 = await memorySubAgent.createMemory(memory2Request);
      assert.ok(memory2, 'Second memory should be created');
      console.log(`  ✓ Memory created: "${memory2.content.substring(0, 80)}..."`);
      
      // Verify both memories exist
      const finalMemories = memorySubAgent.getMemories(appId, 10);
      assert.ok(finalMemories.length >= 2, 'Should have at least 2 memories');
      console.log(`  ✓ Total memories: ${finalMemories.length}`);
    });
  });

  describe('E2E Scenario 2: Personal Assistant Across Multiple Days', () => {
    it('should accumulate and use memories over multiple interactions', async () => {
      const appId = 'assistant';
      
      await appRegistry.install({
        id: appId,
        name: 'Personal Assistant',
        description: 'AI personal assistant',
        type: 'in-process',
        version: '1.0.0',
        enabled: true
      });

      console.log('\n  === Day 1: Morning Routine ===');
      
      // Day 1 Morning: User shares routine
      const day1Conv1 = 'assistant-day1-morning';
      appRegistry.associateConversation(appId, day1Conv1);
      
      await memorySubAgent.createMemory({
        appId,
        conversationId: day1Conv1,
        conversationSummary: 'User shared morning routine',
        userMessages: ['I usually start my day at 6am with a workout, then breakfast at 7am.'],
        assistantMessages: ['Got it! I\'ll remember your morning routine: 6am workout, 7am breakfast.']
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('  === Day 1: Work Preferences ===');
      
      // Day 1 Afternoon: User shares work preferences
      const day1Conv2 = 'assistant-day1-work';
      appRegistry.associateConversation(appId, day1Conv2);
      
      await memorySubAgent.createMemory({
        appId,
        conversationId: day1Conv2,
        conversationSummary: 'User shared work preferences',
        userMessages: ['I prefer to do deep work in the morning and meetings in the afternoon.'],
        assistantMessages: ['Understood. I\'ll schedule your deep work time in the morning and meetings after lunch.']
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('  === Day 2: Scheduling Request ===');
      
      // Day 2: User asks to schedule something
      const day2Conv1 = 'assistant-day2-schedule';
      appRegistry.associateConversation(appId, day2Conv1);
      
      // Retrieve memories to inform scheduling
      const memories = memorySubAgent.getMemories(appId, 10);
      console.log(`  ✓ Retrieved ${memories.length} memories for context`);
      
      // Verify memories contain relevant information
      const hasRoutine = memories.some(m => 
        m.content.toLowerCase().includes('morning') || 
        m.content.toLowerCase().includes('workout')
      );
      const hasWorkPref = memories.some(m => 
        m.content.toLowerCase().includes('meeting') || 
        m.content.toLowerCase().includes('afternoon')
      );
      
      assert.ok(hasRoutine, 'Should remember morning routine');
      assert.ok(hasWorkPref, 'Should remember work preferences');
      console.log('  ✓ Memories contain routine and work preferences');
      
      console.log('  ✓ System would schedule: "Tomorrow afternoon, after morning deep work"');
      
      await memorySubAgent.createMemory({
        appId,
        conversationId: day2Conv1,
        conversationSummary: 'Scheduled team meeting',
        userMessages: ['Can you schedule a team meeting for me tomorrow?'],
        assistantMessages: ['I\'ll schedule the team meeting for tomorrow afternoon, after your morning deep work session.']
      });
      
      const finalMemories = memorySubAgent.getMemories(appId, 10);
      assert.ok(finalMemories.length >= 3, 'Should have accumulated at least 3 memories');
      console.log(`  ✓ Total accumulated memories: ${finalMemories.length}`);
    });
  });

  describe('E2E Scenario 3: Learning User Preferences Over Time', () => {
    it('should build up knowledge about user over multiple conversations', async () => {
      const appId = 'learning-assistant';
      
      await appRegistry.install({
        id: appId,
        name: 'Learning Assistant',
        description: 'AI that learns about user',
        type: 'in-process',
        version: '1.0.0',
        enabled: true
      });

      const conversations = [
        {
          id: 'learn-1',
          user: 'I love Italian food, especially pasta carbonara.',
          assistant: 'Great! I\'ll remember you love Italian food, particularly pasta carbonara.',
          summary: 'Food preference shared'
        },
        {
          id: 'learn-2',
          user: 'I work as a software engineer at a startup.',
          assistant: 'Noted! You\'re a software engineer at a startup.',
          summary: 'Job information shared'
        },
        {
          id: 'learn-3',
          user: 'I have a cat named Whiskers.',
          assistant: 'How lovely! I\'ll remember you have a cat named Whiskers.',
          summary: 'Pet information shared'
        },
        {
          id: 'learn-4',
          user: 'I prefer working from home on Fridays.',
          assistant: 'Got it! Fridays are your work-from-home days.',
          summary: 'Work preference shared'
        },
        {
          id: 'learn-5',
          user: 'I enjoy reading sci-fi novels before bed.',
          assistant: 'I\'ll remember your evening reading habit with sci-fi novels.',
          summary: 'Reading habit shared'
        }
      ];

      console.log('\n  === Building Knowledge Base ===');
      
      for (let i = 0; i < conversations.length; i++) {
        const conv = conversations[i];
        if (!conv) continue;
        
        appRegistry.associateConversation(appId, conv.id);
        
        const memory = await memorySubAgent.createMemory({
          appId,
          conversationId: conv.id,
          conversationSummary: conv.summary,
          userMessages: [conv.user],
          assistantMessages: [conv.assistant]
        });
        
        console.log(`  ${i + 1}. Memory created: "${memory?.content.substring(0, 60)}..."`);
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('\n  === Testing Knowledge Retrieval ===');
      
      // Now test that all information is retrievable
      const allMemories = memorySubAgent.getMemories(appId, 10);
      console.log(`  ✓ Total memories stored: ${allMemories.length}`);
      
      // Check for key information in memories
      const memoryText = allMemories.map(m => m.content.toLowerCase()).join(' ');
      
      const checks = [
        { term: 'italian', description: 'Food preference' },
        { term: 'software', description: 'Job information' },
        { term: 'cat', description: 'Pet information' },
        { term: 'friday', description: 'Work preference' },
        { term: 'sci-fi', description: 'Reading habit' }
      ];
      
      let foundCount = 0;
      for (const check of checks) {
        if (memoryText.includes(check.term)) {
          console.log(`  ✓ ${check.description} remembered`);
          foundCount++;
        }
      }
      
      assert.ok(foundCount >= 3, `Should remember at least 3 out of 5 facts (found ${foundCount})`);
      console.log(`  ✓ Knowledge base built: ${foundCount}/5 facts retained`);
    });
  });

  describe('E2E Scenario 4: Memory Compaction in Real Usage', () => {
    it('should intelligently compact memories when limit is reached', async () => {
      const appId = 'compaction-test';
      
      await appRegistry.install({
        id: appId,
        name: 'Compaction Test App',
        description: 'Test memory compaction',
        type: 'in-process',
        version: '1.0.0',
        enabled: true
      });

      console.log('\n  === Creating 12 Memories to Trigger Compaction ===');
      
      const topics = [
        'User prefers morning meetings',
        'User allergic to peanuts',
        'User birthday is March 15th',
        'User lives in New York',
        'User speaks Spanish and English',
        'User has 2 children',
        'User drives a Tesla',
        'User exercises daily',
        'User is vegetarian',
        'User works remotely',
        'User loves jazz music',
        'User graduated from MIT'
      ];

      for (let i = 0; i < 12; i++) {
        const convId = `compact-${i + 1}`;
        const topic = topics[i];
        if (!topic) continue;
        
        appRegistry.associateConversation(appId, convId);
        
        await memorySubAgent.createMemory({
          appId,
          conversationId: convId,
          conversationSummary: 'User shared information',
          userMessages: [topic],
          assistantMessages: [`Noted: ${topic}`]
        });
        
        const count = memorySubAgent.getMemoryCount(appId);
        console.log(`  ${i + 1}. Created memory about: "${topic}" (total: ${count})`);
        
        if (count > 10) {
          console.log('  🗜️  Compaction triggered!');
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const finalCount = memorySubAgent.getMemoryCount(appId);
      const finalMemories = memorySubAgent.getMemories(appId, 10);
      
      console.log(`\n  === Compaction Results ===`);
      console.log(`  ✓ Final memory count: ${finalCount} (should be ≤10)`);
      assert.ok(finalCount <= 10, 'Memory count should be at most 10');
      assert.strictEqual(finalMemories.length, finalCount, 'Retrieved count should match stored count');
      
      console.log(`  ✓ Memories retained:`);
      finalMemories.forEach((m, i) => {
        console.log(`     ${i + 1}. ${m.content.substring(0, 60)}...`);
      });
    });
  });

  describe('E2E Scenario 5: Cross-Session Memory Persistence', () => {
    it('should persist memories across system restarts', async () => {
      const appId = 'persistence-test';
      
      await appRegistry.install({
        id: appId,
        name: 'Persistence Test',
        description: 'Test memory persistence',
        type: 'in-process',
        version: '1.0.0',
        enabled: true
      });

      console.log('\n  === Session 1: Creating Memories ===');
      
      // Create some memories
      const memories = [
        'User timezone is EST',
        'User prefers dark mode',
        'User uses vim keybindings'
      ];

      for (let i = 0; i < memories.length; i++) {
        const convId = `persist-${i + 1}`;
        const memText = memories[i];
        if (!memText) continue;
        
        appRegistry.associateConversation(appId, convId);
        
        await memorySubAgent.createMemory({
          appId,
          conversationId: convId,
          conversationSummary: 'User preference',
          userMessages: [memText],
          assistantMessages: [`Saved: ${memText}`]
        });
        
        console.log(`  ✓ Created: ${memText}`);
      }

      const session1Count = memorySubAgent.getMemoryCount(appId);
      console.log(`  Session 1 memory count: ${session1Count}`);

      console.log('\n  === Simulating System Restart ===');
      
      // Create new sub-agent instance (simulates restart)
      const newSubAgent = new MemorySubAgent(db, true);
      
      console.log('\n  === Session 2: Retrieving Memories ===');
      
      const session2Memories = newSubAgent.getMemories(appId, 10);
      const session2Count = newSubAgent.getMemoryCount(appId);
      
      console.log(`  Session 2 memory count: ${session2Count}`);
      assert.strictEqual(session2Count, session1Count, 'Memory count should persist');
      
      console.log(`  ✓ Memories persisted:`);
      session2Memories.forEach((m, i) => {
        console.log(`     ${i + 1}. ${m.content.substring(0, 60)}...`);
      });
      
      assert.ok(session2Memories.length >= 3, 'Should have at least 3 persisted memories');
    });
  });

  describe('E2E Scenario 6: Energy Consumption in Real Workflow', () => {
    it('should track realistic energy consumption across workflow', async () => {
      const appId = 'energy-workflow';
      
      await appRegistry.install({
        id: appId,
        name: 'Energy Workflow Test',
        description: 'Test energy tracking',
        type: 'in-process',
        version: '1.0.0',
        enabled: true
      });

      console.log('\n  === Workflow: 5 Conversations with Memory Creation ===');
      
      memorySubAgent.getEnergyConsumedSinceLastPoll(); // Reset
      
      let totalEnergy = 0;
      const energyPerConversation: number[] = [];

      for (let i = 1; i <= 5; i++) {
        const convId = `energy-conv-${i}`;
        const message = `This is conversation ${i} about topic ${i}`;
        
        appRegistry.associateConversation(appId, convId);
        
        await memorySubAgent.createMemory({
          appId,
          conversationId: convId,
          conversationSummary: `Conversation ${i}`,
          userMessages: [message],
          assistantMessages: [`Response to conversation ${i}`]
        });
        
        const energy = memorySubAgent.getEnergyConsumedSinceLastPoll();
        energyPerConversation.push(energy);
        totalEnergy += energy;
        
        console.log(`  ${i}. Conversation ${i}: ${energy.toFixed(2)} energy units`);
      }

      console.log(`\n  === Energy Analysis ===`);
      console.log(`  Total energy: ${totalEnergy.toFixed(2)} units`);
      console.log(`  Average per conversation: ${(totalEnergy / 5).toFixed(2)} units`);
      console.log(`  Min: ${Math.min(...energyPerConversation).toFixed(2)} units`);
      console.log(`  Max: ${Math.max(...energyPerConversation).toFixed(2)} units`);
      
      assert.ok(totalEnergy > 0, 'Should consume energy');
      assert.ok(totalEnergy < 100, 'Energy consumption should be reasonable (<100 units for 5 conversations)');
      
      console.log(`  ✓ Energy consumption is within expected range`);
    });
  });
});
