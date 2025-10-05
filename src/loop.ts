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
  private reviewThoughtManager: ThoughtManager; // For conversation review thoughts (circular buffer)
  private conversationThoughtManager: ThoughtManager; // For focused conversation thoughts (in-memory)
  private isRunning = false;
  private debugMode = false;
  private selectedConversationId: string | null = null;

  constructor(debugMode: boolean = false, replenishRate: number = 1) {
    this.debugMode = debugMode;
    this.energyRegulator = new EnergyRegulator(replenishRate);
    this.intelligentModel = new IntelligentModel();
    this.inbox = new Inbox();
    this.reviewThoughtManager = new ThoughtManager();
    this.conversationThoughtManager = new ThoughtManager();
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

When reviewing previous conversations, you can also use the respond tool to add to, improve, or follow up on previous responses if you have additional valuable insights to share.

Use the think tool to record your internal thoughts and reflections. This helps you reason through complex problems and maintain continuity in your thinking. Always provide meaningful, substantive thoughts - never use the think tool with empty content.

Reflect on your current energy level, recent actions, and how you can best serve your user. Vary your thoughts to avoid repetition. Do not copy or repeat the content of any previous messages.

When you have thoughts to share, use the think tool with meaningful content first, then use other tools if needed. Do not combine thoughts and tool calls in the same response unless the tool is for responding to a message.`;

  private readonly systemInboxMessage = `To respond to a pending message, use the respond tool with the appropriate message ID and your response content.`;

  private async unifiedCognitiveAction() {
    try {
      // If a conversation is selected for focused improvement, handle it
      if (this.selectedConversationId) {
        await this.handleSelectedConversation();
        return;
      }

      // Get all recent conversations, then filter to unanswered ones only
      const allConversations = this.inbox.getRecentConversations(10);
      const unansweredConversations = allConversations.filter(conv => conv.responseMessages.length === 0);

      // Focus on the oldest unanswered conversation (highest priority)
      const targetConversation = unansweredConversations.length > 0 ? unansweredConversations[0] : null;

      let conversationsToInclude: Array<{ id: string; requestMessage: string; responseMessages: string[]; timestamp: Date }> = [];
      let instruction: string;

      if (targetConversation) {
        // Focus on one unanswered conversation
        conversationsToInclude = [targetConversation];
        instruction = `Focus on the conversation above and decide whether to respond using the respond tool or manage your energy using the await_energy tool.`;
      } else {
        // No unanswered conversations - review recent completed ones for potential improvements
        // Adjust review count based on energy level: more energy = more conversations to review
        const currentEnergyPercent = this.energyRegulator.getEnergyPercentage();
        // Linear interpolation: 0% energy = 1 conversation, 100% energy = 20 conversations
        const reviewCount = Math.max(1, Math.round(1 + (currentEnergyPercent / 100) * 19));

        const recentCompleted = this.inbox.getRecentCompletedConversations(reviewCount);
        conversationsToInclude = recentCompleted.map(conv => ({
          id: conv.requestId,
          requestMessage: `${conv.inputMessage || ''} [Energy consumed: ${conv.metadata.totalEnergyConsumed.toFixed(1)} units, ${conv.responses.length} responses]`,
          responseMessages: conv.responses.map(r => r.content),
          timestamp: new Date() // Use current time for ordering
        }));
        instruction = conversationsToInclude.length > 0
          ? `Review the recent conversations above. Use the select_conversation tool to choose one for adding to, or use await_energy to manage energy.`
          : 'No recent conversations to review. You can think, reflect, or manage your energy as needed.';
      }

      const messages = [
        this.getSystemMessage(targetConversation),
        ...this.getConversationMessages(conversationsToInclude),
        ...this.getThoughts(false), // Not conversation-focused, so only review thoughts
        this.getEphemeralSystemMessage(conversationsToInclude, unansweredConversations.length),
        {
          role: 'user',
          content: instruction
        }
      ];

      if (this.debugMode) {
        console.log(`${this.getEnergyIndicator()} DEBUG LLM full prompt:`, JSON.stringify(messages, null, 2));
      }

      // Determine which tools to allow based on context
      let allowedTools: string[];
      if (targetConversation) {
        // Answering unanswered conversation
        allowedTools = ['respond', 'await_energy', 'think'];
      } else {
        // Reviewing completed conversations for potential improvements
        allowedTools = ['select_conversation', 'await_energy', 'think'];
      }

      const modelResponse = await this.intelligentModel.generateResponse(messages, this.energyRegulator, false, allowedTools);

      await this.executeLLMAutonomousDecision(modelResponse);

    } catch (error: any) {
      console.error(`❌ Thinking error:`, error?.message || error);
    }
  }

  private getSystemMessage(targetConversation: { id: string; requestMessage: string; responseMessages: string[]; timestamp: Date } | null | undefined) {
    let message = !targetConversation ? this.systemMessage : this.systemMessage + '\n\n' + this.systemInboxMessage;
    return { role: 'system', content: message };
  }

  private getThoughts(isConversationFocused: boolean = false): Array<{ role: string; content: string }> {
    const thoughts: Array<{ role: string; content: string }> = [];

    // Always include review thoughts for context
    if (this.reviewThoughtManager.hasThoughts()) {
      thoughts.push({
        role: 'assistant',
        content: this.reviewThoughtManager.getConcatenatedThoughts()
      });
    }

    // Include conversation thoughts only when focused on a conversation
    if (isConversationFocused && this.conversationThoughtManager.hasThoughts()) {
      thoughts.push({
        role: 'assistant',
        content: this.conversationThoughtManager.getConcatenatedThoughts()
      });
    }

    return thoughts;
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

  private getEphemeralSystemMessage(conversationsToInclude: Array<{ id: string; requestMessage: string; responseMessages: string[]; timestamp: Date }>, totalUnansweredCount: number) {
    let message = '(ephemeral)\n';
    const currentEnergy = this.energyRegulator.getEnergy();
    const energyStatus = this.energyRegulator.getStatus();
    const msg = `${this.energyRegulator.getEnergyPercentage()}% (${energyStatus})`;
    message = `${message}\nDate: ${new Date().toISOString()}\nYour energy level is ${msg}.\nThere are ${totalUnansweredCount} total unanswered conversations.`;
    if (conversationsToInclude.length > 0) {
      message = `${message}\nYou are currently focused on one conversation. Use the respond tool to add a response, or use await_energy to manage your energy.`;
    }
    if (currentEnergy < 20) {
      message = `${message}\nTo await a higher energy level, use the await_energy tool: await_energy(targetLevel).`;
    } else if (currentEnergy < 50) {
      message = `${message}\nTo await a higher energy level, use the await_energy tool: await_energy(targetLevel).`;
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
        // Add to appropriate thought manager based on context
        if (this.selectedConversationId) {
          this.conversationThoughtManager.addThought(thoughts);
        } else {
          this.reviewThoughtManager.addThought(thoughts);
        }
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
        // Add a thought to inform the LLM about this error
        const errorThought = `I tried to respond to conversation ${requestId}, but it doesn't exist. This might be an old or invalid conversation ID. I should check available conversations before responding.`;
        if (this.selectedConversationId) {
          this.conversationThoughtManager.addThought(errorThought);
        } else {
          this.reviewThoughtManager.addThought(errorThought);
        }
        return;
      }

      // Add response to inbox - this handles both new responses and additions to existing conversations
      const userMessage = conversation.inputMessage;
      const energyLevel = this.energyRegulator.getEnergy();
      // Get current model from intelligent model
      const modelUsed = this.intelligentModel.getCurrentModel();

      this.inbox.addResponse(requestId, userMessage, responseContent, energyLevel, modelUsed);

      // Only remove from pending messages if this was an unanswered conversation
      // For completed conversations, we don't remove them from pending since they're already answered
      const pendingMessages = this.inbox.getPendingMessages();
      const isPending = pendingMessages.some(msg => msg.id === requestId);
      if (isPending) {
        this.inbox.removeMessage(requestId);
      }

    } catch (error: any) {
      console.error(`❌ Error responding to request ${requestId}:`, error);
    }
  }

  private async handleSelectedConversation() {
    if (!this.selectedConversationId) return;

    // Get the selected conversation
    const conversation = this.inbox.getConversation(this.selectedConversationId);
    if (!conversation) {
      console.error(`❌ Selected conversation ${this.selectedConversationId} not found`);
      this.selectedConversationId = null;
      return;
    }

    const conversationsToInclude = [{
      id: conversation.requestId,
      requestMessage: `${conversation.inputMessage || ''} [Energy consumed: ${conversation.metadata.totalEnergyConsumed.toFixed(1)} units, ${conversation.responses.length} responses]`,
      responseMessages: conversation.responses.map(r => r.content),
      timestamp: new Date()
    }];

    const messages = [
      this.getSystemMessage(null), // No target conversation since we're improving an existing one
      ...this.getConversationMessages(conversationsToInclude),
      ...this.getThoughts(true), // Conversation-focused, so include conversation thoughts
      this.getEphemeralSystemMessage(conversationsToInclude, 0), // 0 unanswered since we're reviewing completed
      {
        role: 'user',
        content: `You have selected this conversation for focused improvement. To add a response to the previous responses, use the respond tool, or use await_energy to manage your energy.`
      }
    ];

    if (this.debugMode) {
      console.log(`${this.getEnergyIndicator()} DEBUG LLM full prompt (selected conversation):`, JSON.stringify(messages, null, 2));
    }

    const modelResponse = await this.intelligentModel.generateResponse(messages, this.energyRegulator, false, ['respond', 'await_energy', 'think']);

    // Clear the selection after handling
    this.selectedConversationId = null;

    await this.executeLLMAutonomousDecision(modelResponse);
  }

  private async selectConversation(requestId: string) {
    console.log(`🎯 Selecting conversation ${requestId} for focused improvement`);
    this.selectedConversationId = requestId;

    // Immediately trigger another cognitive action focused on this conversation
    await this.unifiedCognitiveAction();
  }

  private async executeToolCall(toolCall: { id: string; type: string; function: { name: string; arguments: string } }) {
    const { name, arguments: args } = toolCall.function;

    console.log(`🔧 Executing tool: ${name}, raw args: "${args}"`);

    try {
      if (name === 'respond') {
        try {
          const { requestId, content } = JSON.parse(args);
          console.log(`💬 Responding to ${requestId} with: ${content?.substring(0, 50)}...`);
          await this.respondToRequest(requestId, content);
        } catch (parseError) {
          console.log(`💬 Malformed respond tool call with args "${args}", ignoring`);
        }
      } else if (name === 'await_energy') {
        try {
          const { level } = JSON.parse(args);
          console.log(`💤 Awaiting ${level}% energy`);
          await this.energyRegulator.awaitEnergyLevel(level);
        } catch (parseError) {
          console.log(`💤 Malformed await_energy tool call with args "${args}", ignoring`);
        }
      } else if (name === 'select_conversation') {
        try {
          const { requestId } = JSON.parse(args);
          console.log(`🎯 Selecting conversation ${requestId} for improvement`);
          await this.selectConversation(requestId);
        } catch (parseError) {
          console.log(`🎯 Malformed select_conversation tool call with args "${args}", ignoring`);
        }
      } else if (name === 'think') {
        try {
          const { thought } = JSON.parse(args);
          if (thought && thought.trim()) {
            console.log(`🤔 Thinking: ${this.truncateText(thought)}`);
            // Add to appropriate thought manager based on context
            if (this.selectedConversationId) {
              this.conversationThoughtManager.addThought(thought);
            } else {
              this.reviewThoughtManager.addThought(thought);
            }
          } else {
            console.log(`🤔 Empty thought received, ignoring`);
          }
        } catch (parseError) {
          console.log(`🤔 Malformed think tool call with args "${args}", ignoring`);
        }
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
