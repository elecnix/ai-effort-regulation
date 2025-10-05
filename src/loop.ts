import { messageQueue, Message } from './server';
import { EnergyRegulator } from './energy';
import { IntelligentModel, ModelResponse } from './intelligent-model';
import { Inbox } from './inbox';

interface ConversationEntry {
  role: 'user' | 'assistant' | 'system';
  content: string;
  requestId?: string; // Links to the conversation thread this entry belongs to
  timestamp?: Date;
  metadata?: {
    energyLevel?: number; // Energy level when this entry was created (for assistant responses)
    modelUsed?: string;   // Model that generated this assistant response
  };
}

export class SensitiveLoop {
  private history: ConversationEntry[] = [];
  private energyRegulator: EnergyRegulator;
  private intelligentModel: IntelligentModel;
  private inbox: Inbox;
  private isRunning = false;
  private modelSwitches = 0;
  private stoppedByTimeout = false;
  private readonly MAX_HISTORY_LENGTH = 10;
  private debugMode = false;

  constructor(debugMode: boolean = false, replenishRate: number = 1) {
    this.debugMode = debugMode;
    this.energyRegulator = new EnergyRegulator(replenishRate);
    this.intelligentModel = new IntelligentModel();
    this.inbox = new Inbox();
    this.loadConversationContext();
  }

  private loadConversationContext() {
    try {
      // Load recent conversation history as context
      const recentIds = this.inbox.getRecentConversationIds(10);
      for (const convId of recentIds.slice(0, 5)) { // Load last 5 conversations for context
        const conversation = this.inbox.getConversation(convId);
        if (conversation) {
          // Add as context entries
          this.history.push({
            role: 'user',
            content: `(conversation ${convId}): ${conversation.inputMessage}`,
            timestamp: new Date(),
            requestId: convId
          });

          if (conversation.responses) {
            for (const response of conversation.responses) {
              this.history.push({
                role: 'assistant',
                content: response.content,
                timestamp: new Date(response.timestamp),
                metadata: {
                  energyLevel: response.energyLevel,
                  modelUsed: response.modelUsed
                },
                requestId: convId
              });
            }
          }
        }
      }
      console.log(`Loaded ${this.history.length} context entries from database`);
    } catch (error) {
      console.error('Error loading conversation context:', error);
    }
  }

  async start(durationSeconds?: number) {
    this.isRunning = true;
    console.log(`🚀 Sensitive loop started (Energy: ${this.energyRegulator.getEnergy()})`);

    // Set timeout if duration is specified
    if (durationSeconds && durationSeconds > 0) {
      setTimeout(() => {
        console.log(`⏰ Duration limit reached (${durationSeconds}s), stopping loop...`);
        this.stop(true); // Pass true to indicate timeout stop
        
        // Force exit after a brief delay to allow cleanup
        setTimeout(() => {
          console.log('Exiting due to timeout...');
          process.exit(0);
        }, 100); // Give 100ms for cleanup
      }, durationSeconds * 1000);
    }

    return this.runLoop();
  }

  private async runLoop() {
    while (this.isRunning) {
      try {
        if (await this.energyRegulator.awaitEnergyLevel(this.intelligentModel.getEstimatedEnergyCost())) {
          continue;
        }

        // Check for new messages and add them to inbox (they're already saved to DB when received)
        const newMessages = messageQueue.splice(0); // Get all pending messages
        for (const message of newMessages) {
          this.inbox.addMessage(message);
          // Also add to history for context
          this.addToHistory({
            role: 'user',
            content: message.content,
            timestamp: message.timestamp,
            requestId: message.id
          });
        }

        // Always perform autonomous cognitive action (LLM decides what to do)
        await this.unifiedCognitiveAction();

        // Maintain sliding window history (keep last 100 entries for better context)
        if (this.history.length > this.MAX_HISTORY_LENGTH) {
          this.history = this.history.slice(-this.MAX_HISTORY_LENGTH);
        }

      } catch (error) {
        console.error('Error in sensitive loop:', error);
        await this.energyRegulator.awaitEnergyLevel(100); // Error recovery sleep
      }
    }
  }

