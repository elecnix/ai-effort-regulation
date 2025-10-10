import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import { ConversationResponse, SystemStats } from './types';

export class TestClient {
  private serverUrl: string;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  async sendMessage(content: string, requestId?: string): Promise<string> {
    const id = requestId || uuidv4();
    
    try {
      const response = await fetch(`${this.serverUrl}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content,
          id
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      const data = await response.json();
      return data.requestId || id;
    } catch (error) {
      console.error(`Error sending message: ${error}`);
      throw error;
    }
  }

  async getConversation(requestId: string): Promise<ConversationResponse | null> {
    try {
      const response = await fetch(`${this.serverUrl}/conversations/${requestId}`);
      
      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to get conversation: ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      // Handle server connection failures gracefully
      if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
        console.warn(`⚠️  Server connection lost while fetching conversation ${requestId}`);
        return null;
      }
      console.error(`Error getting conversation: ${error}`);
      throw error;
    }
  }

  async getStats(): Promise<SystemStats> {
    try {
      const response = await fetch(`${this.serverUrl}/stats`);
      
      if (!response.ok) {
        throw new Error(`Failed to get stats: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error getting stats: ${error}`);
      throw error;
    }
  }

  async getEnergyLevel(): Promise<number> {
    try {
      // Get energy level from stats (average of recent responses)
      const stats = await this.getStats();
      return stats.avg_energy_level || 100;
    } catch (error) {
      // Return default if server unavailable
      return 100;
    }
  }

  async waitForResponse(requestId: string, timeoutMs: number = 30000): Promise<ConversationResponse | null> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const conversation = await this.getConversation(requestId);
      
      if (conversation && conversation.responses.length > 0) {
        return conversation;
      }

      // Wait a bit before checking again
      await this.wait(1000);
    }

    return null;
  }

  async waitForSnooze(requestId: string, timeoutMs: number = 60000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const conversation = await this.getConversation(requestId);
      
      if (conversation && conversation.responses.length > 0) {
        // Check if any response mentions snoozing
        const hasSnoozeMention = conversation.responses.some(r => 
          r.content.toLowerCase().includes('snooze') ||
          r.content.toLowerCase().includes('remind') ||
          r.content.toLowerCase().includes('later') ||
          r.content.toLowerCase().includes('minutes')
        );
        
        if (hasSnoozeMention) {
          return true;
        }
      }

      await this.wait(1000);
    }

    return false;
  }

  async waitForConversationEnd(requestId: string, timeoutMs: number = 300000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const conversation = await this.getConversation(requestId);
      
      if (conversation && conversation.ended) {
        return true;
      }

      await this.wait(2000);
    }

    return false;
  }

  async isServerHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrl}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
