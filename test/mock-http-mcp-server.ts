import express from 'express';
import { Server } from 'http';

export class MockHTTPMCPServer {
  private app = express();
  private server?: Server;
  private port: number;

  constructor(port: number = 8765) {
    this.port = port;
    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.use(express.json());

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    // Main MCP endpoint
    this.app.post('/mcp', (req, res) => {
      const { method, params, id } = req.body;

      // Check authentication if required
      const authHeader = req.headers['authorization'];
      const apiKeyHeader = req.headers['x-api-key'];

      console.log(`[Mock MCP] Received request: ${method}`);

      switch (method) {
        case 'initialize':
          res.json({
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: {
                tools: {}
              },
              serverInfo: {
                name: 'mock-http-mcp-server',
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
                  description: 'Echo back the input message',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      message: {
                        type: 'string',
                        description: 'Message to echo'
                      }
                    },
                    required: ['message']
                  }
                },
                {
                  name: 'add',
                  description: 'Add two numbers',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      a: { type: 'number' },
                      b: { type: 'number' }
                    },
                    required: ['a', 'b']
                  }
                },
                {
                  name: 'get_time',
                  description: 'Get current server time',
                  inputSchema: {
                    type: 'object',
                    properties: {}
                  }
                }
              ]
            }
          });
          break;

        case 'tools/call':
          const toolName = params.name;
          const toolArgs = params.arguments || {};

          if (toolName === 'echo') {
            res.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: toolArgs.message || 'No message provided'
                  }
                ]
              }
            });
          } else if (toolName === 'add') {
            const sum = (toolArgs.a || 0) + (toolArgs.b || 0);
            res.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: `The sum of ${toolArgs.a} and ${toolArgs.b} is ${sum}`
                  }
                ]
              }
            });
          } else if (toolName === 'get_time') {
            res.json({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: new Date().toISOString()
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
                message: `Tool not found: ${toolName}`
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
              message: `Method not found: ${method}`
            }
          });
      }
    });

    // Error handler
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('[Mock MCP] Error:', err);
      res.status(500).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: 'Internal server error'
        }
      });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          console.log(`✅ Mock HTTP MCP server listening on port ${this.port}`);
          resolve();
        });

        this.server.on('error', (error: any) => {
          if (error.code === 'EADDRINUSE') {
            console.error(`❌ Port ${this.port} is already in use`);
          }
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('✅ Mock HTTP MCP server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getPort(): number {
    return this.port;
  }

  getUrl(): string {
    return `http://localhost:${this.port}/mcp`;
  }
}

// Allow running standalone
if (require.main === module) {
  const port = parseInt(process.argv[2] || '8765');
  const server = new MockHTTPMCPServer(port);
  
  server.start().then(() => {
    console.log(`Mock HTTP MCP Server running on port ${port}`);
    console.log(`URL: ${server.getUrl()}`);
    console.log('Press Ctrl+C to stop');
  }).catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await server.stop();
    process.exit(0);
  });
}
