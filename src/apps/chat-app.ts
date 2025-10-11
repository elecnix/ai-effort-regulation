import { BaseApp } from './base-app';
import { AppMessage, AppConfig } from './types';
import { AppRegistry } from './registry';
import { Inbox } from '../inbox';

export class ChatApp extends BaseApp {
  constructor(registry: AppRegistry, private inbox: Inbox) {
    super('chat', 'Chat App', registry);
  }
  
  async install(config: AppConfig): Promise<void> {
    await super.install(config);
  }
  
  async start(): Promise<void> {
    await super.start();
  }
  
  async receiveMessage(message: AppMessage): Promise<void> {
    const { conversationId, content } = message;
    
    if (!content || !content.response) {
      console.error(`Chat app received invalid message: missing response`);
      return;
    }
    
    this.inbox.addResponse(
      conversationId,
      '',
      content.response,
      content.energyLevel || 0,
      content.modelUsed || 'unknown',
      null,
      this.id
    );
    
    // Broadcast message added event for real-time UI updates
    const globalLoop = global as any;
    if (globalLoop.eventBridge) {
      globalLoop.eventBridge.broadcastMessageAdded(
        conversationId,
        'assistant',
        content.response,
        content.energyLevel || 0,
        content.modelUsed || 'unknown'
      );
    }
    
    if (content.energyConsumed) {
      this.reportEnergyConsumption(content.energyConsumed, conversationId, 'generate_response');
    }
  }
  
  async handleUserMessage(messageId: string, content: string, energyBudget?: number | null): Promise<void> {
    // Create conversation with app_id
    this.inbox.addResponse(messageId, content, '', 0, '', energyBudget, this.id);
    
    // Broadcast user message added event for real-time UI updates
    const globalLoop = global as any;
    if (globalLoop.eventBridge) {
      globalLoop.eventBridge.broadcastMessageAdded(
        messageId,
        'user',
        content,
        0,
        ''
      );
    }
    
    // Associate with app registry
    this.registry.associateConversation(messageId, this.id);
    
    const message: AppMessage = {
      conversationId: messageId,
      from: this.id,
      to: 'loop',
      content: {
        userMessage: content,
        energyBudget
      },
      timestamp: new Date(),
      metadata: {
        source: 'http_api'
      }
    };
  }
  
  // Get conversations for this app
  getConversations(limit: number = 10) {
    return this.inbox.getConversationsByApp(this.id, limit);
  }
  
  // Get pending messages for this app
  getPendingMessages() {
    return this.inbox.getPendingMessagesByApp(this.id);
  }
}
