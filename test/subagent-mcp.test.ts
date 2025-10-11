/**
 * Real MCP Integration Test for Sub-Agent
 * Tests the sub-agent with an actual MCP server
 */

import { MCPSubAgent } from '../src/mcp-subagent';
import { MCPServerConfig } from '../src/mcp-subagent-types';
import * as path from 'path';
import * as fs from 'fs';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const TEST_CONFIG_PATH = path.join(process.cwd(), 'test-mcp-servers.json');

// Clean up test config before tests
function cleanupTestConfig() {
  if (fs.existsSync(TEST_CONFIG_PATH)) {
    fs.unlinkSync(TEST_CONFIG_PATH);
  }
}

async function testAddRealMCPServer() {
  console.log('\n=== Test 1: Add Real MCP Server ===');
  
  cleanupTestConfig();
  const agent = new MCPSubAgent(true, TEST_CONFIG_PATH);
  agent.start();

  const serverConfig: MCPServerConfig = {
    id: 'test-server',
    name: 'Test MCP Server',
    command: 'node',
    args: [path.join(process.cwd(), 'test/simple-mcp-server.js')],
    enabled: true
  };

  console.log('📝 Adding test MCP server...');
  const requestId = agent.queueRequest('add_server', { serverConfig }, 'high');

  // Wait for completion
  let completed = false;
  let iterations = 0;
  const maxIterations = 100;

  while (!completed && iterations < maxIterations) {
    await sleep(100);
    iterations++;

    const status = agent.getStatus(requestId);
    if (status) {
      console.log(`   Status: ${status.state} (${status.progress}%) - ${status.message}`);
      
      if (status.state === 'completed') {
        completed = true;
        console.log(`   Result:`, status.result);
        
        // Verify result
        if (status.result.status === 'added' && status.result.toolsDiscovered > 0) {
          console.log(`   ✅ Server added with ${status.result.toolsDiscovered} tools`);
          console.log(`   📋 Tools:`, status.result.tools);
        } else {
          console.log('   ❌ Server added but no tools discovered');
          await agent.stop();
          return false;
        }
      } else if (status.state === 'failed') {
        console.log(`   ❌ Failed: ${status.error}`);
        await agent.stop();
        return false;
      }
    }
  }

  await agent.stop();
  
  if (completed) {
    console.log('✅ Test 1 PASSED\n');
    return true;
  } else {
    console.log('❌ Test 1 FAILED: Request did not complete\n');
    return false;
  }
}

async function testTestMCPServer() {
  console.log('\n=== Test 2: Test MCP Server Connection ===');
  
  const agent = new MCPSubAgent(true, TEST_CONFIG_PATH);
  agent.start();

  const serverConfig: MCPServerConfig = {
    id: 'test-server-2',
    name: 'Test Server 2',
    command: 'node',
    args: [path.join(process.cwd(), 'test/simple-mcp-server.js')],
    enabled: true
  };

  console.log('📝 Testing MCP server connection...');
  const requestId = agent.queueRequest('test_server', { serverConfig }, 'high');

  // Wait for completion
  let result: any = null;
  let iterations = 0;
  const maxIterations = 100;

  while (iterations < maxIterations) {
    await sleep(100);
    iterations++;

    const status = agent.getStatus(requestId);
    if (status && (status.state === 'completed' || status.state === 'failed')) {
      if (status.state === 'completed') {
        result = status.result;
        console.log(`   ✅ Connection test passed`);
        console.log(`   📋 Tools discovered: ${result.toolCount}`);
        console.log(`   📝 Tools:`, result.tools);
      } else {
        console.log(`   ❌ Failed: ${status.error}`);
        await agent.stop();
        return false;
      }
      break;
    }
  }

  await agent.stop();

  if (result && result.status === 'success' && result.toolCount > 0) {
    console.log('✅ Test 2 PASSED\n');
    return true;
  } else {
    console.log('❌ Test 2 FAILED\n');
    return false;
  }
}

