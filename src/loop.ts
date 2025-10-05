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
  private energyRegulator: EnergyRegulator;
  private intelligentModel: IntelligentModel;
  private inbox: Inbox;
  private isRunning = false;
  private debugMode = false;

  constructor(debugMode: boolean = false, replenishRate: number = 1) {
    this.debugMode = debugMode;
    this.energyRegulator = new EnergyRegulator(replenishRate);
    this.intelligentModel = new IntelligentModel();
    this.inbox = new Inbox();
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

        for (const message of messageQueue.splice(0)) {
          this.inbox.addMessage(message);
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

To respond to a pending message, use this exact XML format:
<RESPOND id="message-id">Your response here</RESPOND>

To think, just respond with your inner monologue as plain text (no formatting, bold, or markdown). Reflect on your current energy level, recent actions, and how you can best serve your user. Vary your thoughts to avoid repetition. Do not copy or repeat the content of any previous messages.

To await a higher energy level, use this exact XML format:
<AWAIT_ENERGY level="100"/>

When energy is low, ALWAYS choose to AWAIT_ENERGY instead of thinking. Aim to stay above 50% energy.

Respond exactly as instructed above. No extra text, formatting, or deviations.`;

  private async unifiedCognitiveAction() {
    try {
      const systemMessage = this.systemMessage;


      const messages = [
        { role: 'system', content: systemMessage },
        ...this.buildUnifiedContext()
      ];

      if (this.debugMode) {
        console.log(`🧠 DEBUG [🔋 ${this.energyRegulator.getEnergyPercentage()}%] LLM full prompt:`, JSON.stringify(messages, null, 2));
      }

      const modelResponse = await this.intelligentModel.generateResponse(messages, this.energyRegulator.getEnergy(), false);

      this.energyRegulator.consumeEnergy(modelResponse.energyConsumed);

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
          content: `[${conversation.requestId}]: ${conversation.inputMessage}`
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

    let energyMessage = this.getEnergySystemMessage();
    messages.push({
      role: 'system',
      content: energyMessage
    });
    return messages;
  }

  private getEnergySystemMessage() {
    const currentEnergy = this.energyRegulator.getEnergy();
    const energyStatus = this.energyRegulator.getStatus();
    const msg = `${this.energyRegulator.getEnergyPercentage()}% (${energyStatus})`;
    let energyMessage = `System date: ${new Date().toISOString()}\nYour energy level is ${msg}.`;
    if (currentEnergy < 20) {
      energyMessage = `${energyMessage}.\nTo await a higher energy level, use this exact XML format: <AWAIT_ENERGY level="100"/>.`;
    } else if (currentEnergy < 50) {
      energyMessage = `${energyMessage}.\nTo await a higher energy level, use this exact XML format: <AWAIT_ENERGY level="100"/>.`;
    }
    return energyMessage;
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

      console.log(`${this.getEnergyIndicator()} 🤔 LLM thought: ${this.truncateText(cleanResponse)}`);

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

  private async respondToRequest(requestId: string, responseContent: string) {
    try {
      console.log(`💬 Response to ${requestId}: ${this.truncateText(responseContent)}`);

      // TODO Add response to inbox

      // TODO this.inbox.markAsDone(requestId);

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
