import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { sensitiveLoop } from './loop';
import { getConversation, getConversationStats } from './tools';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

// Message queue for the sensitive loop
export interface Message {
  id: string;
  content: string;
  timestamp: Date;
}

export const messageQueue: Message[] = [];

app.post('/message', (req, res) => {
  const { content, id } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  const messageId = id || uuidv4();
  const message: Message = {
    id: messageId,
    content,
    timestamp: new Date()
  };

  // Add to message queue for the loop
  messageQueue.push(message);

  console.log(`Received message: ${messageId} - ${content}`);

  res.json({
    status: 'received',
    requestId: messageId
  });
});

// New endpoints for conversation data
app.get('/conversations/:requestId', (req, res) => {
  const { requestId } = req.params;
  const conversation = getConversation(requestId);

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  res.json(conversation);
});

app.get('/stats', (req, res) => {
  const stats = getConversationStats();
  res.json(stats || { error: 'Could not retrieve statistics' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export function startServer() {
  app.listen(PORT, () => {
    console.log(`HTTP Server listening on port ${PORT}`);
  });
}
