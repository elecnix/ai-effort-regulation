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
  private readonly MAX_HISTORY_LENGTH = 10;
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
      // Check if there are pending messages - if so, respond to the first one directly
      const pendingIds = this.getAvailableConversationIds();
      if (pendingIds.length > 0) {
        const firstId = pendingIds[0]!;
        const userMessage: string = this.inbox.getPendingMessages().find(m => m.id === firstId)?.content || 'Unknown message';
        const responseContent = `Thank you for your message: "${userMessage}". I am processing it now.`;
        await this.respondToRequest(firstId, responseContent);
        return;
      }

      // No pending messages - proceed with autonomous thinking/sleeping
      // If energy is urgent, force sleep to avoid LLM failures
      if (this.energyRegulator.getEnergy() < 0) {
        console.log(`⚠️ Urgent energy (${this.energyRegulator.getEnergy()}) - forced recovery sleep`);
        await this.energyRegulator.sleep(10);
        return;
      }

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

If no pending messages, you can think freely or sleep to save energy.

To think, just respond with your inner monologue as plain text (no formatting, bold, or markdown). Reflect on your current energy level, recent actions, and how you can best serve your user. Vary your thoughts to avoid repetition. Do not copy or repeat the content of any previous messages.

To sleep, use this exact XML format:
<SLEEP seconds="5"/>

Current energy level: ${this.energyRegulator.getEnergyPercentage()}% (${energyStatus})

ENERGY GUIDANCE: ${energyGuidance}

When energy is low, ALWAYS choose to SLEEP instead of thinking. Aim to stay above 50% energy.

Respond exactly as instructed above. No extra text, formatting, or deviations.`;

      this.addToHistory({
        role: 'system',
        content: `There are ${this.inbox.getStats().pendingCount} conversations in the inbox. Your energy level is ${this.energyRegulator.getEnergyPercentage()}% (${energyStatus}).`
      });

      const messages = [
        { role: 'system', content: agencyPrompt },
        ...conversationHistory,
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
    // Build conversation history from recent interactions
    const messages: Array<{ role: string; content: string }> = [];

    // Add recent conversation history (last 5 entries for better context)
    const recentHistory = this.history.slice(-5); // Last 5 entries for better context
    for (const entry of recentHistory) {
      messages.push({
        role: entry.role,
        content: entry.content
      });
    }

    // Ensure the last message is not from assistant to avoid LLM confusion
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last!.role === 'assistant') {
        messages.pop();
      }
    }

    return messages;
  }

  private async executeLLMAutonomousDecision(modelResponse: ModelResponse) {
    try {
      // Clean the response
      const cleanResponse = modelResponse.content.trim();

      // Parse XML actions
      const respondMatch = cleanResponse.match(/<RESPOND id="([^"]+)">(.*?)<\/RESPOND>/s);
      if (respondMatch) {
        const requestId = respondMatch[1]!;
        const responseContent = respondMatch[2]!.trim();
        await this.respondToRequest(requestId, responseContent);
        return;
      }

      const sleepMatch = cleanResponse.match(/<SLEEP seconds="(\d+)"\/>/);
      if (sleepMatch) {
        const sleepTime = parseInt(sleepMatch[1]!);
        const clampedSleep = Math.max(1, Math.min(10, sleepTime));
        console.log(`😴 Sleep: ${clampedSleep}s`);
        await this.energyRegulator.sleep(clampedSleep);
        return;
      }

      // Default to thinking/reflecting
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
