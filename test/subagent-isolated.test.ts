/**
 * Isolated test for MCP Sub-Agent
 * Tests the sub-agent without any integration with the main loop
 */

import { MCPSubAgent } from '../src/mcp-subagent';
import { SubAgentMessage } from '../src/mcp-subagent-types';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testBasicOperation() {
  console.log('\n=== Test 1: Basic Operation ===');
  
  const agent = new MCPSubAgent(true);
  agent.start();

  // Queue a simple test request
  const requestId = agent.queueRequest('test_server', {
    serverId: 'test-server-1',
    serverConfig: { id: 'test', name: 'Test Server' }
  }, 'medium');

  console.log(`📝 Queued request: ${requestId}`);

  // Poll for status updates
  let completed = false;
  let iterations = 0;
  const maxIterations = 50; // 5 seconds max

  while (!completed && iterations < maxIterations) {
    await sleep(100);
    iterations++;

    // Check status
    const status = agent.getStatus(requestId);
    if (status) {
      console.log(`   Status: ${status.state} (${status.progress}%) - ${status.message}`);
      
      if (status.state === 'completed' || status.state === 'failed') {
        completed = true;
        console.log(`   Result:`, status.result || status.error);
      }
    }

    // Poll messages
    const messages = agent.pollMessages();
    for (const msg of messages) {
      console.log(`   📨 Message: ${msg.type} - ${JSON.stringify(msg.data).substring(0, 100)}`);
    }
  }

  await await agent.stop();
  
  if (completed) {
    console.log('✅ Test 1 PASSED\n');
    return true;
  } else {
    console.log('❌ Test 1 FAILED: Request did not complete\n');
    return false;
  }
}

async function testMultipleRequests() {
  console.log('\n=== Test 2: Multiple Concurrent Requests ===');
  
  const agent = new MCPSubAgent(true);
  agent.start();

  // Queue multiple requests
  const request1 = agent.queueRequest('test_server', { serverId: 'server-1' }, 'low');
  const request2 = agent.queueRequest('add_server', { 
    serverConfig: { id: 'new-server', name: 'New Server', command: 'node', args: [], enabled: true }
  }, 'high');
  const request3 = agent.queueRequest('list_servers', {}, 'medium');

  console.log(`📝 Queued 3 requests: ${request1}, ${request2}, ${request3}`);

  // Wait for all to complete
  const requestIds = [request1, request2, request3];
  const completedIds = new Set<string>();
  let iterations = 0;
  const maxIterations = 100;

  while (completedIds.size < requestIds.length && iterations < maxIterations) {
    await sleep(100);
    iterations++;

    for (const id of requestIds) {
      if (completedIds.has(id)) continue;
      
      const status = agent.getStatus(id);
      if (status && (status.state === 'completed' || status.state === 'failed')) {
        console.log(`   ✓ Request ${id} ${status.state}`);
        completedIds.add(id);
      }
    }

    // Poll messages
    const messages = agent.pollMessages();
    if (messages.length > 0) {
      console.log(`   📨 Received ${messages.length} messages`);
    }
  }

  const metrics = agent.getMetrics();
  console.log(`   📊 Metrics:`, metrics);

  await agent.stop();
  
  if (completedIds.size === requestIds.length) {
    console.log('✅ Test 2 PASSED\n');
    return true;
  } else {
    console.log(`❌ Test 2 FAILED: Only ${completedIds.size}/${requestIds.length} completed\n`);
    return false;
  }
}

async function testPriorityOrdering() {
  console.log('\n=== Test 3: Priority Ordering ===');
  
  const agent = new MCPSubAgent(true);
  agent.start();

  // Queue requests in reverse priority order
  const lowPriority = agent.queueRequest('test_server', { serverId: 'low' }, 'low');
  const mediumPriority = agent.queueRequest('test_server', { serverId: 'medium' }, 'medium');
  const highPriority = agent.queueRequest('test_server', { serverId: 'high' }, 'high');

  console.log(`📝 Queued: low=${lowPriority}, medium=${mediumPriority}, high=${highPriority}`);

  // Track completion order
  const completionOrder: string[] = [];
  const requestIds = [lowPriority, mediumPriority, highPriority];
  let iterations = 0;
  const maxIterations = 100;

  while (completionOrder.length < requestIds.length && iterations < maxIterations) {
    await sleep(100);
    iterations++;

    const messages = agent.pollMessages();
    for (const msg of messages) {
      if (msg.type === 'completion' && !completionOrder.includes(msg.requestId)) {
        completionOrder.push(msg.requestId);
        console.log(`   Completed: ${msg.requestId === highPriority ? 'HIGH' : msg.requestId === mediumPriority ? 'MEDIUM' : 'LOW'}`);
      }
    }
  }

  await agent.stop();

  // High priority should complete first
  const highCompletedFirst = completionOrder[0] === highPriority;
  
  if (highCompletedFirst) {
    console.log('✅ Test 3 PASSED: High priority completed first\n');
    return true;
  } else {
    console.log('❌ Test 3 FAILED: Priority ordering not respected\n');
    return false;
  }
}

