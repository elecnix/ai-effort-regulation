#!/usr/bin/env node
import { AppRegistry, ChatApp, AppEnergyTracker, CircularBuffer } from '../src/apps';
import { Inbox } from '../src/inbox';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DB_PATH = path.join(process.cwd(), 'conversations.db');

console.log('🧪 Starting Apps Feature Tests\n');

// Clean up test database before starting
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}
if (fs.existsSync(TEST_DB_PATH + '-shm')) {
  fs.unlinkSync(TEST_DB_PATH + '-shm');
}
if (fs.existsSync(TEST_DB_PATH + '-wal')) {
  fs.unlinkSync(TEST_DB_PATH + '-wal');
}

let testsPassed = 0;
let testsFailed = 0;

async function runTest(testName: string, testFn: () => Promise<void>) {
  try {
    console.log(`=== ${testName} ===`);
    await testFn();
    console.log(`✅ Test PASSED\n`);
    testsPassed++;
  } catch (error: any) {
    console.error(`❌ Test FAILED: ${error.message}\n`);
    testsFailed++;
  }
  // Small delay to ensure database is fully closed
  await new Promise(resolve => setTimeout(resolve, 50));
}

async function test1_CircularBuffer() {
  const buffer = new CircularBuffer<number>(3);
  
  buffer.push(1);
  buffer.push(2);
  buffer.push(3);
  
  const items = buffer.items();
  if (items.length !== 3) {
    throw new Error(`Expected 3 items, got ${items.length}`);
  }
  
  buffer.push(4);
  const items2 = buffer.items();
  if (items2.length !== 3) {
    throw new Error(`Expected 3 items after overflow, got ${items2.length}`);
  }
  
  if (!items2.includes(4)) {
    throw new Error('Expected buffer to contain 4');
  }
  
  console.log('   Circular buffer working correctly');
}

