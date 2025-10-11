import { MCPClientManager } from '../src/mcp-client';
import { MockHTTPMCPServer } from './mock-http-mcp-server';
import { MCPServerConfig } from '../src/mcp-subagent-types';

describe('HTTP MCP Integration', () => {
  let mockServer: MockHTTPMCPServer;
  let clientManager: MCPClientManager;

  beforeAll(async () => {
    // Start mock HTTP MCP server
    mockServer = new MockHTTPMCPServer(8766);
    await mockServer.start();
    
    // Create client manager
    clientManager = new MCPClientManager();
  });

  afterAll(async () => {
    // Disconnect all clients
    await clientManager.disconnectAll();
    
    // Stop mock server
    await mockServer.stop();
  });

  test('should connect to HTTP MCP server', async () => {
    const config: MCPServerConfig = {
      id: 'test-http-server',
      name: 'Test HTTP Server',
      transport: 'http',
      url: mockServer.getUrl(),
      enabled: true
    };

    const connection = await clientManager.connectToServer(config);

    expect(connection).toBeDefined();
    expect(connection.connected).toBe(true);
    expect(connection.tools.length).toBeGreaterThan(0);
  });

  test('should discover tools from HTTP server', async () => {
    const config: MCPServerConfig = {
      id: 'test-http-tools',
      name: 'Test HTTP Tools',
      transport: 'http',
      url: mockServer.getUrl(),
      enabled: true
    };

    const connection = await clientManager.connectToServer(config);

    const echoTool = connection.tools.find(t => t.name === 'echo');
    expect(echoTool).toBeDefined();
    expect(echoTool?.description).toContain('Echo');
    expect(echoTool?.serverId).toBe('test-http-tools');

    const addTool = connection.tools.find(t => t.name === 'add');
    expect(addTool).toBeDefined();
    expect(addTool?.description).toContain('Add');
  });

  test('should call tool on HTTP server', async () => {
    const config: MCPServerConfig = {
      id: 'test-http-call',
      name: 'Test HTTP Call',
      transport: 'http',
      url: mockServer.getUrl(),
      enabled: true
    };

    await clientManager.connectToServer(config);

    const result = await clientManager.callTool('test-http-call', 'echo', {
      message: 'Integration test message'
    });

    expect(result).toBeDefined();
    expect(result.content[0].text).toBe('Integration test message');
  });

  test('should call add tool on HTTP server', async () => {
    const config: MCPServerConfig = {
      id: 'test-http-add',
      name: 'Test HTTP Add',
      transport: 'http',
      url: mockServer.getUrl(),
      enabled: true
    };

    await clientManager.connectToServer(config);

    const result = await clientManager.callTool('test-http-add', 'add', {
      a: 10,
      b: 20
    });

    expect(result).toBeDefined();
    expect(result.content[0].text).toContain('30');
  });

  test('should test HTTP connection health', async () => {
    const config: MCPServerConfig = {
      id: 'test-http-health',
      name: 'Test HTTP Health',
      transport: 'http',
      url: mockServer.getUrl(),
      enabled: true
    };

    await clientManager.connectToServer(config);

    const isHealthy = await clientManager.testConnection('test-http-health');
    expect(isHealthy).toBe(true);
  });

  test('should handle disconnection', async () => {
    const config: MCPServerConfig = {
      id: 'test-http-disconnect',
      name: 'Test HTTP Disconnect',
      transport: 'http',
      url: mockServer.getUrl(),
      enabled: true
    };

    await clientManager.connectToServer(config);
    expect(clientManager.isConnected('test-http-disconnect')).toBe(true);

    await clientManager.disconnectServer('test-http-disconnect');
    expect(clientManager.isConnected('test-http-disconnect')).toBe(false);
  });

  test('should support authentication with bearer token', async () => {
    const config: MCPServerConfig = {
      id: 'test-http-bearer',
      name: 'Test HTTP Bearer',
      transport: 'http',
      url: mockServer.getUrl(),
      auth: {
        type: 'bearer',
        token: 'test-bearer-token'
      },
      enabled: true
    };

    const connection = await clientManager.connectToServer(config);
    expect(connection.connected).toBe(true);
  });

  test('should support authentication with API key', async () => {
    const config: MCPServerConfig = {
      id: 'test-http-apikey',
      name: 'Test HTTP API Key',
      transport: 'http',
      url: mockServer.getUrl(),
      auth: {
        type: 'apikey',
        apiKey: 'test-api-key',
        headerName: 'X-API-Key'
      },
      enabled: true
    };

    const connection = await clientManager.connectToServer(config);
    expect(connection.connected).toBe(true);
  });

  test('should expand environment variables in config', async () => {
    // Set test environment variable
    process.env.TEST_MCP_TOKEN = 'env-token-value';

    const config: MCPServerConfig = {
      id: 'test-http-env',
      name: 'Test HTTP Env',
      transport: 'http',
      url: mockServer.getUrl(),
      auth: {
        type: 'bearer',
        token: '${TEST_MCP_TOKEN}'
      },
      enabled: true
    };

    const connection = await clientManager.connectToServer(config);
    expect(connection.connected).toBe(true);

    // Clean up
    delete process.env.TEST_MCP_TOKEN;
  });

  test('should handle connection failure gracefully', async () => {
    const config: MCPServerConfig = {
      id: 'test-http-fail',
      name: 'Test HTTP Fail',
      transport: 'http',
      url: 'http://localhost:9999/mcp', // Non-existent server
      timeout: 1000,
      retries: 1,
      enabled: true
    };

    await expect(
      clientManager.connectToServer(config)
    ).rejects.toThrow();
  }, 10000);

  test('should support multiple concurrent connections', async () => {
    const config1: MCPServerConfig = {
      id: 'test-http-multi-1',
      name: 'Test HTTP Multi 1',
      transport: 'http',
      url: mockServer.getUrl(),
      enabled: true
    };

    const config2: MCPServerConfig = {
      id: 'test-http-multi-2',
      name: 'Test HTTP Multi 2',
      transport: 'http',
      url: mockServer.getUrl(),
      enabled: true
    };

    await Promise.all([
      clientManager.connectToServer(config1),
      clientManager.connectToServer(config2)
    ]);

    expect(clientManager.isConnected('test-http-multi-1')).toBe(true);
    expect(clientManager.isConnected('test-http-multi-2')).toBe(true);

    const connections = clientManager.getAllConnections();
    expect(connections.length).toBeGreaterThanOrEqual(2);
  });
});
