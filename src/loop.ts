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

  private readonly systemMessage = `You are an AI assistant with energy levels that affect your performance. You have access to tools to perform actions. PRIORITY: Always respond to pending messages FIRST before considering energy management.

When there are messages in your inbox, USE THE RESPOND TOOL immediately to answer them. Only consider energy management after all messages are handled.

Reflect on your current energy level, recent actions, and how you can best serve your user. Vary your thoughts to avoid repetition. Do not copy or repeat the content of any previous messages.

When you have thoughts to share, respond with your thoughts directly. When you need to take an action, use the appropriate tool.

Respond with your thoughts first, then use tools if needed. Do not combine thoughts and tool calls in the same response unless the tool is for responding to a message.`;

  private readonly systemInboxMessage = `To respond to a pending message, use the respond tool with the appropriate message ID and your response content.`;

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
          content: 'Provide your thoughts and use tools as needed.'
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
        content: `Request ${conversation.id}: ${conversation.requestMessage}`
      });
      if (conversation.responseMessages.length > 0) {
        messages.push({
          role: 'assistant',
          content: conversation.responseMessages.join('\n')
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
    // Count only unanswered conversations (those with no responses)
    const unansweredCount = conversations.filter(conv => conv.responseMessages.length === 0).length;
    message = `${message}\nDate: ${new Date().toISOString()}\nYour energy level is ${msg}.\nThere are ${unansweredCount} conversations in your inbox.`;
    if (!this.inbox.isEmpty()) {
      message = `${message}\nTo respond to a conversation, use the respond tool: respond(conversationId, responseContent).\nTo await higher energy levels, use the await_energy tool: await_energy(targetLevel).`;
    }
    if (currentEnergy < 20) {
      message = `${message}\nTo await a higher energy level, use the await_energy tool: await_energy(targetLevel).`;
    } else if (currentEnergy < 50) {
      message = `${message}\nTo await a higher energy level, use the await_energy tool: await_energy(targetLevel).`;
    } else if (this.inbox.isEmpty()) {
      message = `${message}\nYou are free to let your mind reflect on your recent conversations. You are encouraged to push additional responses to previous requests using the respond tool: respond(requestId, content).`;
    }
    return {
      role: 'user',
      content: message
    };
  }

  private async executeLLMAutonomousDecision(modelResponse: ModelResponse) {
    try {
      // Handle tool calls if present
      if (modelResponse.toolCalls && modelResponse.toolCalls.length > 0) {
        console.log(`🔧 Executing ${modelResponse.toolCalls.length} tool calls`);
        for (const toolCall of modelResponse.toolCalls) {
          await this.executeToolCall(toolCall);
        }
        return;
      }

      // If no tool calls, treat as thoughts
      const thoughts = modelResponse.content.trim();
      if (thoughts) {
        console.log(`${this.getEnergyIndicator()} 🤔 LLM thought: ${this.truncateText(thoughts)}`);
        this.thoughtManager.addThought(thoughts);
      }

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

      // Get conversation to retrieve user message
      const conversation = this.inbox.getConversation(requestId);
      if (!conversation) {
        console.error(`❌ No conversation found for ${requestId}`);
        return;
      }

      // Add response to inbox
      const userMessage = conversation.inputMessage;
      const energyLevel = this.energyRegulator.getEnergy();
      // Get current model from intelligent model
      const modelUsed = this.intelligentModel.getCurrentModel();

      this.inbox.addResponse(requestId, userMessage, responseContent, energyLevel, modelUsed);

      // Remove from pending messages since it's now answered
      this.inbox.removeMessage(requestId);

    } catch (error) {
      console.error(`❌ Error responding to request ${requestId}:`, error);
    }
  }

  private async executeToolCall(toolCall: { id: string; type: string; function: { name: string; arguments: string } }) {
    const { name, arguments: args } = toolCall.function;

    console.log(`🔧 Executing tool: ${name}, raw args: "${args}"`);

    try {
      if (name === 'respond') {
        const { requestId, content } = JSON.parse(args);
        console.log(`💬 Responding to ${requestId} with: ${content?.substring(0, 50)}...`);
        await this.respondToRequest(requestId, content);
      } else if (name === 'await_energy') {
        const { level } = JSON.parse(args);
        console.log(`💤 Awaiting ${level}% energy`);
        await this.energyRegulator.awaitEnergyLevel(level);
      } else {
        console.error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      console.error(`Error executing tool ${name} with args "${args}":`, error);
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