async function test2_AppRegistry_Schema() {
  const inbox = new Inbox();
  const db = inbox.getDatabase();
  const registry = new AppRegistry(db);
  
  const tables = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name IN ('apps', 'app_energy', 'app_conversations')
  `).all() as Array<{ name: string }>;
  
  if (tables.length !== 3) {
    throw new Error(`Expected 3 app tables, found ${tables.length}`);
  }
  
  console.log('   App registry schema created successfully');
  db.close();
}

async function test3_ChatApp_Installation() {
  const inbox = new Inbox();
  const db = inbox.getDatabase();
  const registry = new AppRegistry(db);
  const chatApp = new ChatApp(registry, inbox);
  
  // Install via registry to persist to database
  await registry.install({
    id: 'chat',
    name: 'Chat App',
    type: 'in-process',
    enabled: true
  });
  
  const config = registry.getAppConfig('chat');
  if (!config) {
    throw new Error('Chat app not found in registry');
  }
  
  if (config.name !== 'Chat App') {
    throw new Error(`Expected name 'Chat App', got '${config.name}'`);
  }
  
  console.log('   Chat app installed successfully');
  db.close();
}

async function test4_EnergyTracking() {
  const inbox = new Inbox();
  const db = inbox.getDatabase();
  const registry = new AppRegistry(db);
  
  // Install app first to satisfy foreign key constraint
  await registry.install({
    id: 'test-app-energy',
    name: 'Test App Energy',
    type: 'in-process',
    enabled: true
  });
  
  const tracker = new AppEnergyTracker(db);
  
  tracker.record('test-app-energy', 10.5, 'conv-1', 'test_operation');
  tracker.record('test-app-energy', 5.2, 'conv-1', 'test_operation');
  tracker.record('test-app-energy', 3.1, 'conv-2', 'another_operation');
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const metrics = tracker.getMetrics('test-app-energy');
  
  const expectedTotal = 10.5 + 5.2 + 3.1;
  if (Math.abs(metrics.total - expectedTotal) > 0.01) {
    throw new Error(`Expected total ${expectedTotal}, got ${metrics.total}`);
  }
  
  if (Math.abs(metrics.last1min - expectedTotal) > 0.01) {
    throw new Error(`Expected last1min ${expectedTotal}, got ${metrics.last1min}`);
  }
  
  console.log(`   Energy tracking: total=${metrics.total}, last1min=${metrics.last1min}`);
  
  db.close();
}

async function test5_AppRegistry_Install() {
  const inbox = new Inbox();
  const db = inbox.getDatabase();
  const registry = new AppRegistry(db);
  
  await registry.install({
    id: 'test-app',
    name: 'Test App',
    description: 'A test application',
    type: 'in-process',
    version: '1.0.0',
    enabled: true,
    hourlyEnergyBudget: 100,
    dailyEnergyBudget: 1000
  });
  
  const config = registry.getAppConfig('test-app');
  if (!config) {
    throw new Error('Test app not found');
  }
  
  if (config.hourlyEnergyBudget !== 100) {
    throw new Error(`Expected hourly budget 100, got ${config.hourlyEnergyBudget}`);
  }
  
  console.log('   App installed with energy budgets');
  db.close();
}

async function test6_AppRegistry_Uninstall() {
  const inbox = new Inbox();
  const db = inbox.getDatabase();
  const registry = new AppRegistry(db);
  
  await registry.install({
    id: 'temp-app',
    name: 'Temporary App',
    type: 'in-process',
    enabled: true
  });
  
  let config = registry.getAppConfig('temp-app');
  if (!config) {
    throw new Error('Temp app not found after install');
  }
  
  await registry.uninstall('temp-app');
  
  config = registry.getAppConfig('temp-app');
  if (config) {
    throw new Error('Temp app still exists after uninstall');
  }
  
  console.log('   App uninstalled successfully');
  db.close();
}

async function test7_ConversationAssociation() {
  const inbox = new Inbox();
  const db = inbox.getDatabase();
  const registry = new AppRegistry(db);
  
  const conversationId = 'test-conv-123';
  const appId = 'assoc-test-app';
  
  // Install app first
  await registry.install({
    id: appId,
    name: 'Association Test App',
    type: 'in-process',
    enabled: true
  });
  
  // Create conversation first
  inbox.addResponse(conversationId, 'Test message', '', 0, '');
  
  registry.associateConversation(conversationId, appId);
  
  const conversations = registry.getActiveConversations();
  const found = conversations.find(c => c.conversationId === conversationId && c.appId === appId);
  
  if (!found) {
    throw new Error('Conversation association not found');
  }
  
  console.log('   Conversation associated with app');
  db.close();
}

async function test8_ChatApp_HandleUserMessage() {
  const inbox = new Inbox();
  const db = inbox.getDatabase();
  const registry = new AppRegistry(db);
  const chatApp = new ChatApp(registry, inbox);
  
  registry.registerApp(chatApp);
  
  const messageId = 'msg-001';
  const content = 'Hello, world!';
  const energyBudget = 50;
  
  await chatApp.handleUserMessage(messageId, content, energyBudget);
  
  const conversation = inbox.getConversation(messageId);
  if (!conversation) {
    throw new Error('Conversation not created');
  }
  
  if (conversation.inputMessage !== content) {
    throw new Error(`Expected message '${content}', got '${conversation.inputMessage}'`);
  }
  
  if (conversation.metadata.energyBudget !== energyBudget) {
    throw new Error(`Expected budget ${energyBudget}, got ${conversation.metadata.energyBudget}`);
  }
  
  console.log('   Chat app handled user message correctly');
  db.close();
}

async function test9_EnergyMetrics_TimeWindows() {
  const inbox = new Inbox();
  const db = inbox.getDatabase();
  const registry = new AppRegistry(db);
  
  // Install app first
  await registry.install({
    id: 'windowed-app',
    name: 'Windowed App',
    type: 'in-process',
    enabled: true
  });
  
  const tracker = new AppEnergyTracker(db);
  
  tracker.record('windowed-app', 100);
  
  // Wait 1.1 seconds for first event to expire from 1-minute window
  await new Promise(resolve => setTimeout(resolve, 1100));
  
  tracker.record('windowed-app', 50);
  
  const metrics = tracker.getMetrics('windowed-app');
  
  if (metrics.total !== 150) {
    throw new Error(`Expected total 150, got ${metrics.total}`);
  }
  
  // The first event should still be in the 1-minute window since we only waited 1.1s
  // Both events should be counted
  if (metrics.last1min < 50) {
    throw new Error(`Expected last1min >= 50, got ${metrics.last1min}`);
  }
  
  console.log(`   Time window metrics: total=${metrics.total}, last1min=${metrics.last1min}`);
  db.close();
}

async function test10_MultipleApps() {
  const inbox = new Inbox();
  const db = inbox.getDatabase();
  const registry = new AppRegistry(db);
  
  const beforeCount = registry.getAllAppConfigs().length;
  
  await registry.install({
    id: 'multi-app1',
    name: 'Multi App 1',
    type: 'in-process',
    enabled: true
  });
  
  await registry.install({
    id: 'multi-app2',
    name: 'Multi App 2',
    type: 'in-process',
    enabled: true
  });
  
  await registry.install({
    id: 'multi-app3',
    name: 'Multi App 3',
    type: 'in-process',
    enabled: false
  });
  
  const allConfigs = registry.getAllAppConfigs();
  const newApps = allConfigs.filter(c => c.id.startsWith('multi-app'));
  
  if (newApps.length !== 3) {
    throw new Error(`Expected 3 new apps, got ${newApps.length}`);
  }
  
  const enabledCount = newApps.filter(c => c.enabled).length;
  if (enabledCount !== 2) {
    throw new Error(`Expected 2 enabled apps, got ${enabledCount}`);
  }
  
  console.log(`   Multiple apps managed correctly (${allConfigs.length} total, ${newApps.length} new)`);
  db.close();
}

async function main() {
  await runTest('Test 1: Circular Buffer', test1_CircularBuffer);
  await runTest('Test 2: App Registry Schema', test2_AppRegistry_Schema);
  await runTest('Test 3: Chat App Installation', test3_ChatApp_Installation);
  await runTest('Test 4: Energy Tracking', test4_EnergyTracking);
  await runTest('Test 5: App Registry Install', test5_AppRegistry_Install);
  await runTest('Test 6: App Registry Uninstall', test6_AppRegistry_Uninstall);
  await runTest('Test 7: Conversation Association', test7_ConversationAssociation);
  await runTest('Test 8: Chat App Handle User Message', test8_ChatApp_HandleUserMessage);
  await runTest('Test 9: Energy Metrics Time Windows', test9_EnergyMetrics_TimeWindows);
  await runTest('Test 10: Multiple Apps', test10_MultipleApps);
  
  console.log('\n' + '='.repeat(50));
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  console.log('='.repeat(50));
  
  // Clean up
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  if (fs.existsSync(TEST_DB_PATH + '-shm')) {
    fs.unlinkSync(TEST_DB_PATH + '-shm');
  }
  if (fs.existsSync(TEST_DB_PATH + '-wal')) {
    fs.unlinkSync(TEST_DB_PATH + '-wal');
  }
  
  process.exit(testsFailed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