async function testCancellation() {
  console.log('\n=== Test 4: Request Cancellation ===');
  
  const agent = new MCPSubAgent(true);
  agent.start();

  // Queue a request and immediately cancel it
  const requestId = agent.queueRequest('search_servers', { query: 'test' }, 'low');
  console.log(`📝 Queued request: ${requestId}`);

  await sleep(50); // Small delay

  const cancelled = agent.cancelRequest(requestId);
  console.log(`   Cancellation ${cancelled ? 'succeeded' : 'failed'}`);

  await sleep(200);

  const status = agent.getStatus(requestId);
  console.log(`   Final status: ${status?.state}`);

  await agent.stop();

  if (cancelled && status?.state === 'cancelled') {
    console.log('✅ Test 4 PASSED\n');
    return true;
  } else {
    console.log('❌ Test 4 FAILED\n');
    return false;
  }
}

async function testMessagePolling() {
  console.log('\n=== Test 5: Message Polling ===');
  
  const agent = new MCPSubAgent(true);
  agent.start();

  const requestId = agent.queueRequest('test_server', { serverId: 'test' }, 'medium');
  
  let messageCount = 0;
  let statusUpdateCount = 0;
  let completionReceived = false;
  let iterations = 0;
  const maxIterations = 50;

  while (!completionReceived && iterations < maxIterations) {
    await sleep(100);
    iterations++;

    const messages = agent.pollMessages();
    messageCount += messages.length;

    for (const msg of messages) {
      if (msg.type === 'status_update') statusUpdateCount++;
      if (msg.type === 'completion') completionReceived = true;
    }
  }

  await agent.stop();

  console.log(`   Total messages: ${messageCount}`);
  console.log(`   Status updates: ${statusUpdateCount}`);
  console.log(`   Completion received: ${completionReceived}`);

  if (completionReceived && messageCount > 0) {
    console.log('✅ Test 5 PASSED\n');
    return true;
  } else {
    console.log('❌ Test 5 FAILED\n');
    return false;
  }
}

async function testMetrics() {
  console.log('\n=== Test 6: Metrics Tracking ===');
  
  const agent = new MCPSubAgent(false); // Disable debug for cleaner output
  agent.start();

  // Queue multiple requests
  agent.queueRequest('test_server', { serverId: '1' }, 'medium');
  agent.queueRequest('test_server', { serverId: '2' }, 'medium');
  agent.queueRequest('test_server', { serverId: '3' }, 'medium');

  // Wait until all work is done (poll until no active work)
  let iterations = 0;
  const maxIterations = 100; // 10 seconds max
  while (agent.hasActiveWork() && iterations < maxIterations) {
    await sleep(100);
    iterations++;
  }

  const metrics = agent.getMetrics();
  console.log(`   Metrics:`, metrics);

  await agent.stop();

  if (metrics.totalRequests === 3 && metrics.completedRequests === 3) {
    console.log('✅ Test 6 PASSED\n');
    return true;
  } else {
    console.log('❌ Test 6 FAILED\n');
    return false;
  }
}

async function runAllTests() {
  console.log('🧪 Starting Sub-Agent Isolated Tests\n');
  console.log('These tests verify the sub-agent works correctly in isolation');
  console.log('before integrating with the main sensitive loop.\n');

  const results: boolean[] = [];

  results.push(await testBasicOperation());
  results.push(await testMultipleRequests());
  results.push(await testPriorityOrdering());
  results.push(await testCancellation());
  results.push(await testMessagePolling());
  results.push(await testMetrics());

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log('\n' + '='.repeat(50));
  console.log(`Test Results: ${passed}/${total} passed`);
  console.log('='.repeat(50));

  if (passed === total) {
    console.log('✅ All tests passed! Sub-agent is ready for integration.');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Please review and fix before integrating.');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
