import { WebSocketServer } from './websocket-server';
import { SensitiveLoop } from './loop';
import { Message } from './server';

export class EventBridge {
  private wsServer: WebSocketServer;
  private sensitiveLoop: SensitiveLoop;
  private statsInterval: NodeJS.Timeout | null = null;
  private lastEnergy: number = 100;

  constructor(wsServer: WebSocketServer, sensitiveLoop: SensitiveLoop) {
    this.wsServer = wsServer;
    this.sensitiveLoop = sensitiveLoop;
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    this.wsServer.registerHandler('send_message', async (clientId, payload) => {
      try {
        const { content, energyBudget } = payload;

        if (!content || typeof content !== 'string') {
          this.wsServer.sendToClient(clientId, {
            type: 'error',
            payload: {
              message: 'Content is required and must be a string',
              code: 'INVALID_CONTENT'
            },
            timestamp: new Date().toISOString()
          });
          return;
        }

        if (energyBudget !== undefined && energyBudget !== null) {
          if (typeof energyBudget !== 'number' || isNaN(energyBudget) || energyBudget < 0) {
            this.wsServer.sendToClient(clientId, {
              type: 'error',
              payload: {
                message: 'energyBudget must be a non-negative number',
                code: 'INVALID_BUDGET'
              },
              timestamp: new Date().toISOString()
            });
            return;
          }
        }

        const message: Message = {
          id: require('uuid').v4(),
          content,
          timestamp: new Date(),
          energyBudget: energyBudget !== undefined ? energyBudget : null
        };

        const globalLoop = global as any;
        if (globalLoop.sensitiveLoop && globalLoop.sensitiveLoop.inbox) {
          const budget = message.energyBudget !== undefined ? message.energyBudget : null;
          globalLoop.sensitiveLoop.inbox.addResponse(message.id, content, '', 0, '', budget);
          globalLoop.sensitiveLoop.inbox.addMessage(message);
        }

        this.wsServer.sendToClient(clientId, {
          type: 'message_sent',
          payload: {
            conversationId: message.id,
            timestamp: message.timestamp.toISOString()
          },
          timestamp: new Date().toISOString()
        });

        const budget = message.energyBudget !== undefined ? message.energyBudget : null;
        this.broadcastConversationCreated(message.id, content, budget);

      } catch (error) {
        console.error('Error handling send_message:', error);
        this.wsServer.sendToClient(clientId, {
          type: 'error',
          payload: {
            message: 'Failed to send message',
            code: 'SEND_FAILED',
            details: error instanceof Error ? error.message : String(error)
          },
          timestamp: new Date().toISOString()
        });
      }
    });

    this.wsServer.registerHandler('get_conversations', (clientId, payload) => {
      try {
        const limit = payload?.limit || 50;
        const globalLoop = global as any;
        const conversations = globalLoop.sensitiveLoop?.inbox?.getRecentCompletedConversations(limit) || [];

        const formattedConversations = conversations.map((conv: any) => ({
          id: conv.requestId,
          userMessage: conv.inputMessage,
          state: conv.ended ? 'ended' : 'active',
          messageCount: conv.responses.length,
          energyConsumed: conv.metadata.totalEnergyConsumed,
          lastActivity: conv.responses.length > 0 
            ? conv.responses[conv.responses.length - 1].timestamp 
            : new Date().toISOString()
        }));

        this.wsServer.sendToClient(clientId, {
          type: 'conversations_list',
          payload: {
            conversations: formattedConversations
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error handling get_conversations:', error);
        this.wsServer.sendToClient(clientId, {
          type: 'error',
          payload: {
            message: 'Failed to get conversations',
            code: 'GET_CONVERSATIONS_FAILED'
          },
          timestamp: new Date().toISOString()
        });
      }
    });

    this.wsServer.registerHandler('get_conversation', (clientId, payload) => {
      try {
        const { conversationId } = payload;
        if (!conversationId) {
          this.wsServer.sendToClient(clientId, {
            type: 'error',
            payload: {
              message: 'conversationId is required',
              code: 'MISSING_CONVERSATION_ID'
            },
            timestamp: new Date().toISOString()
          });
          return;
        }

        const globalLoop = global as any;
        const conversation = globalLoop.sensitiveLoop?.inbox?.getConversation(conversationId);

        if (!conversation) {
          this.wsServer.sendToClient(clientId, {
            type: 'error',
            payload: {
              message: 'Conversation not found',
              code: 'CONVERSATION_NOT_FOUND'
            },
            timestamp: new Date().toISOString()
          });
          return;
        }

        this.wsServer.sendToClient(clientId, {
          type: 'conversation_detail',
          payload: conversation,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error handling get_conversation:', error);
        this.wsServer.sendToClient(clientId, {
          type: 'error',
          payload: {
            message: 'Failed to get conversation',
            code: 'GET_CONVERSATION_FAILED'
          },
          timestamp: new Date().toISOString()
        });
      }
    });

    this.wsServer.registerHandler('get_stats', (clientId) => {
      try {
        const globalLoop = global as any;
        const stats = globalLoop.sensitiveLoop?.inbox?.getConversationStats();
        const currentEnergy = globalLoop.sensitiveLoop?.energyRegulator?.getEnergy() || 0;

        if (!stats) {
          this.wsServer.sendToClient(clientId, {
            type: 'error',
            payload: {
              message: 'Failed to get stats',
              code: 'STATS_UNAVAILABLE'
            },
            timestamp: new Date().toISOString()
          });
          return;
        }

        this.wsServer.sendToClient(clientId, {
          type: 'system_stats',
          payload: {
            ...stats,
            currentEnergy,
            uptime: process.uptime()
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error handling get_stats:', error);
        this.wsServer.sendToClient(clientId, {
          type: 'error',
          payload: {
            message: 'Failed to get stats',
            code: 'GET_STATS_FAILED'
          },
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  public start(): void {
    this.startEnergyMonitoring();
    this.startStatsInterval(2000);
  }

  private startEnergyMonitoring(): void {
    setInterval(() => {
      const globalLoop = global as any;
      const currentEnergy = globalLoop.sensitiveLoop?.energyRegulator?.getEnergy() || 0;
      
      if (currentEnergy !== this.lastEnergy) {
        const delta = currentEnergy - this.lastEnergy;
        this.broadcastEnergyUpdate(currentEnergy, delta);
        this.lastEnergy = currentEnergy;
      }
    }, 500);
  }

  private startStatsInterval(intervalMs: number): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    this.statsInterval = setInterval(() => {
      const globalLoop = global as any;
      const stats = globalLoop.sensitiveLoop?.inbox?.getConversationStats();
      const currentEnergy = globalLoop.sensitiveLoop?.energyRegulator?.getEnergy() || 0;

      if (stats && this.wsServer.getClientCount() > 0) {
        this.wsServer.broadcast({
          type: 'system_stats',
          payload: {
            ...stats,
            currentEnergy,
            uptime: process.uptime()
          },
          timestamp: new Date().toISOString()
        });
      }
    }, intervalMs);
  }

  public broadcastEnergyUpdate(current: number, delta: number): void {
    const globalLoop = global as any;
    const energyRegulator = globalLoop.sensitiveLoop?.energyRegulator;
    
    if (!energyRegulator) return;

    this.wsServer.broadcast({
      type: 'energy_update',
      payload: {
        current,
        max: 100,
        min: -50,
        percentage: energyRegulator.getEnergyPercentage(),
        status: energyRegulator.getStatus(),
        delta
      },
      timestamp: new Date().toISOString()
    });
  }

  public broadcastConversationCreated(conversationId: string, userMessage: string, energyBudget: number | null): void {
    this.wsServer.broadcast({
      type: 'conversation_created',
      payload: {
        conversationId,
        userMessage,
        energyBudget,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  }

  public broadcastMessageAdded(conversationId: string, role: 'user' | 'assistant', content: string, energyLevel: number, modelUsed: string): void {
    this.wsServer.broadcast({
      type: 'message_added',
      payload: {
        conversationId,
        role,
        content,
        energyLevel,
        modelUsed,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  }

  public broadcastConversationStateChanged(conversationId: string, oldState: string, newState: string, reason?: string, snoozeUntil?: string): void {
    this.wsServer.broadcast({
      type: 'conversation_state_changed',
      payload: {
        conversationId,
        oldState,
        newState,
        reason,
        snoozeUntil
      },
      timestamp: new Date().toISOString()
    });
  }

  public broadcastModelSwitched(from: string, to: string, reason: string, energyLevel: number): void {
    this.wsServer.broadcast({
      type: 'model_switched',
      payload: {
        from,
        to,
        reason,
        energyLevel
      },
      timestamp: new Date().toISOString()
    });
  }

  public broadcastSleepStart(reason: string, energyLevel: number, expectedDuration: number): void {
    this.wsServer.broadcast({
      type: 'sleep_start',
      payload: {
        reason,
        energyLevel,
        expectedDuration
      },
      timestamp: new Date().toISOString()
    });
  }

  public broadcastSleepEnd(duration: number, energyRestored: number, newEnergyLevel: number): void {
    this.wsServer.broadcast({
      type: 'sleep_end',
      payload: {
        duration,
        energyRestored,
        newEnergyLevel
      },
      timestamp: new Date().toISOString()
    });
  }

  public broadcastToolInvocation(conversationId: string, toolName: string, args: any, result?: any, error?: string, duration?: number): void {
    this.wsServer.broadcast({
      type: 'tool_invocation',
      payload: {
        conversationId,
        toolName,
        arguments: args,
        result,
        error,
        duration
      },
      timestamp: new Date().toISOString()
    });
  }

  public stop(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }
}
