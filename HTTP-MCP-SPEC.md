# HTTP MCP Server Support Specification

## Overview

This specification extends the AI Effort Regulation system to support remote MCP servers via HTTP/HTTPS transport, in addition to the existing STDIO transport. This enables integration with MCP servers running on remote machines, cloud services, or containerized environments.

## Goals

1. **Remote Server Support**: Connect to MCP servers via HTTP/HTTPS
2. **Transport Abstraction**: Unified interface for both STDIO and HTTP transports
3. **Authentication**: Support API key and bearer token authentication
4. **Connection Management**: Handle timeouts, retries, and connection pooling
5. **Security**: TLS/SSL support, certificate validation
6. **Backward Compatibility**: Existing STDIO servers continue to work unchanged

## Architecture

### Transport Layer Abstraction

```
┌─────────────────────────────────────────┐
│         MCPClientManager                │
│  (Transport-agnostic interface)         │
└─────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
┌───────▼──────┐  ┌──────▼───────┐
│ STDIO        │  │ HTTP         │
│ Transport    │  │ Transport    │
└──────────────┘  └──────────────┘
        │                 │
┌───────▼──────┐  ┌──────▼───────┐
│ Local        │  │ Remote       │
│ Process      │  │ HTTP Server  │
└──────────────┘  └──────────────┘
```

## Configuration Schema

### Server Configuration

```typescript
interface MCPServerConfig {
  id: string;
  name: string;
  enabled: boolean;
  
  // Transport type
  transport: 'stdio' | 'http';
  
  // STDIO-specific config
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  
  // HTTP-specific config
  url?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  
  // Authentication
  auth?: {
    type: 'none' | 'apikey' | 'bearer';
    apiKey?: string;
    token?: string;
    headerName?: string; // Default: 'Authorization'
  };
  
  // TLS/SSL
  tls?: {
    rejectUnauthorized?: boolean; // Default: true
    ca?: string; // Path to CA certificate
    cert?: string; // Path to client certificate
    key?: string; // Path to client key
  };
}
```

### Example Configurations

#### STDIO Server (Existing)
```json
{
  "id": "filesystem-local",
  "name": "Local Filesystem",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "./data"],
  "enabled": true
}
```

#### HTTP Server (New)
```json
{
  "id": "github-remote",
  "name": "Remote GitHub Server",
  "transport": "http",
  "url": "https://mcp.example.com/github",
  "timeout": 30000,
  "retries": 3,
  "auth": {
    "type": "bearer",
    "token": "${GITHUB_MCP_TOKEN}"
  },
  "enabled": true
}
```

#### HTTP Server with API Key
```json
{
  "id": "weather-api",
  "name": "Weather API Server",
  "transport": "http",
  "url": "http://localhost:8080/mcp",
  "auth": {
    "type": "apikey",
    "apiKey": "${WEATHER_API_KEY}",
    "headerName": "X-API-Key"
  },
  "enabled": true
}
```

## HTTP Transport Protocol

### MCP over HTTP

The HTTP transport implements the MCP protocol over HTTP using JSON-RPC 2.0.

#### Request Format

```http
POST /mcp HTTP/1.1
Host: mcp.example.com
Content-Type: application/json
Authorization: Bearer <token>

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

#### Response Format

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "read_file",
        "description": "Read a file",
        "inputSchema": {
          "type": "object",
          "properties": {
            "path": {"type": "string"}
          }
        }
      }
    ]
  }
}
```

### Supported MCP Methods

1. **initialize**: Handshake and capability negotiation
2. **tools/list**: List available tools
3. **tools/call**: Invoke a tool
4. **resources/list**: List available resources (optional)
5. **resources/read**: Read a resource (optional)
6. **prompts/list**: List available prompts (optional)
7. **prompts/get**: Get a prompt (optional)

## Implementation Components

### 1. HTTP Transport Client

**File**: `src/mcp-http-transport.ts`

