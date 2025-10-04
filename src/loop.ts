import { messageQueue, Message } from './server';
import { EnergyRegulator } from './energy';
import { respond, getConversation, getConversationStats, getRecentConversationIds } from './tools';
import { IntelligentModel } from './intelligent-model';

interface ConversationEntry {
  role: 'user' | 'assistant' | 'system';
  content: string;
  energyLevel?: number;
  requestId?: string;
  timestamp?: Date;
}

export class SensitiveLoop {
  private history: ConversationEntry[] = [];
  // Removed time-based throttling - now purely energy-based
  private energyRegulator = new EnergyRegulator();
  private intelligentModel: IntelligentModel;
  private isRunning = false;
  private modelSwitches = 0;
  private readonly MAX_HISTORY_LENGTH = 100;

  constructor() {
    this.intelligentModel = new IntelligentModel();
    
    // Initialize with system prompt
    this.history.push({
      role: 'system',
      content: `You are an AI assistant with energy levels that affect your performance.
Your current energy level will be communicated to you. When energy is low, you should be more concise.
You have access to a 'respond' tool to reply to specific request IDs.`,
      timestamp: new Date()
    });

    // Load past conversation context on startup
    this.loadConversationContext();
  }

  private loadConversationContext() {
    try {
      // Load recent conversation history as context
      const recentIds = this.getRecentConversationIds();
      for (const convId of recentIds.slice(0, 5)) { // Load last 5 conversations for context
        const conversation = getConversation(convId);
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
                energyLevel: response.energyLevel,
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

  async start() {
    this.isRunning = true;
    console.log(`🚀 Sensitive loop started (Energy: ${this.energyRegulator.getEnergy()})`);
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

        // Check for new messages
        const newMessages = messageQueue.splice(0); // Get all pending messages

        // Process new messages (add to history)
        for (const message of newMessages) {
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

  stop() {
    this.isRunning = false;
    console.log('Sensitive loop stopped');
  }

  private addToHistory(entry: ConversationEntry) {
    this.history.push(entry);
  }

  private async performInference(message: Message, urgent: boolean) {
    try {
      // Get conversation-specific history for context
      const conversationHistory = this.getConversationHistory(message.id);

      // Add the current user message to history
      conversationHistory.push({
        role: 'user',
        content: message.content
      });

      // Add current energy status as system message
      const energyStatus = `Current energy level: ${this.energyRegulator.getEnergy()} (${this.energyRegulator.getStatus()})`;
      conversationHistory.push({
        role: 'system',
        content: energyStatus
      });

      const modelResponse = await this.intelligentModel.generateResponse(conversationHistory, this.energyRegulator.getEnergy(), false);

      // Consume the energy that was used
      this.energyRegulator.consumeEnergy(modelResponse.energyConsumed);

      // Add response to global history
      this.addToHistory({
        role: 'assistant',
        content: modelResponse.content,
        timestamp: new Date(),
        energyLevel: this.energyRegulator.getEnergy(),
        requestId: message.id
      });

      // Use tool to respond
      await respond(message.id, message.content, modelResponse.content, this.energyRegulator.getEnergy(), modelResponse.modelUsed, this.modelSwitches);

      console.log(`💬 Processed: "${this.truncateText(message.content)}..."`);

    } catch (error) {
      console.error(`❌ Inference error for message ${message.id} (Energy: ${this.energyRegulator.getEnergy()}):`, error);
    }
  }

  private getConversationHistory(requestId: string): Array<{ role: string; content: string }> {
    // Load the full conversation history from database
    const conversation = getConversation(requestId);

    if (!conversation || !conversation.responses) {
      return [];
    }

    // Convert database format to the format expected by generateResponse
    const history: Array<{ role: string; content: string }> = [];

    // Add the original user message
    if (conversation.inputMessage && conversation.inputMessage !== 'Input message to be populated') {
      history.push({
        role: 'user',
        content: conversation.inputMessage
      });
    }

    // Add all previous responses
    for (const response of conversation.responses) {
      // Add the user message that prompted this response (if available)
      // For now, we'll reconstruct based on the response content
      // In a more sophisticated system, we'd store the exact user message

      // Add the assistant response
      history.push({
        role: 'assistant',
        content: response.content
      });
    }

    return history;
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
      const energyStatus = this.energyRegulator.getStatus();

      const agencyPrompt = `Current energy level: ${currentEnergy} (${energyStatus})

ENERGY GUIDANCE:
- Energy > 50: Normal operation, can perform complex tasks
- Energy 20-50: Prefer simpler tasks, consider SLEEP for recovery
- Energy 0-20: Recommend SLEEP, use short cycles for any urgent tasks
- Energy < 0: URGENT MODE - SLEEP in minimal cycles, be very urgent/pressing

Examples:

# Thinking

To think, just respond with your thoughts:

\`\`\`
I feel great, I'm ready to help my user with anything!
\`\`\`

# SLEEP

When you need to rest, type "SLEEP: <seconds>" to rest to replenish energy (specify seconds: 1-10). For example:

\`\`\`
SLEEP: 5
\`\`\`

# RESPOND

To respond to a specific pending request, type "RESPOND: <requestId>" before providing the response. For example:

\`\`\`
RESPOND: 12345
Interesting question. Let me think...
\`\`\`

You have access to past conversation history above.

Available conversation IDs: ${this.getAvailableConversationIds().join(', ')}

Your response:`;

      const messages = [
        ...conversationHistory, // Full conversation history (cached)
        { role: 'user', content: agencyPrompt } // Current energy context
      ];

      const modelResponse = await this.intelligentModel.generateResponse(messages, this.energyRegulator.getEnergy(), false);

      // Consume the energy that was used
      this.energyRegulator.consumeEnergy(modelResponse.energyConsumed);

      // Execute LLM decision directly
      await this.executeLLMAutonomousDecision(modelResponse.content);

    } catch (error: any) {
      console.error(`❌ Thinking error:`, error?.message || error);
    }
  }

  private buildUnifiedContext(): Array<{ role: string; content: string }> {
    // Build conversation history from recent interactions
    const messages: Array<{ role: string; content: string }> = [];

    // Add recent conversation history (last few exchanges for context)
    const recentHistory = this.history.slice(-6); // Last 6 entries for good context
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

  private async executeLLMAutonomousDecision(llmResponse: string) {
    try {
      // Clean the response
      const cleanResponse = llmResponse.trim().toUpperCase();

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

      if (cleanResponse.startsWith('REFLECT')) {
        const indicator = getEnergyIndicator(this.energyRegulator.getEnergy());
        console.log(`${indicator} 🤔 LLM thought: ${this.truncateText(llmResponse.trim())}`);
      } else if (cleanResponse.includes('SLEEP:')) {
        const sleepMatch = cleanResponse.match(/SLEEP:\s*(\d+)/i);
        const sleepTime = sleepMatch && sleepMatch[1] ? parseInt(sleepMatch[1]) : 1;
        const clampedSleep = Math.max(1, Math.min(10, sleepTime));
        console.log(`😴 LLM sleep: ${clampedSleep}s`);
        console.log(`🤔 LLM thought: ${this.truncateText(llmResponse.trim())}`);
        await this.sleep(clampedSleep);
      } else if (cleanResponse.includes('RESPOND:')) {
        const respondMatch = cleanResponse.match(/RESPOND:\s*(.+)/i);
        const requestId = respondMatch && respondMatch[1] ? respondMatch[1].trim() : null;
        if (requestId) {
          console.log(`💬 AI choosing to respond to request: ${requestId}`);
          console.log(`🤔 LLM thought: ${this.truncateText(llmResponse.trim())}`);
          await this.respondToRequest(requestId);
        } else {
          // Default to reflect if unclear
          const indicator = getEnergyIndicator(this.energyRegulator.getEnergy());
          console.log(`${indicator} 🤔 LLM thought: ${this.truncateText(llmResponse.trim())}`);
        }
      } else {
        // Default to reflect if unclear
        const indicator = getEnergyIndicator(this.energyRegulator.getEnergy());
        console.log(`${indicator} 🤔 LLM thought: ${this.truncateText(llmResponse.trim())}`);
      }

    } catch (error: any) {
      console.error(`❌ Decision error:`, error?.message || error);
    }
  }

  private getAvailableConversationIds(): string[] {
    try {
      // Get recent conversation IDs that might need responses
      const recentIds = this.getRecentConversationIds();
      // For now, return all recent conversations - AI can decide which ones need responses
      // In the future, we could filter for conversations with input but no responses
      return recentIds.slice(0, 5); // Limit to 5 to keep prompt manageable
    } catch (error) {
      console.error('Error getting available conversation IDs:', error);
      return [];
    }
  }

  private async respondToRequest(requestId: string) {
    try {
      // Create a synthetic message for the existing request
      // The conversation history will be loaded from the database based on requestId
      const syntheticMessage: Message = {
        id: requestId,
        content: '[AI-initiated response to existing request]', // Placeholder content
        timestamp: new Date()
      };

      // Use the existing performInference logic to generate and save the response
      await this.performInference(syntheticMessage, false);

    } catch (error) {
      console.error(`❌ Error responding to request ${requestId}:`, error);
    }
  }

  private getRecentConversationIds(): string[] {
    try {
      // Get recent conversation IDs from the database
      return getRecentConversationIds(10); // Get last 10 conversations
    } catch (error) {
      console.error('Error getting recent conversation IDs:', error);
      return [];
    }
  }

  private truncateText(text: string, maxLength: number = 200): string {
    const processedText = text.replace(/\n/g, '');
    return processedText.length > maxLength ? processedText.substring(0, maxLength) + '...' : processedText;
  }
}

export const sensitiveLoop = new SensitiveLoop();
