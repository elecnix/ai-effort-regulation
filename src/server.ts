import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { Inbox } from './inbox';
import path from 'path';
import { WebSocketServer as WSServer } from 'ws';
import { WebSocketServer } from './websocket-server';
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

// Security: Rate limiting - Very high limit for development/testing
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  limit: 10000, // Very high limit for testing
  standardHeaders: 'draft-7', // Return rate limit headers
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: res.getHeader('Retry-After')
    });
  }
});

// Apply rate limiting to all requests
app.use(limiter);

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
    const { content, id, energyBudget, approvalResponse } = req.body;

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

    // Handle approval response if present
    const globalLoop = global.sensitiveLoop;
    if (approvalResponse && globalLoop && globalLoop.inbox) {
      const { approved, newBudget, budgetChange, feedback } = approvalResponse;
      
      // Update approval status
      if (approved !== undefined) {
        const status = approved ? 'approved' : 'rejected';
        globalLoop.inbox.updateApprovalStatus(messageId, null, status, feedback);
        console.log(`${approved ? '✅' : '❌'} Approval ${status} for ${messageId}${feedback ? `: ${feedback}` : ''}`);
      }
      
      // Apply budget changes
      if (newBudget !== undefined && newBudget !== null) {
        if (typeof newBudget === 'number' && newBudget >= 0) {
          globalLoop.inbox.setEnergyBudget(messageId, newBudget);
          console.log(`💰 Budget set to ${newBudget} for ${messageId}`);
        }
      } else if (budgetChange !== undefined && budgetChange !== null) {
        if (typeof budgetChange === 'number') {
          const conversation = globalLoop.inbox.getConversation(messageId);
          if (conversation) {
            const currentBudget = conversation.metadata.energyBudget || 0;
            const updatedBudget = Math.max(0, currentBudget + budgetChange);
            globalLoop.inbox.setEnergyBudget(messageId, updatedBudget);
            console.log(`💰 Budget adjusted by ${budgetChange} (${currentBudget} → ${updatedBudget}) for ${messageId}`);
          }
        }
      }
    }

    const message: Message = {
      id: messageId,
      content: sanitizedContent,
      timestamp: new Date(),
      energyBudget: energyBudget !== undefined ? energyBudget : null
    };

    // Route through chat app
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

