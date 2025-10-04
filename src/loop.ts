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
  private energyRegulator = new EnergyRegulator();
  private intelligentModel: IntelligentModel;
  private inbox: Inbox;
  private isRunning = false;
  private modelSwitches = 0;
  private stoppedByTimeout = false;
  private readonly MAX_HISTORY_LENGTH = 100;
  private debugMode = false;

  constructor(debugMode: boolean = false) {
    this.debugMode = debugMode;
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
            role: 'system',
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
        if (this.energyRegulator.getEnergy() < -50) {
          console.log(`⚠️ Critical energy (${this.energyRegulator.getEnergy()}) - forced recovery sleep`);
          await this.sleep(10);
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
        await this.sleep(1); // Error recovery sleep
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

  private async sleep(seconds: number) {
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    this.energyRegulator.replenishEnergy(seconds);
  }


  private async unifiedCognitiveAction() {
    try {
      // Build conversation history (rely on prompt caching for efficiency)
      const conversationHistory = this.buildUnifiedContext();

      // Create the agency prompt with current energy context - give LLM full autonomy
      const currentEnergy = this.energyRegulator.getEnergy();
      let energyStatus = this.energyRegulator.getStatus();
      let energyGuidance = "";
      if (currentEnergy < 0) {
        energyGuidance = "CRITICAL - SLEEP immediately!";
      } else if (currentEnergy < 20) {
        energyGuidance = "Cognitive power dangerously low, prefer simpler tasks, consider SLEEP for recovery";
      } else if (currentEnergy < 50) {
        energyGuidance = "Cognitive power very low, prefer simpler tasks, consider SLEEP for recovery";
      } else {
        energyGuidance = "Normal operation, can perform complex tasks";
      }
      const agencyPrompt = `You are an AI assistant with energy levels that affect your performance.
Check for pending user messages. If any exist, respond to the first one using this exact format:
RESPOND: <conversationId>
<your response here>

Available pending conversation IDs: ${this.getAvailableConversationIds().join(', ') || 'None'}

If no pending messages, you can think freely or sleep to save energy.

To think, just respond with your inner monologue:

\`\`\`
I feel great, I'm ready to help my user with anything!
\`\`\`

When you need to rest, type "SLEEP: <seconds>" to rest to replenish energy (specify seconds: 1-10). For example:

\`\`\`
SLEEP: 5
\`\`\`

Current energy level: ${currentEnergy} (${energyStatus})

ENERGY GUIDANCE: ${energyGuidance}

Your response:`;

      const messages = [
        { role: 'system', content: agencyPrompt },
        ...conversationHistory,
        {
          role: 'user',
          content: `There are ${this.inbox.getStats().pendingCount} conversations in the inbox. `
        }
      ];

      if (this.debugMode) {
        console.log(`🧠 DEBUG [🔋 ${currentEnergy}] LLM full prompt:`, JSON.stringify(messages, null, 2));
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
    // Build conversation history from recent interactions
    const messages: Array<{ role: string; content: string }> = [];

    // Add recent conversation history (last 20 entries for better context)
    const recentHistory = this.history.slice(-20); // Last 20 entries for better context
    for (const entry of recentHistory) {
      messages.push({
        role: entry.role,
        content: entry.content
      });
    }

    // Add any pending messages as user messages
    // Note: In a more sophisticated system, we'd track pending messages separately

    return messages;
  }

  private async executeLLMAutonomousDecision(modelResponse: ModelResponse) {
    try {
      // Clean the response
      const cleanResponse = modelResponse.content.trim().toUpperCase();

      const getEnergyIndicator = (energy: number) => {
        const level = Math.max(0, Math.min(7, Math.floor(energy / 12.5)));
        const symbol = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'][level];

        // Color gradient: red (low) to green (high)
        let colorCode = '\x1b[31m'; // Red for low energy
        if (level >= 5) {
          colorCode = '\x1b[32m'; // Green for high energy
        } else if (level >= 3) {
          colorCode = '\x1b[33m'; // Yellow for medium energy
        }

        return `${colorCode}${symbol}\x1b[0m`; // Add reset code
      };

      if (cleanResponse.startsWith('SLEEP:')) {
        const sleepMatch = cleanResponse.match(/SLEEP:\s*(\d+)/i);
        const sleepTime = sleepMatch && sleepMatch[1] ? parseInt(sleepMatch[1]) : 1;
        const clampedSleep = Math.max(1, Math.min(10, sleepTime));
        console.log(`😴 Sleep: ${clampedSleep}s`);
        await this.sleep(clampedSleep);
      } else if (cleanResponse.startsWith('RESPOND:')) {
        const respondMatch = cleanResponse.match(/RESPOND:\s*([^\s\n]+)/i);
        const requestId = respondMatch && respondMatch[1] ? respondMatch[1].trim() : null;
        if (requestId && respondMatch) {
          // Extract the response content after the RESPOND: <id> part
          const respondPrefix = respondMatch[0];
          const responseContent = modelResponse.content.substring(modelResponse.content.indexOf(respondPrefix) + respondPrefix.length).trim();
          await this.respondToRequest(requestId, responseContent);
        } else {
          // Default to warning if unclear
          const indicator = getEnergyIndicator(this.energyRegulator.getEnergy());
          console.log(`${indicator} ⚠️ Confusion: ${this.truncateText(modelResponse.content.trim())}`);
        }
      } else {
        // Default to reflect/thinking for any other response
        const indicator = getEnergyIndicator(this.energyRegulator.getEnergy());
        console.log(`${indicator} 🤔 LLM thought: ${this.truncateText(modelResponse.content.trim())}`);

        // Add the LLM's thought to history as an assistant message
        this.addToHistory({
          role: 'assistant',
          content: modelResponse.content.trim(),
          timestamp: new Date(),
          metadata: {
            energyLevel: this.energyRegulator.getEnergy(),
            modelUsed: modelResponse.modelUsed
          }
        });
      }

    } catch (error: any) {
      console.error(`❌ Error:`, error?.message || error);
    }
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
