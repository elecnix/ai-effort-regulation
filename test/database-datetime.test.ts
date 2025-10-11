#!/usr/bin/env node
import { Inbox } from '../src/inbox';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-conversations.db');

console.log('🧪 Starting Database DateTime Tests\n');
console.log('These tests verify the database correctly handles DATETIME columns\n\n');

// Clean up test database if it exists
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

// Temporarily override DB path for testing
const originalDbPath = process.env.DB_PATH;
process.env.DB_PATH = TEST_DB_PATH;

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
}

async function test1_BasicSnooze() {
  const inbox = new Inbox();
  inbox.open();

  // Add a conversation
  const requestId = 'test-conv-1';
  inbox.addResponse(requestId, 'Test message', 'Test response', 50, 'llama3.2:1b');

  // Snooze it for 5 minutes
  const snoozeUntil = inbox.snoozeConversation(requestId, 5);
  console.log(`   Snoozed until: ${snoozeUntil.toISOString()}`);

  // Verify it's not in pending messages (because it's snoozed)
  const pending = inbox.getPendingMessages();
  if (pending.some(msg => msg.id === requestId)) {
    throw new Error('Snoozed conversation should not be in pending messages');
  }
  console.log('   ✓ Snoozed conversation not in pending messages');
}

async function test2_SnoozeExpiry() {
  const inbox = new Inbox();
  inbox.open();

  // Add a conversation
  const requestId = 'test-conv-2';
  inbox.addResponse(requestId, 'Test message 2', '', 50, 'llama3.2:1b');

  // Snooze it for -1 minutes (in the past)
  const snoozeUntil = new Date();
  snoozeUntil.setMinutes(snoozeUntil.getMinutes() - 1);
  
  // Manually set snooze_until to past time
  const db = (inbox as any).db;
  db.prepare('UPDATE conversations SET snooze_until = datetime(?) WHERE request_id = ?')
    .run(snoozeUntil.toISOString(), requestId);
  
  console.log(`   Snoozed until (past): ${snoozeUntil.toISOString()}`);

  // Verify it IS in pending messages (because snooze expired)
  const pending = inbox.getPendingMessages();
  if (!pending.some(msg => msg.id === requestId)) {
    throw new Error('Expired snooze conversation should be in pending messages');
  }
  console.log('   ✓ Expired snooze conversation is in pending messages');
}

async function test3_RecentConversationsWithSnooze() {
  const inbox = new Inbox();
  inbox.open();

  // Add conversations
  const conv1 = 'test-conv-3';
  const conv2 = 'test-conv-4';
  
  inbox.addResponse(conv1, 'Message 1', 'Response 1', 50, 'llama3.2:1b');
  inbox.addResponse(conv2, 'Message 2', 'Response 2', 50, 'llama3.2:1b');

  // Snooze conv1 for future
  inbox.snoozeConversation(conv1, 60);

  // Get recent conversations (should not include snoozed one)
  const recent = inbox.getRecentConversations(10);
  console.log(`   Found ${recent.length} recent conversations`);
  
  if (recent.some(c => c.id === conv1)) {
    throw new Error('Snoozed conversation should not be in recent conversations');
  }
  if (!recent.some(c => c.id === conv2)) {
    throw new Error('Non-snoozed conversation should be in recent conversations');
  }
  console.log('   ✓ Snooze filtering works correctly');
}

async function test4_CompletedConversationsWithSnooze() {
  const inbox = new Inbox();
  inbox.open();

  // Add completed conversations
  const conv1 = 'test-conv-5';
  const conv2 = 'test-conv-6';
  
  inbox.addResponse(conv1, 'Message 5', 'Response 5', 50, 'llama3.2:1b');
  inbox.addResponse(conv2, 'Message 6', 'Response 6', 50, 'llama3.2:1b');

  // Snooze conv1 for future
  inbox.snoozeConversation(conv1, 60);

  // Get recent completed conversations
  const completed = inbox.getRecentCompletedConversations(10);
  console.log(`   Found ${completed.length} completed conversations`);
  
  if (completed.some(c => c.requestId === conv1)) {
    throw new Error('Snoozed conversation should not be in completed conversations');
  }
  if (!completed.some(c => c.requestId === conv2)) {
    throw new Error('Non-snoozed conversation should be in completed conversations');
  }
  console.log('   ✓ Snooze filtering works for completed conversations');
}

async function test5_DatetimeComparison() {
  const inbox = new Inbox();
  inbox.open();

  const db = (inbox as any).db;
  
  // Test direct datetime comparison
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 60000).toISOString();
  const past = new Date(Date.now() - 60000).toISOString();
  
  console.log(`   Now: ${now}`);
  console.log(`   Future: ${future}`);
  console.log(`   Past: ${past}`);
  
  // Test comparison query
  const result = db.prepare(`
    SELECT 
      datetime(?) < datetime('now') as past_is_less,
      datetime(?) < datetime('now') as future_is_less
  `).get(past, future);
  
  console.log(`   Past < now: ${result.past_is_less}`);
  console.log(`   Future < now: ${result.future_is_less}`);
  
  if (result.past_is_less !== 1) {
    throw new Error('Past datetime should be less than now');
  }
  if (result.future_is_less !== 0) {
    throw new Error('Future datetime should not be less than now');
  }
  console.log('   ✓ DateTime comparisons work correctly');
}

async function main() {
  await runTest('Test 1: Basic Snooze', test1_BasicSnooze);
  await runTest('Test 2: Snooze Expiry', test2_SnoozeExpiry);
  await runTest('Test 3: Recent Conversations with Snooze', test3_RecentConversationsWithSnooze);
  await runTest('Test 4: Completed Conversations with Snooze', test4_CompletedConversationsWithSnooze);
  await runTest('Test 5: DateTime Comparison', test5_DatetimeComparison);

  console.log('==================================================');
  console.log(`Test Results: ${testsPassed}/${testsPassed + testsFailed} passed`);
  console.log('==================================================');

  // Clean up
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  // Restore original DB path
  if (originalDbPath) {
    process.env.DB_PATH = originalDbPath;
  }

  if (testsFailed > 0) {
    console.log('❌ Some tests failed!');
    process.exit(1);
  } else {
    console.log('✅ All database datetime tests passed!');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
