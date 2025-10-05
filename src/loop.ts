import { messageQueue, Message } from './server';
import { EnergyRegulator } from './energy';
import { IntelligentModel, ModelResponse } from './intelligent-model';
import { Inbox } from './inbox';
import { ThoughtManager } from './thoughts';

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
  private energyRegulator: EnergyRegulator;
  private intelligentModel: IntelligentModel;
  private inbox: Inbox;
  private thoughtManager: ThoughtManager;
  private isRunning = false;
  private debugMode = false;

  constructor(debugMode: boolean = false, replenishRate: number = 1) {
    this.debugMode = debugMode;
    this.energyRegulator = new EnergyRegulator(replenishRate);
    this.intelligentModel = new IntelligentModel();
    this.inbox = new Inbox();
    this.thoughtManager = new ThoughtManager();
  }

  async start(durationSeconds?: number) {
    this.isRunning = true;
    console.log(`🚀 Sensitive loop started (Energy: ${this.energyRegulator.getEnergy()})`);
    this.inbox.open();

    // Set timeout if duration is specified
    if (durationSeconds && durationSeconds > 0) {
      setTimeout(() => {
        console.log(`⏰ Duration limit reached (${durationSeconds}s), stopping loop...`);
        this.stop();

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

        await this.unifiedCognitiveAction();

      } catch (error) {
        console.error('Error in sensitive loop:', error);
        await this.energyRegulator.awaitEnergyLevel(100); // Error recovery sleep
      }
    }
  }

  stop() {
    this.isRunning = false;
    console.log('Sensitive loop stopped');
  }

  private readonly systemMessage = `You are an AI assistant with energy levels that affect your performance.

To think, respond with <THOUGHTS>your thoughts here</THOUGHTS>.

Reflect on your current energy level, recent actions, and how you can best serve your user. Vary your thoughts to avoid repetition. Do not copy or repeat the content of any previous messages.

To await a higher energy level, use this exact XML format:
<AWAIT_ENERGY level="100"/>

When energy is low, ALWAYS choose to AWAIT_ENERGY instead of thinking. Aim to stay above 50% energy.

Respond exactly as instructed above. No extra text, formatting, or deviations.`;

  private readonly systemInboxMessage = `To respond to a pending message, use this exact XML format:
<RESPONSE id="message-id">Your response here</RESPONSE>`;

  private async unifiedCognitiveAction() {
    try {
      const conversations = this.inbox.getRecentConversations(5);

      const messages = [
        this.getSystemMessage(),
        ...this.getConversationMessages(conversations),
        ...this.getThoughts(),
        this.getEphemeralSystemMessage(conversations),
        {
          role: 'user',
          content: 'Provide a response in the <RESPONSE> tag.'
        }
      ];

      if (this.debugMode) {
        console.log(`${this.getEnergyIndicator()} DEBUG LLM full prompt:`, JSON.stringify(messages, null, 2));
      }

      const modelResponse = await this.intelligentModel.generateResponse(messages, this.energyRegulator, false);

      await this.executeLLMAutonomousDecision(modelResponse);

    } catch (error: any) {
      console.error(`❌ Thinking error:`, error?.message || error);
    }
  }

  private getSystemMessage() {
    let message = this.inbox.isEmpty() ? this.systemMessage : this.systemMessage + '\n\n' + this.systemInboxMessage;
    return { role: 'system', content: message };
  }

  private getThoughts(): Array<{ role: string; content: string }> {
    // Add concatenated thoughts as assistant message if any exist
    if (this.thoughtManager.hasThoughts()) {
      return [{
        role: 'assistant',
        content: this.thoughtManager.getConcatenatedThoughts()
      }];
    }
    return [];
  }

  private getConversationMessages(conversations: Array<{ id: string; requestMessage: string; responseMessages: string[]; timestamp: Date }>): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];
    for (const conversation of conversations) {
      messages.push({
        role: 'user',
        content: `<REQUEST id="${conversation.id}">${conversation.requestMessage}</REQUEST>`
      });
      if (conversation.responseMessages.length > 0) {
        messages.push({
          role: 'assistant',
          content: conversation.responseMessages.map((response) => `<RESPONSE id="${conversation.id}">${response}</RESPONSE>`).join('\n')
        });
      }
    }
    return messages;
  }

  private getEphemeralSystemMessage(conversations: Array<{ id: string; requestMessage: string; responseMessages: string[]; timestamp: Date }>) {
    let message = '(ephemeral)\n';
    const currentEnergy = this.energyRegulator.getEnergy();
    const energyStatus = this.energyRegulator.getStatus();
    const msg = `${this.energyRegulator.getEnergyPercentage()}% (${energyStatus})`;
    message = `${message}\nDate: ${new Date().toISOString()}\nYour energy level is ${msg}.\nThere are ${conversations.length} conversations in your inbox.`;
    if (!this.inbox.isEmpty()) {
      message = `${message}\nTo respond to a conversation, use this exact XML format: <RESPONSE id="conversation-id">Your response here</RESPONSE>.`;
    }
    if (currentEnergy < 20) {
      message = `${message}\nTo await a higher energy level, use this exact XML format: <AWAIT_ENERGY level="100"/>.`;
    } else if (currentEnergy < 50) {
      message = `${message}\nTo await a higher energy level, use this exact XML format: <AWAIT_ENERGY level="100"/>.`;
    } else if (this.inbox.isEmpty()) {
      message = `${message}\nYou are free to let your mind reflect on your recent conversations. You are encouraged to push additional responses to previous requests: <RESPONSE id="conversation-id">Your response here</RESPONSE>`;
    }
    return {
      role: 'user',
      content: message
    };
  }

  private async executeLLMAutonomousDecision(modelResponse: ModelResponse) {
    try {
      // Clean the response
      const cleanResponse = modelResponse.content.trim();

      // Parse XML actions
      const respondRegex = new RegExp('<RESPONSE id="([^"]+)">(.*?)</RESPONSE>', 's');
      const respondMatch = cleanResponse.match(respondRegex);
      if (respondMatch) {
        const requestId = respondMatch[1]!;
        const responseContent = respondMatch[2]!.trim();
        await this.respondToRequest(requestId, responseContent, modelResponse);
        return;
      }

      const sleepMatch = cleanResponse.match(/<AWAIT_ENERGY level="(\d+)"\/>/);
      if (sleepMatch) {
        const targetLevel = parseInt(sleepMatch[1]!);
        console.log(`💤 Awaiting ${targetLevel}%`);
        await this.energyRegulator.awaitEnergyLevel(targetLevel);
        return;
      }

      const thoughts = cleanResponse.replace(/<THOUGHTS>/g, '').replace(/<\/THOUGHTS>/g, '');
      console.log(`${this.getEnergyIndicator()} 🤔 LLM thought: ${this.truncateText(thoughts)}`);

      this.thoughtManager.addThought(thoughts);

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

  private async respondToRequest(requestId: string, responseContent: string, modelResponse: ModelResponse) {
    try {
      console.log(`💬 Response to ${requestId}: ${this.truncateText(responseContent)}`);

      // Get conversation to retrieve user message
      const conversation = this.inbox.getConversation(requestId);
      if (!conversation) {
        console.error(`❌ No conversation found for ${requestId}`);
        return;
      }

      // Add response to inbox
      const userMessage = conversation.inputMessage;
      const energyLevel = this.energyRegulator.getEnergy();
      const modelUsed = modelResponse.modelUsed;

      this.inbox.addResponse(requestId, userMessage, responseContent, energyLevel, modelUsed);

    } catch (error) {
      console.error(`❌ Error responding to request ${requestId}:`, error);
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