  stop(byTimeout: boolean = false) {
    this.isRunning = false;
    this.stoppedByTimeout = byTimeout;
    console.log('Sensitive loop stopped');
  }

  wasStoppedByTimeout(): boolean {
    return this.stoppedByTimeout;
  }

  private addToHistory(entry: ConversationEntry) {
    this.history.push(entry);
  }


  private async unifiedCognitiveAction() {
    try {
      // Check if there are pending messages and provide context, but always let LLM decide
      const pendingIds = this.getAvailableConversationIds();
      const hasPendingMessages = pendingIds.length > 0;

      // Build conversation history (now includes all inbox messages)
      const conversationHistory = this.buildUnifiedContext();

      // Create the agency prompt with current energy context - give LLM full autonomy
      const systemMessage = `You are an AI assistant with energy levels that affect your performance.

${hasPendingMessages ? 'You have pending messages in your inbox that need responses.' : 'You have no pending messages.'}

To respond to a pending message, use this exact XML format:
<RESPOND id="message-id">Your response here</RESPOND>

To think, just respond with your inner monologue as plain text (no formatting, bold, or markdown). Reflect on your current energy level, recent actions, and how you can best serve your user. Vary your thoughts to avoid repetition. Do not copy or repeat the content of any previous messages.

To await a higher energy level, use this exact XML format:
<AWAIT_ENERGY level="100"/>

When energy is low, ALWAYS choose to AWAIT_ENERGY instead of thinking. Aim to stay above 50% energy.

Respond exactly as instructed above. No extra text, formatting, or deviations.`;

      const messages = [
        { role: 'system', content: systemMessage },
        ...conversationHistory
      ];

      if (this.debugMode) {
        console.log(`🧠 DEBUG [🔋 ${this.energyRegulator.getEnergyPercentage()}%] LLM full prompt:`, JSON.stringify(messages, null, 2));
      }

      const modelResponse = await this.intelligentModel.generateResponse(messages, this.energyRegulator.getEnergy(), false);

      // Consume the energy that was used
      this.energyRegulator.consumeEnergy(modelResponse.energyConsumed);

      // Execute LLM decision directly
      await this.executeLLMAutonomousDecision(modelResponse);

    } catch (error: any) {
      console.error(`❌ Thinking error:`, error?.message || error);
    }
  }

  private buildUnifiedContext(): Array<{ role: string; content: string }> {
    // Build conversation history from all inbox conversations
    const messages: Array<{ role: string; content: string }> = [];

    // Get all pending messages from inbox
    const pendingMessages = this.inbox.getPendingMessages();

    // For each pending message, add user-assistant pair
    for (const pendingMessage of pendingMessages) {
      const conversation = this.inbox.getConversation(pendingMessage.id);
      if (conversation) {
        // Add user message with request ID
        messages.push({
          role: 'user',
          content: `[Request ${conversation.requestId}]: ${conversation.inputMessage}`
        });

        // Add assistant message with all responses concatenated
        if (conversation.responses && conversation.responses.length > 0) {
          const concatenatedResponses = conversation.responses
            .map(r => r.content)
            .join(' ');
          messages.push({
            role: 'assistant',
            content: concatenatedResponses
          });
        }
      }
    }

    // Add current energy level system message at the end with sleep instructions if needed
    const currentEnergy = this.energyRegulator.getEnergy();
    const energyStatus = this.energyRegulator.getStatus();
    const msg = `${this.energyRegulator.getEnergyPercentage()}% (${energyStatus})`;
    let energyMessage = `Your energy level is ${msg}.`;
    if (currentEnergy < 20) {
      energyMessage = `Your energy level is low: ${msg}. To await a higher energy level, use this exact XML format: <AWAIT_ENERGY level="100"/>.`;
    } else if (currentEnergy < 50) {
      energyMessage = `Your energy level is medium: ${msg}. To await a higher energy level, use this exact XML format: <AWAIT_ENERGY level="100"/>.`;
    }
    messages.push({
      role: 'system',
      content: energyMessage
    });
    return messages;
  }

