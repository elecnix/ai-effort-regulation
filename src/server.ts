import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { Inbox } from './inbox';
// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

// Extend global type for sensitiveLoop
declare global {
  var sensitiveLoop: {
    inbox: Inbox;
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
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
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

app.post('/message', function(req: express.Request, res: express.Response): void {
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

    // Add to message queue for the loop (loop will handle storing user message and generating response)
    messageQueue.push(message);

    // Save the user message to database immediately
    if (globalLoop && globalLoop.inbox) {
      globalLoop.inbox.addResponse(messageId, sanitizedContent, '', 0, '', message.energyBudget);
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
    let finalBudget = null;
    
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

app.get('/health', (req, res) => {
  // Comprehensive health check
  const globalLoop = global.sensitiveLoop;
  const currentEnergy = globalLoop && globalLoop.energyRegulator ? globalLoop.energyRegulator.getEnergy() : 0;
  const energyStatus = globalLoop && globalLoop.energyRegulator ? globalLoop.energyRegulator.getStatus() : 'unknown';

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
    database: {
      connected: true // Would need actual DB health check
    }
  };

  // Check if system is overloaded
  if (messageQueue.length > 100) {
    health.status = 'warning';
    res.status(200).json(health);
  } else if (currentEnergy < 20) {
    health.status = 'low_energy';
    res.status(200).json(health);
  } else {
    res.json(health);
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
  app.listen(port, () => {
    console.log(`HTTP Server listening on port ${port}`);
  });
  return port;
}
