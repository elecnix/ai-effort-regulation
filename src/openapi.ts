import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI Effort Regulation API',
      version: '1.0.0',
      description: 'API for the AI Effort Regulation system with energy-aware cognitive processing',
      contact: {
        name: 'API Support',
        url: 'https://github.com/elecnix/ai-effort-regulation'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:6740',
        description: 'Development server'
      }
    ],
    tags: [
      {
        name: 'Messages',
        description: 'Send messages to the AI system'
      },
      {
        name: 'Conversations',
        description: 'Manage conversations'
      },
      {
        name: 'Apps',
        description: 'Manage installed applications'
      },
      {
        name: 'Memory',
        description: 'Memory management'
      },
      {
        name: 'System',
        description: 'System health and statistics'
      }
    ],
    components: {
      schemas: {
        Message: {
          type: 'object',
          required: ['content'],
          properties: {
            content: {
              type: 'string',
              description: 'The message content',
              maxLength: 10000
            },
            id: {
              type: 'string',
              description: 'Optional message ID (auto-generated if not provided)'
            },
            energyBudget: {
              type: 'number',
              description: 'Optional energy budget for this message',
              nullable: true
            }
          }
        },
        Conversation: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Conversation ID'
            },
            requestMessage: {
              type: 'string',
              description: 'The initial request message'
            },
            responseMessages: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'List of response messages'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Conversation creation timestamp'
            },
            ended: {
              type: 'boolean',
              description: 'Whether the conversation has ended'
            }
          }
        },
        App: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'App ID'
            },
            name: {
              type: 'string',
              description: 'App name'
            },
            description: {
              type: 'string',
              description: 'App description'
            },
            type: {
              type: 'string',
              enum: ['in-process', 'http'],
              description: 'App type'
            },
            enabled: {
              type: 'boolean',
              description: 'Whether the app is enabled'
            }
          }
        },
        Memory: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Memory ID'
            },
            content: {
              type: 'string',
              description: 'Memory content'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            },
            sourceConversationId: {
              type: 'string',
              description: 'Source conversation ID',
              nullable: true
            }
          }
        },
        Health: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['ok', 'warning', 'degraded', 'unhealthy'],
              description: 'Overall system status'
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            },
            uptime: {
              type: 'integer',
              description: 'System uptime in seconds'
            },
            version: {
              type: 'string'
            },
            environment: {
              type: 'string'
            },
            memory: {
              type: 'object',
              properties: {
                heapUsed: {
                  type: 'integer',
                  description: 'Heap memory used in MB'
                },
                heapTotal: {
                  type: 'integer',
                  description: 'Total heap memory in MB'
                },
                percentUsed: {
                  type: 'integer',
                  description: 'Percentage of heap used'
                }
              }
            },
            energy: {
              type: 'object',
              properties: {
                current: {
                  type: 'number',
                  description: 'Current energy level'
                },
                percentage: {
                  type: 'integer',
                  description: 'Energy percentage (0-100)'
                },
                status: {
                  type: 'string',
                  description: 'Energy status'
                }
              }
            },
            database: {
              type: 'object',
              properties: {
                connected: {
                  type: 'boolean'
                },
                error: {
                  type: 'string',
                  nullable: true
                }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            },
            details: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Detailed error information'
            }
          }
        }
      }
    }
  },
  apis: ['./src/server.ts'] // Path to the API docs
};

export const swaggerSpec = swaggerJsdoc(options);
