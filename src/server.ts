import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { Inbox } from './inbox';
// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

import { AppRegistry, ChatApp } from './apps';

// Extend global type for sensitiveLoop
declare global {
  var sensitiveLoop: {
    inbox: Inbox;
    getAppRegistry(): AppRegistry;
    getChatApp(): ChatApp;
    [key: string]: any;
  } | undefined;
}

const app = express();
const DEFAULT_PORT = parseInt(process.env.PORT || '6740');
const MAX_MESSAGE_LENGTH = parseInt(process.env.MAX_MESSAGE_LENGTH || '10000');

// Security: Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: 60,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: 60
    });
  },
});

// Apply rate limiting to all requests
app.use(limiter);

// CORS support for web clients
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));

// Message queue for the sensitive loop
export interface Message {
  id: string;
  content: string;  // user message
  timestamp: Date;
  energyBudget?: number | null;  // optional energy budget
}

export const messageQueue: Message[] = [];

app.post('/message', async function(req: express.Request, res: express.Response): Promise<void> {
  try {
    const { content, id, energyBudget } = req.body;

    // Input validation
    if (!content || typeof content !== 'string') {
      res.status(400).json({
        error: 'Content is required and must be a string'
      });
      return;
    }

    if (content.trim().length === 0) {
      res.status(400).json({
        error: 'Content cannot be empty'
      });
      return;
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({
        error: `Content too long. Maximum length is ${MAX_MESSAGE_LENGTH} characters`
      });
      return;
    }

    // Validate energyBudget if provided
    if (energyBudget !== undefined && energyBudget !== null) {
      if (typeof energyBudget !== 'number' || isNaN(energyBudget) || energyBudget < 0) {
        res.status(400).json({
          error: 'energyBudget must be a non-negative number'
        });
        return;
      }
    }

    // Sanitize input (basic XSS prevention)
    const sanitizedContent = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    const messageId = id || uuidv4();

    // Validate message ID format if provided
    if (id && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(messageId)) {
      res.status(400).json({
        error: 'Invalid message ID format. Must be a valid UUID.'
      });
      return;
    }

    const message: Message = {
      id: messageId,
      content: sanitizedContent,
      timestamp: new Date(),
      energyBudget: energyBudget !== undefined ? energyBudget : null
    };

    // Route through chat app
    const globalLoop = global.sensitiveLoop;
    if (globalLoop) {
      const chatApp = globalLoop.getChatApp();
      await chatApp.handleUserMessage(messageId, sanitizedContent, message.energyBudget);
      
      // Also add to in-memory pending messages so the loop detects it
      globalLoop.inbox.addMessage(message);
    }

    const budgetInfo = energyBudget !== undefined && energyBudget !== null ? ` [Budget: ${energyBudget}]` : '';
    console.log(`📨 Received: "${sanitizedContent.substring(0, 200)}${sanitizedContent.length > 200 ? '...' : ''}"${budgetInfo}`);

    res.json({
      status: 'received',
      requestId: messageId,
      timestamp: message.timestamp.toISOString()
    });

  } catch (error) {
    console.error('Error processing message request:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
    return;
  }
});

// Validation helpers
function validateLimit(limit: any): number {
  const parsed = parseInt(limit);
  if (isNaN(parsed) || parsed < 0) {
    return 10; // default
  }
  return Math.min(parsed, 100); // max 100
}

function validateState(state: any): string | undefined {
  if (!state) return undefined;
  const validStates = ['active', 'ended', 'snoozed'];
  if (validStates.includes(state)) {
    return state;
  }
  throw new Error(`Invalid state. Must be one of: ${validStates.join(', ')}`);
}

function validateBudgetStatus(status: any): string | undefined {
  if (!status) return undefined;
  const validStatuses = ['within', 'exceeded', 'depleted'];
  if (validStatuses.includes(status)) {
    return status;
  }
  throw new Error(`Invalid budgetStatus. Must be one of: ${validStatuses.join(', ')}`);
}

// New endpoints for conversation data
app.get('/conversations', function(req: express.Request, res: express.Response): void {
  try {
    // Validate query parameters
    const limit = validateLimit(req.query.limit);
    let state: string | undefined;
    let budgetStatus: string | undefined;
    
    try {
      state = validateState(req.query.state);
      budgetStatus = validateBudgetStatus(req.query.budgetStatus);
    } catch (error) {
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Invalid parameter'
      });
      return;
    }
    
    const globalLoop = global.sensitiveLoop;
    const conversations = globalLoop && globalLoop.inbox ? globalLoop.inbox.getRecentCompletedConversations(limit) : [];

    let filteredConversations = conversations;

    // Filter by state if provided
    if (state) {
      filteredConversations = filteredConversations.filter(conv => {
        if (state === 'active') return !conv.ended;
        if (state === 'ended') return conv.ended === true;
        if (state === 'snoozed') return false; // TODO: implement snooze detection
        return true;
      });
    }

    // Filter by budget status if provided
    if (budgetStatus) {
      filteredConversations = filteredConversations.filter(conv => 
        conv.metadata.budgetStatus === budgetStatus
      );
    }

    // Format conversations with energy consumption info
    const formattedConversations = filteredConversations.map(conv => ({
      id: conv.requestId,
      requestMessage: conv.inputMessage,
      responseMessages: conv.responses.map(r => r.content),
      timestamp: new Date(),
      energyConsumed: conv.metadata.totalEnergyConsumed,
      responseCount: conv.responses.length,
      ended: conv.ended,
      endedReason: conv.endedReason,
      budgetStatus: conv.metadata.budgetStatus,
      energyBudget: conv.metadata.energyBudget
    }));

    res.json({
      conversations: formattedConversations,
      total: formattedConversations.length,
      filters: { state, budgetStatus }
    });
  } catch (error) {
    console.error('Error retrieving recent conversations:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

app.get('/stats', function(req: express.Request, res: express.Response): void {
  try {
    const globalLoop = global.sensitiveLoop;
    const stats = globalLoop && globalLoop.inbox ? globalLoop.inbox.getConversationStats() : null;

    if (!stats) {
      res.status(500).json({ error: 'Unable to retrieve statistics' });
      return;
    }

    res.json(stats);
  } catch (error) {
    console.error('Error retrieving conversation stats:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

app.get('/conversations/:requestId', function(req: express.Request, res: express.Response): void {
  try {
    const { requestId } = req.params;
    if (!requestId) {
      res.status(400).json({ error: 'requestId parameter is required' });
      return;
    }
    const globalLoop = global.sensitiveLoop;
    const conversation = globalLoop && globalLoop.inbox ? globalLoop.inbox.getConversation(requestId) : null;

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    res.json(conversation);
  } catch (error) {
    console.error('Error retrieving conversation:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// App management endpoints
app.get('/apps', async (req, res) => {
  try {
    const globalLoop = global.sensitiveLoop;
    const registry = globalLoop?.getAppRegistry();
    
    if (!registry) {
      res.status(500).json({ error: 'App registry not available' });
      return;
    }
    
    const apps = registry.getAllApps();
    const statuses = await Promise.all(apps.map(app => app.getStatus()));
    
    res.json({ apps: statuses });
  } catch (error) {
    console.error('Error listing apps:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/apps/:appId', async (req, res) => {
  try {
    const { appId } = req.params;
    const globalLoop = global.sensitiveLoop;
    const registry = globalLoop?.getAppRegistry();
    
    const app = registry?.getApp(appId);
    if (!app) {
      res.status(404).json({ error: 'App not found' });
      return;
    }
    
    const status = await app.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting app details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/apps/:appId/energy', (req, res) => {
  try {
    const { appId } = req.params;
    const globalLoop = global.sensitiveLoop;
    const registry = globalLoop?.getAppRegistry();
    
    const metrics = registry?.getEnergyMetrics(appId);
    if (!metrics) {
      res.status(404).json({ error: 'App not found' });
      return;
    }
    
    res.json(metrics);
  } catch (error) {
    console.error('Error getting app energy:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/apps/install', async (req, res) => {
  try {
    const config = req.body;
    const globalLoop = global.sensitiveLoop;
    const registry = globalLoop?.getAppRegistry();
    
    if (!registry) {
      res.status(500).json({ error: 'App registry not available' });
      return;
    }
    
    await registry.install(config);
    res.json({ status: 'installed', appId: config.id });
  } catch (error: any) {
    console.error('Error installing app:', error);
    res.status(400).json({ error: error.message || 'Installation failed' });
  }
});

app.delete('/apps/:appId', async (req, res) => {
  try {
    const { appId } = req.params;
    const globalLoop = global.sensitiveLoop;
    const registry = globalLoop?.getAppRegistry();
    
    if (!registry) {
      res.status(500).json({ error: 'App registry not available' });
      return;
    }
    
    await registry.uninstall(appId);
    res.json({ status: 'uninstalled' });
  } catch (error: any) {
    console.error('Error uninstalling app:', error);
    res.status(400).json({ error: error.message || 'Uninstall failed' });
  }
});

app.get('/energy', (req, res) => {
  try {
    const globalLoop = global.sensitiveLoop;
    if (!globalLoop || !globalLoop.energyRegulator) {
      res.status(500).json({ error: 'Energy regulator not available' });
      return;
    }

    const currentEnergy = globalLoop.energyRegulator.getEnergy();
    const energyStatus = globalLoop.energyRegulator.getStatus();

    res.json({
      current: currentEnergy,
      percentage: Math.round(Math.min(100, Math.max(0, currentEnergy))),
      status: energyStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error retrieving energy:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin endpoints for manual triggers
app.post('/admin/trigger-reflection', async (req, res) => {
  try {
    const globalLoop = global.sensitiveLoop;
    if (!globalLoop) {
      res.status(500).json({ error: 'System not available' });
      return;
    }

    // Trigger reflection by calling the internal method if available
    if (typeof globalLoop.triggerReflection === 'function') {
      await globalLoop.triggerReflection();
      res.json({ status: 'triggered', message: 'Reflection cycle initiated' });
    } else {
      res.status(501).json({ error: 'Reflection trigger not implemented' });
    }
  } catch (error) {
    console.error('Error triggering reflection:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/admin/process-conversation/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const globalLoop = global.sensitiveLoop;
    
    if (!globalLoop) {
      res.status(500).json({ error: 'System not available' });
      return;
    }

    // Force processing of a specific conversation
    if (typeof globalLoop.processConversation === 'function') {
      await globalLoop.processConversation(requestId);
      res.json({ status: 'processed', requestId });
    } else {
      res.status(501).json({ error: 'Manual processing not implemented' });
    }
  } catch (error) {
    console.error('Error processing conversation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/health', (req, res) => {
  // Comprehensive health check
  const globalLoop = global.sensitiveLoop;
  const currentEnergy = globalLoop && globalLoop.energyRegulator ? globalLoop.energyRegulator.getEnergy() : 0;
  const energyStatus = globalLoop && globalLoop.energyRegulator ? globalLoop.energyRegulator.getStatus() : 'unknown';

  // Check database connectivity
  let dbHealthy = false;
  try {
    if (globalLoop && globalLoop.inbox) {
      globalLoop.inbox.getDatabase().prepare('SELECT 1').get();
      dbHealthy = true;
    }
  } catch (error) {
    console.error('Database health check failed:', error);
  }

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024)
    },
    queue: {
      pendingMessages: messageQueue.length
    },
    energy: {
      current: currentEnergy,
      percentage: Math.round(Math.min(100, Math.max(0, currentEnergy))),
      status: energyStatus
    },
    components: {
      database: dbHealthy ? 'healthy' : 'unhealthy',
      energyRegulator: globalLoop && globalLoop.energyRegulator ? 'healthy' : 'unhealthy',
      inbox: globalLoop && globalLoop.inbox ? 'healthy' : 'unhealthy'
    }
  };

  // Determine overall status
  let httpStatus = 200;
  if (!dbHealthy || !globalLoop) {
    health.status = 'unhealthy';
    httpStatus = 503;
  } else if (messageQueue.length > 100) {
    health.status = 'degraded';
  } else if (currentEnergy < 20) {
    health.status = 'low_energy';
  }

  res.status(httpStatus).json(health);
});

// Kubernetes-style readiness probe
app.get('/ready', (req, res) => {
  const globalLoop = global.sensitiveLoop;
  const ready = globalLoop && globalLoop.inbox && globalLoop.energyRegulator;
  
  if (ready) {
    res.status(200).json({ ready: true });
  } else {
    res.status(503).json({ ready: false });
  }
});

// Kubernetes-style liveness probe
app.get('/live', (req, res) => {
  res.status(200).json({ alive: true });
});

async function findAvailablePort(startPort: number, maxAttempts: number = 10): Promise<number> {
  const net = await import('net');
  
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const available = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port);
    });
    
    if (available) {
      return port;
    }
  }
  
  throw new Error(`No available port found in range ${startPort}-${startPort + maxAttempts - 1}`);
}

export async function startServer(preferredPort?: number) {
  const startPort = preferredPort || DEFAULT_PORT;
  const port = await findAvailablePort(startPort);
  app.listen(port, () => {
    console.log(`HTTP Server listening on port ${port}`);
  });
  return port;
}
