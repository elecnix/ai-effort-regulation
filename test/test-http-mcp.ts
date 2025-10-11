import { MCPClientManager } from '../src/mcp-client';
import { MockHTTPMCPServer } from './mock-http-mcp-server';
import { MCPServerConfig } from '../src/mcp-subagent-types';

async function runTests() {
  console.log('🧪 HTTP MCP Transport Tests\n');

  const mockServer = new MockHTTPMCPServer(8767);
  const clientManager = new MCPClientManager();

  try {
    // Start mock server
    console.log('1️⃣  Starting mock HTTP MCP server...');
    await mockServer.start();
    console.log('✅ Mock server started\n');

    // Test 1: Connect to HTTP server
    console.log('2️⃣  Test: Connect to HTTP MCP server');
    const config: MCPServerConfig = {
      id: 'test-http',
      name: 'Test HTTP Server',
      transport: 'http',
      url: mockServer.getUrl(),
      enabled: true
    };

    const connection = await clientManager.connectToServer(config);
    console.log(`✅ Connected: ${connection.connected}`);
    console.log(`✅ Tools discovered: ${connection.tools.length}\n`);

    // Test 2: List tools
    console.log('3️⃣  Test: List tools from HTTP server');
    connection.tools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });
    console.log('✅ Tools listed\n');

    // Test 3: Call echo tool
    console.log('4️⃣  Test: Call echo tool');
    const echoResult = await clientManager.callTool('test-http', 'echo', {
      message: 'Hello from HTTP MCP!'
    });
    console.log(`✅ Echo result: ${echoResult.content[0].text}\n`);

    // Test 4: Call add tool
    console.log('5️⃣  Test: Call add tool');
    const addResult = await clientManager.callTool('test-http', 'add', {
      a: 15,
      b: 27
    });
    console.log(`✅ Add result: ${addResult.content[0].text}\n`);

    // Test 5: Call get_time tool
    console.log('6️⃣  Test: Call get_time tool');
    const timeResult = await clientManager.callTool('test-http', 'get_time', {});
    console.log(`✅ Time result: ${timeResult.content[0].text}\n`);

    // Test 6: Test connection health
    console.log('7️⃣  Test: Health check');
    const isHealthy = await clientManager.testConnection('test-http');
    console.log(`✅ Health check: ${isHealthy ? 'PASS' : 'FAIL'}\n`);

    // Test 7: Test with authentication
    console.log('8️⃣  Test: Connect with bearer token');
    const authConfig: MCPServerConfig = {
      id: 'test-http-auth',
      name: 'Test HTTP Auth',
      transport: 'http',
      url: mockServer.getUrl(),
      auth: {
        type: 'bearer',
        token: 'test-token-123'
      },
      enabled: true
    };

    const authConnection = await clientManager.connectToServer(authConfig);
    console.log(`✅ Authenticated connection: ${authConnection.connected}\n`);

    // Test 8: Test with API key
    console.log('9️⃣  Test: Connect with API key');
    const apiKeyConfig: MCPServerConfig = {
      id: 'test-http-apikey',
      name: 'Test HTTP API Key',
      transport: 'http',
      url: mockServer.getUrl(),
      auth: {
        type: 'apikey',
        apiKey: 'test-api-key-456',
        headerName: 'X-API-Key'
      },
      enabled: true
    };

    const apiKeyConnection = await clientManager.connectToServer(apiKeyConfig);
    console.log(`✅ API key connection: ${apiKeyConnection.connected}\n`);

    // Test 9: Test environment variable expansion
    console.log('🔟 Test: Environment variable expansion');
    process.env.TEST_HTTP_TOKEN = 'env-token-value';
    
    const envConfig: MCPServerConfig = {
      id: 'test-http-env',
      name: 'Test HTTP Env',
      transport: 'http',
      url: mockServer.getUrl(),
      auth: {
        type: 'bearer',
        token: '${TEST_HTTP_TOKEN}'
      },
      enabled: true
    };

    const envConnection = await clientManager.connectToServer(envConfig);
    console.log(`✅ Env var expansion: ${envConnection.connected}\n`);

    delete process.env.TEST_HTTP_TOKEN;

    // Cleanup
    console.log('🧹 Cleaning up...');
    await clientManager.disconnectAll();
    await mockServer.stop();

    console.log('\n✅ All tests passed!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    await clientManager.disconnectAll();
    await mockServer.stop();
    process.exit(1);
  }
}

runTests();
