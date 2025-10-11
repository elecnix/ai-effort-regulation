import { HTTPTransport } from '../src/mcp-http-transport';
import { MockHTTPMCPServer } from './mock-http-mcp-server';

describe('HTTP MCP Transport', () => {
  let mockServer: MockHTTPMCPServer;
  let transport: HTTPTransport;

  beforeAll(async () => {
    // Start mock HTTP MCP server
    mockServer = new MockHTTPMCPServer(8765);
    await mockServer.start();
  });

  afterAll(async () => {
    // Stop mock server
    await mockServer.stop();
  });

  afterEach(async () => {
    // Clean up transport
    if (transport) {
      await transport.close();
    }
  });

  test('should connect and initialize', async () => {
    transport = new HTTPTransport({
      url: mockServer.getUrl()
    });

    const result = await transport.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'test-client',
        version: '1.0.0'
      }
    });

    expect(result).toBeDefined();
    expect(result.protocolVersion).toBe('2024-11-05');
    expect(result.serverInfo.name).toBe('mock-http-mcp-server');
  });

  test('should list tools', async () => {
    transport = new HTTPTransport({
      url: mockServer.getUrl()
    });

    const result = await transport.request('tools/list', {});

    expect(result).toBeDefined();
    expect(result.tools).toBeInstanceOf(Array);
    expect(result.tools.length).toBeGreaterThan(0);
    
    const echoTool = result.tools.find((t: any) => t.name === 'echo');
    expect(echoTool).toBeDefined();
    expect(echoTool.description).toContain('Echo');
  });

  test('should call echo tool', async () => {
    transport = new HTTPTransport({
      url: mockServer.getUrl()
    });

    const result = await transport.request('tools/call', {
      name: 'echo',
      arguments: {
        message: 'Hello, MCP!'
      }
    });

    expect(result).toBeDefined();
    expect(result.content).toBeInstanceOf(Array);
    expect(result.content[0].text).toBe('Hello, MCP!');
  });

  test('should call add tool', async () => {
    transport = new HTTPTransport({
      url: mockServer.getUrl()
    });

    const result = await transport.request('tools/call', {
      name: 'add',
      arguments: {
        a: 5,
        b: 3
      }
    });

    expect(result).toBeDefined();
    expect(result.content[0].text).toContain('8');
  });

  test('should handle tool not found error', async () => {
    transport = new HTTPTransport({
      url: mockServer.getUrl()
    });

    await expect(
      transport.request('tools/call', {
        name: 'nonexistent_tool',
        arguments: {}
      })
    ).rejects.toThrow('Tool not found');
  });

  test('should handle connection timeout', async () => {
    transport = new HTTPTransport({
      url: 'http://localhost:9999/mcp', // Non-existent server
      timeout: 1000,
      retries: 1
    });

    await expect(
      transport.request('initialize', {})
    ).rejects.toThrow();
  }, 10000);

  test('should retry on failure', async () => {
    transport = new HTTPTransport({
      url: mockServer.getUrl(),
      retries: 3
    });

    // This should succeed after retries
    const result = await transport.request('tools/list', {});
    expect(result.tools).toBeDefined();
  });

  test('should support bearer token authentication', async () => {
    transport = new HTTPTransport({
      url: mockServer.getUrl(),
      auth: {
        type: 'bearer',
        token: 'test-token-123'
      }
    });

    const result = await transport.request('tools/list', {});
    expect(result.tools).toBeDefined();
  });

  test('should support API key authentication', async () => {
    transport = new HTTPTransport({
      url: mockServer.getUrl(),
      auth: {
        type: 'apikey',
        apiKey: 'test-api-key-456',
        headerName: 'X-API-Key'
      }
    });

    const result = await transport.request('tools/list', {});
    expect(result.tools).toBeDefined();
  });

  test('should support custom headers', async () => {
    transport = new HTTPTransport({
      url: mockServer.getUrl(),
      headers: {
        'X-Custom-Header': 'custom-value'
      }
    });

    const result = await transport.request('tools/list', {});
    expect(result.tools).toBeDefined();
  });
});
