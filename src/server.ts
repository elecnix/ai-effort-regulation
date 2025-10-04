import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { Inbox } from './inbox';
// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3005');
const MAX_MESSAGE_LENGTH = parseInt(process.env.MAX_MESSAGE_LENGTH || '10000');

// Security: Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
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
}

export const messageQueue: Message[] = [];

app.post('/message', function(req: express.Request, res: express.Response): void {
  try {
    const { content, id } = req.body;

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
      timestamp: new Date()
    };

    // Add to message queue for the loop (loop will handle storing user message and generating response)
    messageQueue.push(message);

    // Save the user message to database immediately
    const globalLoop = (global as any).sensitiveLoop;
    if (globalLoop && globalLoop.inbox) {
      globalLoop.inbox.addResponse(messageId, sanitizedContent, '', 0, '', 0);
    }

    // Add to inbox for tracking unanswered messages
    if (globalLoop && globalLoop.inbox) {
      globalLoop.inbox.addMessage(message);
    }

    console.log(`📨 Received: "${sanitizedContent.substring(0, 50)}${sanitizedContent.length > 50 ? '...' : ''}"`);

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
app.get('/conversations/:requestId', function(req: express.Request, res: express.Response): void {
  try {
    const { requestId } = req.params;
    if (!requestId) {
      res.status(400).json({ error: 'requestId parameter is required' });
      return;
    }
    const globalLoop = (global as any).sensitiveLoop;
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

app.get('/stats', (req, res) => {
  try {
    const globalLoop = (global as any).sensitiveLoop;
    const stats = globalLoop && globalLoop.inbox ? globalLoop.inbox.getConversationStats() : null;
    res.json(stats || { error: 'Could not retrieve statistics' });
  } catch (error) {
    console.error('Error retrieving stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add endpoint to view internal thought metadata (not content)
app.get('/internal-thoughts', (req, res) => {
  // Get the sensitive loop instance to access internal thought metadata
  const thoughts = (global as any).sensitiveLoop?.internalMonologue || [];
  res.json({
    thoughtCount: thoughts.length,
    recentThoughts: thoughts.slice(-5).map((thought: any) => ({
      timestamp: thought.timestamp,
      energyLevel: thought.energyLevel,
      // Note: actual thought content is not stored, only printed to console
    })),
    note: 'Internal thoughts are printed to console logs with 🤔 emoji, not stored in database'
  });
});

app.get('/health', (req, res) => {
  // Comprehensive health check
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
    database: {
      connected: true // Would need actual DB health check
    }
  };

  // Check if system is overloaded
  if (messageQueue.length > 100) {
    health.status = 'warning';
    res.status(200).json(health);
  } else {
    res.json(health);
  }
});

export function startServer() {
  app.listen(PORT, () => {
    console.log(`HTTP Server listening on port ${PORT}`);
  });
}