// New endpoints for conversation data
app.get('/conversations', function(req: express.Request, res: express.Response): void {
  try {
    const limit = parseInt(req.query.limit as string) || 10; // Default to 10 recent conversations
    const globalLoop = global.sensitiveLoop;
    const conversations = globalLoop && globalLoop.inbox ? globalLoop.inbox.getRecentCompletedConversations(limit) : [];

    // Format conversations with energy consumption info
    const formattedConversations = conversations.map(conv => ({
      id: conv.requestId,
      requestMessage: conv.inputMessage,
      responseMessages: conv.responses.map(r => r.content),
      timestamp: new Date(), // Use current time for ordering
      energyConsumed: conv.metadata.totalEnergyConsumed,
      responseCount: conv.responses.length,
      ended: conv.ended,
      endedReason: conv.endedReason
    }));

    res.json({
      conversations: formattedConversations,
      total: formattedConversations.length
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

// Get all approvals for a conversation
app.get('/conversations/:requestId/approvals', function(req: express.Request, res: express.Response): void {
  try {
    const { requestId } = req.params;
    if (!requestId) {
      res.status(400).json({ error: 'requestId parameter is required' });
      return;
    }
    
    const globalLoop = global.sensitiveLoop;
    if (!globalLoop || !globalLoop.inbox) {
      res.status(500).json({ error: 'System not initialized' });
      return;
    }
    
    const approvals = globalLoop.inbox.getAllApprovals(requestId);
    
    res.json({
      requestId,
      approvals
    });
  } catch (error) {
    console.error('Error retrieving approvals:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// Approve a pending approval request
app.post('/conversations/:requestId/approve', function(req: express.Request, res: express.Response): void {
  try {
    const { requestId } = req.params;
    const { responseId, feedback, newBudget, budgetChange } = req.body;
    
    if (!requestId) {
      res.status(400).json({ error: 'requestId parameter is required' });
      return;
    }
    
    const globalLoop = global.sensitiveLoop;
    if (!globalLoop || !globalLoop.inbox) {
      res.status(500).json({ error: 'System not initialized' });
      return;
    }
    
    // Update approval status
    globalLoop.inbox.updateApprovalStatus(requestId, responseId || null, 'approved', feedback);
    
    // Apply budget changes if specified
    let budgetUpdated = false;
    let finalBudget: number | null = null;
    
    if (newBudget !== undefined && newBudget !== null) {
      if (typeof newBudget === 'number' && newBudget >= 0) {
        globalLoop.inbox.setEnergyBudget(requestId, newBudget);
        budgetUpdated = true;
        finalBudget = newBudget;
      }
    } else if (budgetChange !== undefined && budgetChange !== null) {
      if (typeof budgetChange === 'number') {
        const conversation = globalLoop.inbox.getConversation(requestId);
        if (conversation) {
          const currentBudget = conversation.metadata.energyBudget || 0;
          const updatedBudget = Math.max(0, currentBudget + budgetChange);
          globalLoop.inbox.setEnergyBudget(requestId, updatedBudget);
          budgetUpdated = true;
          finalBudget = updatedBudget;
        }
      }
    }
    
    res.json({
      status: 'approved',
      responseId: responseId || 'latest',
      budgetUpdated,
      newBudget: finalBudget
    });
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// Reject a pending approval request
app.post('/conversations/:requestId/reject', function(req: express.Request, res: express.Response): void {
  try {
    const { requestId } = req.params;
    const { responseId, feedback } = req.body;
    
    if (!requestId) {
      res.status(400).json({ error: 'requestId parameter is required' });
      return;
    }
    
    const globalLoop = global.sensitiveLoop;
    if (!globalLoop || !globalLoop.inbox) {
      res.status(500).json({ error: 'System not initialized' });
      return;
    }
    
    // Update approval status
    globalLoop.inbox.updateApprovalStatus(requestId, responseId || null, 'rejected', feedback);
    
    res.json({
      status: 'rejected',
      responseId: responseId || 'latest'
    });
  } catch (error) {
    console.error('Error rejecting request:', error);
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

// Memory management endpoints
app.get('/apps/:appId/memories', (req, res) => {
  try {
    const { appId } = req.params;
    const globalLoop = global.sensitiveLoop;
    const memorySubAgent = globalLoop?.getMemorySubAgent?.();
    
    if (!memorySubAgent) {
      res.status(500).json({ error: 'Memory sub-agent not available' });
      return;
    }
    
    const memories = memorySubAgent.getMemories(appId, 10);
    
    res.json({
      appId,
      count: memories.length,
      memories: memories.map(m => ({
        id: m.id,
        content: m.content,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        sourceConversationId: m.sourceConversationId
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/apps/:appId/memories', (req, res) => {
  try {
    const { appId } = req.params;
    const globalLoop = global.sensitiveLoop;
    const memorySubAgent = globalLoop?.getMemorySubAgent?.();
    
    if (!memorySubAgent) {
      res.status(500).json({ error: 'Memory sub-agent not available' });
      return;
    }
    
    const deletedCount = memorySubAgent.deleteAppMemories(appId);
    
    res.json({
      success: true,
      appId,
      deletedCount
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/apps/:appId/memories/:memoryId', (req, res) => {
  try {
    const { memoryId } = req.params;
    const globalLoop = global.sensitiveLoop;
    const memorySubAgent = globalLoop?.getMemorySubAgent?.();
    
    if (!memorySubAgent) {
      res.status(500).json({ error: 'Memory sub-agent not available' });
      return;
    }
    
    memorySubAgent.deleteMemory(parseInt(memoryId));
    
    res.json({
      success: true,
      memoryId: parseInt(memoryId)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  // Comprehensive health check for monitoring and operations
  const globalLoop = global.sensitiveLoop;
  const currentEnergy = globalLoop && globalLoop.energyRegulator ? globalLoop.energyRegulator.getEnergy() : 0;
  const energyStatus = globalLoop && globalLoop.energyRegulator ? globalLoop.energyRegulator.getStatus() : 'unknown';
  
  // Test database connectivity
  let dbConnected = false;
  let dbError = null;
  try {
    if (globalLoop && globalLoop.inbox) {
      const db = globalLoop.inbox.getDatabase();
      db.prepare('SELECT 1').get();
      dbConnected = true;
    }
  } catch (error: any) {
    dbError = error.message;
  }

  const memUsage = process.memoryUsage();
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    version: process.env.npm_package_version || 'unknown',
    environment: process.env.NODE_ENV || 'development',
    system: {
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid
    },
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
      percentUsed: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
    },
    queue: {
      pendingMessages: messageQueue.length,
      maxCapacity: 1000,
      percentFull: Math.round((messageQueue.length / 1000) * 100)
    },
    energy: {
      current: Math.round(currentEnergy * 10) / 10,
      percentage: Math.round(Math.min(100, Math.max(0, currentEnergy))),
      status: energyStatus
    },
    database: {
      connected: dbConnected,
      error: dbError
    },
    checks: {
      queueOverload: messageQueue.length > 100,
      lowEnergy: currentEnergy < 20,
      highMemory: (memUsage.heapUsed / memUsage.heapTotal) > 0.9,
      dbConnected: dbConnected
    }
  };

  // Determine overall status
  if (!dbConnected) {
    health.status = 'unhealthy';
    res.status(503).json(health);
  } else if (messageQueue.length > 100 || currentEnergy < 10) {
    health.status = 'degraded';
    res.status(200).json(health);
  } else if (currentEnergy < 20) {
    health.status = 'warning';
    res.status(200).json(health);
  } else {
    res.status(200).json(health);
  }
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

export async function startServer() {
  const port = await findAvailablePort(DEFAULT_PORT);
  const server = app.listen(port, () => {
    console.log(`HTTP Server listening on port ${port}`);
  });

  const wss = new WSServer({ server, path: '/ws' });
  const wsServer = new WebSocketServer(wss);
  
  (global as any).httpServer = server;
  (global as any).wsServer = wsServer;
  console.log(`WebSocket Server listening on port ${port}/ws`);

  app.use(express.static(path.join(__dirname, '../../ui/dist')));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || 
        req.path.startsWith('/conversations') || 
        req.path.startsWith('/stats') || 
        req.path.startsWith('/health') ||
        req.path.startsWith('/message')) {
      next();
    } else {
      const indexPath = path.join(__dirname, '../../ui/dist/index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          next();
        }
      });
    }
  });

  return { port, server, wsServer };
}