async function testListServers() {
  console.log('\n=== Test 3: List MCP Servers ===');
  
  const agent = new MCPSubAgent(true, TEST_CONFIG_PATH);
  agent.start();

  console.log('📝 Listing configured servers...');
  const requestId = agent.queueRequest('list_servers', {}, 'medium');

  // Wait for completion
  let result: any = null;
  while (!result) {
    await sleep(100);
    const status = agent.getStatus(requestId);
    if (status && status.state === 'completed') {
      result = status.result;
    } else if (status && status.state === 'failed') {
      console.log(`   ❌ Failed: ${status.error}`);
      await agent.stop();
      return false;
    }
  }

  console.log(`   📋 Found ${result.count} server(s)`);
  console.log(`   Servers:`, result.servers);

  await agent.stop();

  // Should have 1 server from previous test
  if (result.count >= 1) {
    console.log('✅ Test 3 PASSED\n');
    return true;
  } else {
    console.log('❌ Test 3 FAILED: Expected at least 1 server\n');
    return false;
  }
}

async function testRemoveServer() {
  console.log('\n=== Test 4: Remove MCP Server ===');
  
  const agent = new MCPSubAgent(true, TEST_CONFIG_PATH);
  agent.start();

  console.log('📝 Removing test server...');
  const requestId = agent.queueRequest('remove_server', { serverId: 'test-server' }, 'medium');

  // Wait for completion
  let result: any = null;
  while (!result) {
    await sleep(100);
    const status = agent.getStatus(requestId);
    if (status && status.state === 'completed') {
      result = status.result;
    } else if (status && status.state === 'failed') {
      console.log(`   ❌ Failed: ${status.error}`);
      await agent.stop();
      return false;
    }
  }

  console.log(`   ✅ Server removed: ${result.message}`);

  await agent.stop();

  if (result.status === 'removed') {
    console.log('✅ Test 4 PASSED\n');
    return true;
  } else {
    console.log('❌ Test 4 FAILED\n');
    return false;
  }
}

async function testEnergyTracking() {
  console.log('\n=== Test 5: Energy Tracking with Real Server ===');
  
  const agent = new MCPSubAgent(false, TEST_CONFIG_PATH);
  agent.start();

  const serverConfig: MCPServerConfig = {
    id: 'test-energy-server',
    name: 'Energy Test Server',
    command: 'node',
    args: [path.join(process.cwd(), 'test/simple-mcp-server.js')],
    enabled: true
  };

  // Add server
  const requestId = agent.queueRequest('add_server', { serverConfig }, 'high');

  // Wait for completion
  while (agent.hasActiveWork()) {
    await sleep(100);
  }

  const energyConsumed = agent.getEnergyConsumedSinceLastPoll();
  const totalEnergy = agent.getTotalEnergyConsumed();

  console.log(`   ⚡ Energy consumed: ${energyConsumed.toFixed(2)}`);
  console.log(`   ⚡ Total energy: ${totalEnergy.toFixed(2)}`);

  await agent.stop();

  // Should have consumed some energy
  if (energyConsumed > 0 && totalEnergy > 0) {
    console.log('✅ Test 5 PASSED\n');
    return true;
  } else {
    console.log('❌ Test 5 FAILED: No energy consumed\n');
    return false;
  }
}

async function runAllTests() {
  console.log('🧪 Starting Real MCP Integration Tests\n');
  console.log('These tests verify the sub-agent works with actual MCP servers');
  console.log('using the MCP SDK.\n');

  const results: boolean[] = [];

  results.push(await testAddRealMCPServer());
  results.push(await testTestMCPServer());
  results.push(await testListServers());
  results.push(await testRemoveServer());
  results.push(await testEnergyTracking());

  // Cleanup
  cleanupTestConfig();

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log('\n' + '='.repeat(50));
  console.log(`Test Results: ${passed}/${total} passed`);
  console.log('='.repeat(50));

  if (passed === total) {
    console.log('✅ All MCP integration tests passed!');
    console.log('Sub-agent can successfully manage real MCP servers.');
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