```typescript
export class HTTPTransport {
  private baseUrl: string;
  private headers: Record<string, string>;
  private timeout: number;
  private retries: number;
  private requestId: number = 0;

  constructor(config: HTTPTransportConfig) {
    this.baseUrl = config.url;
    this.headers = this.buildHeaders(config);
    this.timeout = config.timeout || 30000;
    this.retries = config.retries || 3;
  }

  async request(method: string, params: any): Promise<any> {
    const payload = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params
    };

    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const response = await this.httpRequest(payload);
        return response.result;
      } catch (error) {
        if (attempt === this.retries) throw error;
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
  }

  private async httpRequest(payload: any): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`MCP Error: ${data.error.message}`);
      }

      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private buildHeaders(config: HTTPTransportConfig): Record<string, string> {
    const headers: Record<string, string> = {};

    if (config.headers) {
      Object.assign(headers, config.headers);
    }

    if (config.auth) {
      switch (config.auth.type) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${config.auth.token}`;
          break;
        case 'apikey':
          const headerName = config.auth.headerName || 'X-API-Key';
          headers[headerName] = config.auth.apiKey!;
          break;
      }
    }

    return headers;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close(): Promise<void> {
    // No persistent connection to close for HTTP
  }
}
```

### 2. Transport Factory

**File**: `src/mcp-transport-factory.ts`

```typescript
export class TransportFactory {
  static async create(config: MCPServerConfig): Promise<Transport> {
    switch (config.transport) {
      case 'stdio':
        return new StdioTransport(config);
      case 'http':
        return new HTTPTransport(config);
      default:
        throw new Error(`Unsupported transport: ${config.transport}`);
    }
  }
}
```

### 3. Updated MCP Client Manager

**File**: `src/mcp-client.ts` (modifications)

```typescript
export class MCPClientManager {
  async connectToServer(config: MCPServerConfig): Promise<ServerConnection> {
    try {
      // Create appropriate transport
      const transport = await TransportFactory.create(config);

      // Initialize MCP session
      const initResult = await transport.request('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'ai-effort-regulation',
          version: '1.0.0'
        }
      });

      // List available tools
      const toolsResult = await transport.request('tools/list', {});
      const tools: MCPTool[] = (toolsResult.tools || []).map((tool: any) => ({
        name: tool.name,
        description: tool.description || '',
        serverId: config.id,
        serverName: config.name,
        inputSchema: tool.inputSchema || {}
      }));

      const connection: ServerConnection = {
        config,
        transport,
        tools,
        connected: true,
        lastPing: new Date()
      };

      this.connections.set(config.id, connection);
      return connection;
    } catch (error) {
      throw new Error(`Failed to connect to server ${config.id}: ${error}`);
    }
  }

  async callTool(serverId: string, toolName: string, args: any): Promise<any> {
    const connection = this.connections.get(serverId);
    if (!connection || !connection.connected) {
      throw new Error(`Server ${serverId} not connected`);
    }

    const result = await connection.transport.request('tools/call', {
      name: toolName,
      arguments: args
    });

    return result;
  }
}
```

### 4. Configuration Loader

**File**: `src/mcp-config.ts` (modifications)

Add environment variable expansion for sensitive values:

```typescript
function expandEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, varName) => {
    return process.env[varName] || '';
  });
}

function processConfig(config: MCPServerConfig): MCPServerConfig {
  const processed = { ...config };

  // Expand environment variables in auth
  if (processed.auth?.apiKey) {
    processed.auth.apiKey = expandEnvVars(processed.auth.apiKey);
  }
  if (processed.auth?.token) {
    processed.auth.token = expandEnvVars(processed.auth.token);
  }

  // Expand in URL
  if (processed.url) {
    processed.url = expandEnvVars(processed.url);
  }

  return processed;
}
```

## Connection Management

### Health Checks

Implement periodic health checks for HTTP servers:

```typescript
async testConnection(serverId: string): Promise<boolean> {
  const connection = this.connections.get(serverId);
  if (!connection || !connection.connected) {
    return false;
  }

  try {
    // Ping by listing tools
    await connection.transport.request('tools/list', {});
    connection.lastPing = new Date();
    return true;
  } catch (error) {
    console.error(`Health check failed for ${serverId}:`, error);
    connection.connected = false;
    return false;
  }
}
```

### Automatic Reconnection

```typescript
async reconnect(serverId: string): Promise<boolean> {
  const connection = this.connections.get(serverId);
  if (!connection) return false;

  try {
    await this.disconnectServer(serverId);
    await this.connectToServer(connection.config);
    return true;
  } catch (error) {
    console.error(`Reconnection failed for ${serverId}:`, error);
    return false;
  }
}
```

## Security Considerations

### 1. TLS/SSL Validation

- Default: Reject unauthorized certificates
- Option to disable for development (not recommended for production)
- Support custom CA certificates

### 2. Authentication

- Support multiple auth methods (none, API key, bearer token)
- Store credentials in environment variables
- Never log credentials

### 3. Timeout Protection

- Default timeout: 30 seconds
- Configurable per server
- Prevent hanging connections

### 4. Rate Limiting

- Implement client-side rate limiting
- Respect server rate limit headers
- Exponential backoff on errors

## Testing Strategy

### Unit Tests

**File**: `test/mcp-http-transport.test.ts`

1. **HTTP Request/Response**
   - Test successful requests
   - Test error responses
   - Test timeout handling
   - Test retry logic

2. **Authentication**
   - Test bearer token auth
   - Test API key auth
   - Test header construction

3. **Connection Management**
   - Test connection establishment
   - Test health checks
   - Test reconnection

### Integration Tests

**File**: `test/mcp-http-integration.test.ts`

1. **Mock HTTP Server**
   - Create simple HTTP MCP server for testing
   - Test tool discovery
   - Test tool invocation
   - Test error scenarios

2. **End-to-End**
   - Start mock HTTP server
   - Connect from client
   - Invoke tools
   - Verify results

### Mock HTTP MCP Server

**File**: `test/mock-http-mcp-server.ts`

```typescript
import express from 'express';

