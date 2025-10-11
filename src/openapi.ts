import swaggerJsdoc from 'swagger-jsdoc';

/**
 * OpenAPI configuration that generates spec from JSDoc comments in server.ts
 * This avoids duplicating type definitions - types are defined once in TypeScript
 * and documented once in JSDoc comments on the actual endpoints.
 */
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
        url: 'http://localhost:{port}',
        description: 'Development server',
        variables: {
          port: {
            default: '6740',
            description: 'Server port'
          }
        }
      }
    ],
    tags: [
      { name: 'Messages', description: 'Send messages to the AI system' },
      { name: 'Conversations', description: 'Manage conversations' },
      { name: 'Apps', description: 'Manage installed applications' },
      { name: 'Memory', description: 'Memory management' },
      { name: 'System', description: 'System health and statistics' }
    ],
    components: {
      schemas: {
        // Minimal schema definitions - detailed schemas are in JSDoc comments
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      responses: {
        BadRequest: {
          description: 'Invalid input',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        Unauthorized: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        RateLimitExceeded: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string' },
                  message: { type: 'string' },
                  retryAfter: { type: 'string' }
                }
              }
            }
          }
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      }
    }
  },
  // Scan server.ts for JSDoc comments
  apis: ['./src/server.ts']
};

export const swaggerSpec = swaggerJsdoc(options);
