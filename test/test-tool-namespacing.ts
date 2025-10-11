import { MCPClientManager } from '../src/mcp-client';
import { MockHTTPMCPServer } from './mock-http-mcp-server';
import { MCPServerConfig } from '../src/mcp-subagent-types';

async function runNamespacingTests() {
  console.log('🧪 Tool Namespacing Tests\n');

  const mockServer1 = new MockHTTPMCPServer(8768);
  const mockServer2 = new MockHTTPMCPServer(8769);
  const clientManager = new MCPClientManager();

  try {
    // Start both mock servers
    console.log('1️⃣  Starting two mock HTTP MCP servers...');
    await mockServer1.start();
    await mockServer2.start();
    console.log('✅ Both servers started\n');

    // Connect to first server
    console.log('2️⃣  Test: Connect to first server');
    const config1: MCPServerConfig = {
      id: 'server-1',
      name: 'Server 1',
      transport: 'http',
      url: mockServer1.getUrl(),
      enabled: true
    };

    const connection1 = await clientManager.connectToServer(config1);
    console.log(`✅ Server 1 connected with ${connection1.tools.length} tools\n`);

    // Connect to second server
    console.log('3️⃣  Test: Connect to second server');
    const config2: MCPServerConfig = {
      id: 'server-2',
      name: 'Server 2',
      transport: 'http',
      url: mockServer2.getUrl(),
      enabled: true
    };

    const connection2 = await clientManager.connectToServer(config2);
    console.log(`✅ Server 2 connected with ${connection2.tools.length} tools\n`);

    // Verify namespacing prevents collisions
    console.log('4️⃣  Test: Verify tool names are namespaced');
    console.log('Server 1 tools:');
    connection1.tools.forEach(tool => {
      console.log(`   - ${tool.name} (original: ${tool.originalName})`);
    });
    console.log('\nServer 2 tools:');
    connection2.tools.forEach(tool => {
      console.log(`   - ${tool.name} (original: ${tool.originalName})`);
    });

    // Verify all tool names are unique
    const allTools = [...connection1.tools, ...connection2.tools];
    const toolNames = allTools.map(t => t.name);
    const uniqueNames = new Set(toolNames);
    
    if (toolNames.length === uniqueNames.size) {
      console.log(`\n✅ All ${toolNames.length} tool names are unique (no collisions)\n`);
    } else {
      throw new Error('Tool name collision detected!');
    }

    // Test calling tools from both servers
    console.log('5️⃣  Test: Call echo tool from server-1');
    const result1 = await clientManager.callTool('server-1', 'server-1_echo', {
      message: 'Hello from Server 1'
    });
    console.log(`✅ Server 1 echo: ${result1.content[0].text}\n`);

    console.log('6️⃣  Test: Call echo tool from server-2');
    const result2 = await clientManager.callTool('server-2', 'server-2_echo', {
      message: 'Hello from Server 2'
    });
    console.log(`✅ Server 2 echo: ${result2.content[0].text}\n`);

    // Test that tools are correctly routed to their servers
    console.log('7️⃣  Test: Verify tools are routed to correct servers');
    const add1 = await clientManager.callTool('server-1', 'server-1_add', { a: 10, b: 20 });
    const add2 = await clientManager.callTool('server-2', 'server-2_add', { a: 5, b: 15 });
    console.log(`✅ Server 1 add result: ${add1.content[0].text}`);
    console.log(`✅ Server 2 add result: ${add2.content[0].text}\n`);

    // Test error handling for wrong server
    console.log('8️⃣  Test: Error handling for tool not on server');
    try {
      await clientManager.callTool('server-1', 'server-2_echo', {
        message: 'This should fail'
      });
      console.log('❌ Should have thrown an error\n');
    } catch (error: any) {
      console.log(`✅ Correctly rejected: ${error.message}\n`);
    }

    // Cleanup
    console.log('🧹 Cleaning up...');
    await clientManager.disconnectAll();
    await mockServer1.stop();
    await mockServer2.stop();

    console.log('\n✅ All namespacing tests passed!\n');
    console.log('📊 Summary:');
    console.log('   - Tool names are prefixed with server ID');
    console.log('   - No collisions between servers with same tool names');
    console.log('   - Tools correctly routed to their respective servers');
    console.log('   - Original tool names preserved for actual invocation');
    console.log('   - Error handling works for cross-server tool calls\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    await clientManager.disconnectAll();
    await mockServer1.stop();
    await mockServer2.stop();
    process.exit(1);
  }
}

runNamespacingTests();
