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
      content.modelUsed || 'unknown'
    );
    
    if (content.energyConsumed) {
      this.reportEnergyConsumption(content.energyConsumed, conversationId, 'generate_response');
    }
  }
  
  async handleUserMessage(messageId: string, content: string, energyBudget?: number | null): Promise<void> {
    this.inbox.addResponse(messageId, content, '', 0, '', energyBudget);
    
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
    
    this.registry.associateConversation(messageId, this.id);
  }
}