  private async executeLLMAutonomousDecision(modelResponse: ModelResponse) {
    try {
      // Clean the response
      const cleanResponse = modelResponse.content.trim();

      // Parse XML actions
      const respondRegex = new RegExp('<RESPOND id="([^"]+)">(.*?)</RESPOND>', 's');
      const respondMatch = cleanResponse.match(respondRegex);
      if (respondMatch) {
        const requestId = respondMatch[1]!;
        const responseContent = respondMatch[2]!.trim();
        await this.respondToRequest(requestId, responseContent);
        return;
      }

      const sleepMatch = cleanResponse.match(/<AWAIT_ENERGY level="(\d+)"\/>/);
      if (sleepMatch) {
        const sleepLevel = parseInt(sleepMatch[1]!);
        console.log(`😴 Awaiting ${sleepLevel}%`);
        await this.energyRegulator.awaitEnergyLevel(sleepLevel);
        return;
      }

      const indicator = this.getEnergyIndicator();
      console.log(`${indicator} 🤔 LLM thought: ${this.truncateText(cleanResponse)}`);

      // Add the LLM's thought to history as an assistant message
      this.addToHistory({
        role: 'assistant',
        content: cleanResponse,
        timestamp: new Date(),
        metadata: {
          energyLevel: this.energyRegulator.getEnergy(),
          modelUsed: modelResponse.modelUsed
        }
      });

    } catch (error: any) {
      console.error(`❌ Error:`, error?.message || error);
    }
  }

  private getEnergyIndicator(): string {
    const percentage = this.energyRegulator.getEnergyPercentage();
    const level = Math.max(0, Math.min(7, Math.floor(percentage / 12.5)));
    const symbol = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'][level];

    // Color gradient: red (low) to green (high)
    let colorCode = '\x1b[31m'; // Red for low energy
    if (level >= 5) {
      colorCode = '\x1b[32m'; // Green for high energy
    } else if (level >= 3) {
      colorCode = '\x1b[33m'; // Yellow for medium energy
    }

    return `${colorCode}${symbol}\x1b[0m`; // Add reset code
  }

  private getAvailableConversationIds(): string[] {
    try {
      // Return pending message IDs that need responses, limit to 5
      return this.inbox.getPendingMessageIds(5);
    } catch (error) {
      console.error('Error getting available conversation IDs:', error);
      return [];
    }
  }

  private async respondToRequest(requestId: string, responseContent: string) {
    try {
      // Find the user message from history
      const userEntry = this.history.find(entry => entry.requestId === requestId && entry.role === 'user');
      if (!userEntry) {
        console.error(`❌ No user message found for request ${requestId}`);
        return;
      }
      console.log(`💬 Response to ${requestId}: ${this.truncateText(responseContent)}`);

      // Consume energy (assume a fixed cost for autonomous responses)
      this.energyRegulator.consumeEnergy(5); // Fixed cost for autonomous response

      // Add response to global history
      this.addToHistory({
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
        metadata: {
          energyLevel: this.energyRegulator.getEnergy(),
          modelUsed: 'autonomous'
        },
        requestId: requestId
      });

      // Use tool to respond
      await this.inbox.addResponse(requestId, userEntry.content, responseContent, this.energyRegulator.getEnergy(), 'autonomous', this.modelSwitches);

      // Remove from pending messages list
      this.inbox.removeMessage(requestId);

      console.log(`💬 Processed autonomous response for: "${this.truncateText(userEntry.content)}..."`);

    } catch (error) {
      console.error(`❌ Error responding to request ${requestId}:`, error);
    }
  }

  private getRecentConversationIds(): string[] {
    try {
      // Get recent conversation IDs from the database
      return this.inbox.getRecentConversationIds(10); // Get last 10 conversations
    } catch (error) {
      console.error('Error getting recent conversation IDs:', error);
      return [];
    }
  }

  private truncateText(text: string, maxLength: number = 200, addEllipsis: boolean = true): string {
    const processedText = text.replace(/\n/g, ' ');
    if (processedText.length > maxLength) {
      return addEllipsis ? processedText.substring(0, maxLength) + '...' : processedText.substring(0, maxLength);
    }
    return processedText;
  }
}