export class MockHTTPMCPServer {
  private app = express();
  private server: any;
  private port: number;

  constructor(port: number = 8765) {
    this.port = port;
    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.use(express.json());

    this.app.post('/mcp', (req, res) => {
      const { method, params, id } = req.body;

      switch (method) {
        case 'initialize':
          res.json({
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              serverInfo: {
                name: 'mock-server',
                version: '1.0.0'
              }
            }
          });
          break;

        case 'tools/list':
          res.json({
            jsonrpc: '2.0',
            id,
            result: {
              tools: [
                {
                  name: 'echo',
                  description: 'Echo back the input',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' }
                    }
                  }
                }
              ]
            }
          });
          break;

        case 'tools/call':
          if (params.name === 'echo') {
            res.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: params.arguments.message
                  }
                ]
              }
            });
          } else {
            res.json({
              jsonrpc: '2.0',
              id,
              error: {
                code: -32601,
                message: 'Tool not found'
              }
            });
          }
          break;

        default:
          res.json({
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: 'Method not found'
            }
          });
      }
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`Mock HTTP MCP server listening on port ${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Mock HTTP MCP server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
```

## Example Usage

### Configuration File

**File**: `mcp-servers.json`

```json
{
  "servers": [
    {
      "id": "filesystem-local",
      "name": "Local Filesystem",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./data"],
      "enabled": true
    },
    {
      "id": "github-remote",
      "name": "Remote GitHub",
      "transport": "http",
      "url": "https://mcp-api.example.com/github",
      "timeout": 30000,
      "auth": {
        "type": "bearer",
        "token": "${GITHUB_MCP_TOKEN}"
      },
      "enabled": true
    },
    {
      "id": "weather-local",
      "name": "Local Weather API",
      "transport": "http",
      "url": "http://localhost:8080/mcp",
      "auth": {
        "type": "apikey",
        "apiKey": "${WEATHER_API_KEY}",
        "headerName": "X-API-Key"
      },
      "enabled": true
    }
  ]
}
```

### Environment Variables

```bash
export GITHUB_MCP_TOKEN="ghp_xxxxxxxxxxxx"
export WEATHER_API_KEY="sk_xxxxxxxxxxxx"
```

## Success Criteria

1. ✅ Can connect to HTTP MCP servers
2. ✅ Can discover tools from HTTP servers
3. ✅ Can invoke tools on HTTP servers
4. ✅ Authentication works (bearer, API key)
5. ✅ Timeout and retry logic works
6. ✅ Health checks detect failures
7. ✅ Automatic reconnection works
8. ✅ STDIO servers continue to work
9. ✅ Unit tests pass
10. ✅ Integration tests pass

## Migration Guide

### For Existing Installations

1. **No changes required** for existing STDIO servers
2. **Optional**: Add HTTP servers to configuration
3. **Optional**: Set environment variables for credentials

### Adding HTTP Server

```json
{
  "id": "my-http-server",
  "name": "My HTTP Server",
  "transport": "http",
  "url": "http://localhost:8080/mcp",
  "enabled": true
}
```

## Future Enhancements

1. **WebSocket Transport**: Real-time bidirectional communication
2. **Server Discovery**: Auto-discover HTTP servers via mDNS/DNS-SD
3. **Load Balancing**: Distribute requests across multiple server instances
4. **Caching**: Cache tool lists and responses
5. **Metrics**: Track latency, success rates, error rates
6. **Circuit Breaker**: Prevent cascading failures

## References

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [JSON-RPC 2.0](https://www.jsonrpc.org/specification)
- [HTTP/1.1 RFC](https://tools.ietf.org/html/rfc2616)
- [TLS Best Practices](https://wiki.mozilla.org/Security/Server_Side_TLS)
