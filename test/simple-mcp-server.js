#!/usr/bin/env node

/**
 * Simple MCP server for testing
 * Provides a few basic tools to verify MCP integration works
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Create server
const server = new Server({
  name: 'test-server',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'echo',
        description: 'Returns the input message',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Message to echo back'
            }
          },
          required: ['message']
        }
      },
      {
        name: 'add',
        description: 'Adds two numbers',
        inputSchema: {
          type: 'object',
          properties: {
            a: {
              type: 'number',
              description: 'First number'
            },
            b: {
              type: 'number',
              description: 'Second number'
            }
          },
          required: ['a', 'b']
        }
      },
      {
        name: 'get_time',
        description: 'Returns current timestamp',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'echo':
      return {
        content: [
          {
            type: 'text',
            text: args.message
          }
        ]
      };

    case 'add':
      const sum = args.a + args.b;
      return {
        content: [
          {
            type: 'text',
            text: `${args.a} + ${args.b} = ${sum}`
          }
        ]
      };

    case 'get_time':
      return {
        content: [
          {
            type: 'text',
            text: new Date().toISOString()
          }
        ]
      };

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Test MCP server started'); // Log to stderr (stdout is for MCP protocol)
}

main().catch(error => {
  console.error('Server error:', error);
  process.exit(1);
});
