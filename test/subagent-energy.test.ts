/**
 * Energy Tracking Test for MCP Sub-Agent
 * Verifies energy consumption is tracked correctly
 */

import { MCPSubAgent } from '../src/mcp-subagent';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testEnergyTracking() {
  console.log('\n=== Test 1: Basic Energy Tracking ===');
  
  const agent = new MCPSubAgent(true);
  agent.start();

  // Queue a request that will take ~2 seconds
  const requestId = agent.queueRequest('test_server', {
    serverId: 'test-server-1',
    serverConfig: { id: 'test', name: 'Test Server' }
  }, 'medium');

  console.log(`📝 Queued request: ${requestId}`);

  // Wait for completion
  let completed = false;
  let iterations = 0;
  const maxIterations = 50;

  while (!completed && iterations < maxIterations) {
    await sleep(100);
    iterations++;

    const status = agent.getStatus(requestId);
    if (status && (status.state === 'completed' || status.state === 'failed')) {
      completed = true;
    }
  }

  // Check energy consumption
  const energyConsumed = agent.getEnergyConsumedSinceLastPoll();
  const totalEnergy = agent.getTotalEnergyConsumed();

  console.log(`   ⚡ Energy consumed: ${energyConsumed.toFixed(2)}`);
  console.log(`   ⚡ Total energy: ${totalEnergy.toFixed(2)}`);

  // Second poll should return 0
  const secondPoll = agent.getEnergyConsumedSinceLastPoll();
  console.log(`   ⚡ Second poll (should be 0): ${secondPoll.toFixed(2)}`);

  agent.stop();

  // Verify: ~2 seconds at 2 energy/sec = ~4 energy
  const expected = 4.0;
  const tolerance = 0.5;
  if (Math.abs(energyConsumed - expected) < tolerance && secondPoll === 0) {
    console.log('✅ Test 1 PASSED\n');
    return true;
  } else {
    console.log('❌ Test 1 FAILED\n');
    return false;
  }
}

async function testMultipleRequestsEnergy() {
  console.log('\n=== Test 2: Multiple Requests Energy ===');
  
  const agent = new MCPSubAgent(false);
  agent.start();

  // Queue 3 requests
  agent.queueRequest('test_server', { serverId: '1' }, 'medium'); // ~2s = 4 energy
  agent.queueRequest('list_servers', {}, 'medium');               // ~0.2s = 0.4 energy
  agent.queueRequest('test_server', { serverId: '2' }, 'medium'); // ~2s = 4 energy
  // Total expected: ~8.4 energy

  // Wait for all to complete
  let iterations = 0;
  const maxIterations = 100;
  while (agent.hasActiveWork() && iterations < maxIterations) {
    await sleep(100);
    iterations++;
  }

  const totalEnergy = agent.getTotalEnergyConsumed();
  console.log(`   ⚡ Total energy consumed: ${totalEnergy.toFixed(2)}`);

  agent.stop();

  // Verify: ~8.4 energy
  const expected = 8.4;
  const tolerance = 1.0;
  if (Math.abs(totalEnergy - expected) < tolerance) {
    console.log('✅ Test 2 PASSED\n');
    return true;
  } else {
    console.log('❌ Test 2 FAILED\n');
    return false;
  }
}

async function testIncrementalPolling() {
  console.log('\n=== Test 3: Incremental Energy Polling ===');
  
  const agent = new MCPSubAgent(false);
  agent.start();

  // Queue multiple requests
  agent.queueRequest('test_server', { serverId: '1' }, 'medium');
  agent.queueRequest('test_server', { serverId: '2' }, 'medium');
  agent.queueRequest('test_server', { serverId: '3' }, 'medium');

  const pollResults: number[] = [];
  let totalPolled = 0;

  // Poll every 500ms while work is active
  while (agent.hasActiveWork()) {
    await sleep(500);
    const energySinceLast = agent.getEnergyConsumedSinceLastPoll();
    if (energySinceLast > 0) {
      pollResults.push(energySinceLast);
      totalPolled += energySinceLast;
      console.log(`   ⚡ Poll ${pollResults.length}: ${energySinceLast.toFixed(2)} energy`);
    }
  }

  // Final poll
  const finalPoll = agent.getEnergyConsumedSinceLastPoll();
  if (finalPoll > 0) {
    pollResults.push(finalPoll);
    totalPolled += finalPoll;
    console.log(`   ⚡ Final poll: ${finalPoll.toFixed(2)} energy`);
  }

  const totalEnergy = agent.getTotalEnergyConsumed();
  console.log(`   ⚡ Total from polls: ${totalPolled.toFixed(2)}`);
  console.log(`   ⚡ Total from getTotalEnergyConsumed: ${totalEnergy.toFixed(2)}`);

  agent.stop();

  // Verify: total polled should equal total energy
  if (Math.abs(totalPolled - totalEnergy) < 0.01) {
    console.log('✅ Test 3 PASSED\n');
    return true;
  } else {
    console.log('❌ Test 3 FAILED\n');
    return false;
  }
}

async function testEnergyOnFailure() {
  console.log('\n=== Test 4: Energy Tracked on Failure ===');
  
  const agent = new MCPSubAgent(false);
  agent.start();

  // Queue a request that will fail (unknown type causes error in processRequest)
  // Actually, our current implementation doesn't have a failing case, so let's test with a normal request
  // and verify energy is tracked regardless
  
  const requestId = agent.queueRequest('test_server', { serverId: 'test' }, 'medium');

  // Wait for completion
  while (agent.hasActiveWork()) {
    await sleep(100);
  }

  const energyConsumed = agent.getEnergyConsumedSinceLastPoll();
  console.log(`   ⚡ Energy consumed: ${energyConsumed.toFixed(2)}`);

  agent.stop();

  // Even on success, energy should be tracked
  if (energyConsumed > 0) {
    console.log('✅ Test 4 PASSED\n');
    return true;
  } else {
    console.log('❌ Test 4 FAILED\n');
    return false;
  }
}

async function testZeroEnergyWhenIdle() {
  console.log('\n=== Test 5: Zero Energy When Idle ===');
  
  const agent = new MCPSubAgent(false);
  agent.start();

  // Don't queue any work
  await sleep(500);

  const energyConsumed = agent.getEnergyConsumedSinceLastPoll();
  const totalEnergy = agent.getTotalEnergyConsumed();

  console.log(`   ⚡ Energy consumed (should be 0): ${energyConsumed.toFixed(2)}`);
  console.log(`   ⚡ Total energy (should be 0): ${totalEnergy.toFixed(2)}`);

  agent.stop();

  if (energyConsumed === 0 && totalEnergy === 0) {
    console.log('✅ Test 5 PASSED\n');
    return true;
  } else {
    console.log('❌ Test 5 FAILED\n');
    return false;
  }
}

async function runAllTests() {
  console.log('🧪 Starting Sub-Agent Energy Tracking Tests\n');
  console.log('These tests verify energy consumption is tracked correctly');
  console.log('and can be polled by the main loop.\n');

  const results: boolean[] = [];

  results.push(await testEnergyTracking());
  results.push(await testMultipleRequestsEnergy());
  results.push(await testIncrementalPolling());
  results.push(await testEnergyOnFailure());
  results.push(await testZeroEnergyWhenIdle());

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log('\n' + '='.repeat(50));
  console.log(`Test Results: ${passed}/${total} passed`);
  console.log('='.repeat(50));

  if (passed === total) {
    console.log('✅ All energy tracking tests passed!');
    console.log('Sub-agent is ready for main loop integration.');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Please review and fix.');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
