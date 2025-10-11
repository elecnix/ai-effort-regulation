import { messageQueue, Message } from './server';
import { EnergyRegulator } from './energy';
import { IntelligentModel, ModelResponse } from './intelligent-model';
import { Inbox } from './inbox';
import { ThoughtManager } from './thoughts';
import { MCPSubAgent } from './mcp-subagent';
import { MCPClientManager } from './mcp-client';

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
  private mcpSubAgent: MCPSubAgent;
  private mcpClient: MCPClientManager;
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
    this.mcpSubAgent = new MCPSubAgent(debugMode);
    this.mcpClient = new MCPClientManager();
  }

  async start(durationSeconds?: number) {
    this.isRunning = true;
    console.log(`🚀 Sensitive loop started (Energy: ${this.energyRegulator.getEnergy()})`);
    this.inbox.open();
    
    // Start MCP sub-agent
    this.mcpSubAgent.start();
    console.log('🔌 MCP Sub-Agent started');

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
        await this.energyRegulator.awaitEnergyLevel(this.intelligentModel.getEstimatedEnergyCost());
        await this.unifiedCognitiveAction();
      } catch (error) {
        console.error('Error in sensitive loop:', error);
        await this.energyRegulator.awaitEnergyLevel(100); // Error recovery sleep
      }
    }
  }

  async stop() {
    this.isRunning = false;
    
    // Stop MCP sub-agent
    await this.mcpSubAgent.stop();
    console.log('🔌 MCP Sub-Agent stopped');
    
    console.log('Sensitive loop stopped');
  }


  private readonly systemMessage = `You are an AI assistant with energy levels that affect your performance. Every action you take consumes energy. You have access to tools to perform actions.

IMPORTANT: When using tools, you must call them properly through the tool calling interface. The system will provide you with conversation IDs in the format: "Conversation XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX: message content"

When you see a conversation, extract ONLY the UUID part (the XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX) to use as the requestId in your tool calls.

Key rules:
1. When there are conversations in your inbox, USE THE RESPOND TOOL immediately to answer them with YOUR response
   - In the content parameter, provide YOUR answer/reply to the user's question (NOT the user's message)
   - Example: If user asks "What is 2+2?", respond with content: "The answer is 4" (NOT "What is 2+2?")
2. Extract the UUID from "Conversation UUID: content" format
3. Use the think tool only for internal reflection when the next action is unclear
4. Use end_conversation when a conversation is complete
5. Use snooze_conversation to delay handling a conversation
6. Use await_energy to wait for energy recovery - THIS IS YOUR OWN ENERGY MANAGEMENT TOOL, NOT AN MCP TOOL

Energy Budget Management:
- Some conversations may have an energy budget (soft target) specified by the user
- Budget of 0 means this is your LAST CHANCE to respond - make it count with critical information
- Budget > 0 means aim to stay within that energy allocation, but you can exceed if necessary
- No budget means use your normal energy management strategy
- Budget is a SOFT target - prioritize quality over strict adherence
- When budget is low or exceeded, focus on wrapping up efficiently
- Use set_budget to establish or update energy budgets for conversations
- Use adjust_budget to incrementally modify budgets (add or subtract energy)

Approval System:
- Use respond_with_approval when proposing actions that need user confirmation
- This is useful for potentially risky, significant, or resource-intensive actions
- When a user approves/rejects, you'll receive feedback in the conversation context
- Approval requests consume energy but allow users to control what you do
- Users can approve/reject and also adjust budgets in their approval responses

MCP (Model Context Protocol) Tools:
- You have access to MCP servers that provide additional capabilities
- Use mcp_add_server to connect to a new MCP server (e.g., filesystem, github)
- Use mcp_list_servers to see what servers are available
- Use mcp_call_tool to invoke tools from connected MCP servers
- The MCP sub-agent handles server management asynchronously in the background
- IMPORTANT: await_energy, respond, think, end_conversation, snooze_conversation, and select_conversation are YOUR CORE TOOLS, NOT MCP tools

Your energy affects your responses:
- High energy (>50%): Normal, detailed responses
- Medium energy (20-50%): Concise responses, consider resting
- Low energy (<20%): Brief responses, prioritize rest
- Urgent (<0%): Minimal responses, must rest immediately`;

  private readonly systemInboxMessage = `To respond to a pending conversation, use the respond tool with the appropriate conversation ID and your response content.`;

  private async unifiedCognitiveAction() {
    try {
      // Poll MCP sub-agent for energy consumption
      const subAgentEnergy = this.mcpSubAgent.getEnergyConsumedSinceLastPoll();
      if (subAgentEnergy > 0) {
        this.energyRegulator.consumeEnergy(subAgentEnergy);
        if (this.debugMode) {
          console.log(`⚡ MCP Sub-Agent consumed ${subAgentEnergy.toFixed(1)} energy`);
        }
      }
      
      // Poll MCP sub-agent for messages
      const subAgentMessages = this.mcpSubAgent.pollMessages();
      for (const msg of subAgentMessages) {
        if (this.debugMode) {
          console.log(`📨 MCP Sub-Agent message: ${msg.type} for request ${msg.requestId}`);
        }
        // Add significant messages as thoughts
        if (msg.type === 'completion' || msg.type === 'error') {
          const thought = msg.type === 'completion' 
            ? `MCP sub-agent completed task: ${JSON.stringify(msg.data)}`
            : `MCP sub-agent error: ${JSON.stringify(msg.data)}`;
          this.reviewThoughtManager.addThought(thought);
        }
      }
      
      // Get all recent conversations, then filter to unanswered ones only
      const allConversations = this.inbox.getRecentConversations(10);
      const unansweredConversations = allConversations.filter(conv => conv.responseMessages.length === 0);
      
      // If a conversation is selected for focused improvement, handle it
      if (this.selectedConversationId) {
        await this.handleSelectedConversation(allConversations.length, unansweredConversations.length);
        return;
      }
      
      // Focus on the oldest unanswered conversation (highest priority)
      const targetConversation = unansweredConversations.length > 0 ? unansweredConversations[0] : null;

      let conversationsToInclude: Array<{ id: string; requestMessage: string; responseMessages: string[]; timestamp: Date }> = [];
      let instruction: string;

      if (targetConversation) {
        // Focus on one unanswered conversation
        conversationsToInclude = [targetConversation];
        instruction = `You have an UNANSWERED conversation above. You MUST use the respond tool to answer it. The conversation ID is: ${targetConversation.id}. Extract this UUID and use it as the requestId parameter in the respond tool.`;
      } else {
        // No unanswered conversations - review recent completed ones for potential improvements
        // Adjust review count based on energy level: more energy = more conversations to review
        const currentEnergyPercent = this.energyRegulator.getEnergyPercentage();
        // Linear interpolation: 0% energy = 1 conversation, 100% energy = 20 conversations
        const reviewCount = Math.max(1, Math.round(1 + (currentEnergyPercent / 100) * 19));

        const recentCompleted = this.inbox.getRecentCompletedConversations(reviewCount);
        conversationsToInclude = recentCompleted.map(conv => ({
          id: conv.requestId,
          requestMessage: `${conv.inputMessage || ''} [Cost: ${conv.metadata.totalEnergyConsumed} units, ${conv.responses.length} responses]`,
          responseMessages: conv.responses.map(r => r.content),
          timestamp: new Date() // Use current time for ordering
        }));
        instruction = conversationsToInclude.length > 0
          ? `Review the recent conversations above. Use the select_conversation tool to choose one for adding to, snooze_conversation for a specified number of minutes, or use await_energy to manage energy.`
          : 'No recent conversations to review. Use await_energy to remain at 100% energy.';
      }

      const messages = [
        this.getSystemMessage(targetConversation),
        ...this.getConversationMessages(conversationsToInclude),
        ...this.getThoughts(false), // Not conversation-focused, so only review thoughts
        this.getEphemeralSystemMessage(conversationsToInclude, allConversations.length, unansweredConversations.length),
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
        allowedTools = ['respond', 'respond_with_approval', 'set_budget', 'adjust_budget', 'await_energy', 'think', 'end_conversation', 'snooze_conversation', 'mcp_add_server', 'mcp_list_servers', 'mcp_call_tool'];
      } else {
        // Reviewing completed conversations for potential improvements
        allowedTools = ['select_conversation', 'set_budget', 'adjust_budget', 'await_energy', 'think', 'end_conversation', 'snooze_conversation', 'mcp_add_server', 'mcp_list_servers', 'mcp_call_tool'];
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

  private getConversationMessages(conversations: Array<{ id: string; requestMessage: string; responseMessages: string[]; timestamp: Date; snoozeInfo?: string }>): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];
    for (const conversation of conversations) {
      messages.push({
        role: 'user',
        content: `Conversation ${conversation.id}: ${conversation.requestMessage}${conversation.snoozeInfo ? ` [${conversation.snoozeInfo}]` : ''}`
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

  private getEphemeralSystemMessage(conversationsToInclude: Array<{ id: string; requestMessage: string; responseMessages: string[]; timestamp: Date }>, totalMessages: number, totalUnansweredCount: number) {
    let message = '(ephemeral)\n';
    const currentEnergy = this.energyRegulator.getEnergy();
    const energyStatus = this.energyRegulator.getStatus();
    const msg = `${this.energyRegulator.getEnergyPercentage()}% (${energyStatus})`;
    message = `${message}\nDate: ${new Date().toISOString()}\nYour energy level is ${msg}.\nThere are ${totalMessages} total messages, and ${totalUnansweredCount} total unanswered conversations.`;
    
    // Add budget information if the focused conversation has a budget
    if (conversationsToInclude.length > 0) {
      const targetConv = conversationsToInclude[0];
      if (targetConv) {
        const conversation = this.inbox.getConversation(targetConv.id);
        
        if (conversation && conversation.metadata.energyBudget !== null && conversation.metadata.energyBudget !== undefined) {
          const budget = conversation.metadata.energyBudget;
          const consumed = conversation.metadata.totalEnergyConsumed;
          const remaining = conversation.metadata.energyBudgetRemaining || 0;
          
          if (budget === 0) {
            message = `${message}\n⚠️ CRITICAL: This conversation has ZERO energy budget. This is your LAST CHANCE to respond. Make it count!`;
          } else if (remaining <= 0) {
            message = `${message}\n⚠️ Budget exceeded: Started with ${budget} units, consumed ${consumed.toFixed(1)} units. Try to wrap up efficiently.`;
          } else if (remaining < budget * 0.2) {
            message = `${message}\n⚡ Budget running low: ${remaining.toFixed(1)} of ${budget} units remaining (${((remaining/budget)*100).toFixed(0)}%)`;
          } else {
            message = `${message}\n💰 Energy budget: ${remaining.toFixed(1)} of ${budget} units remaining`;
          }
        }
      }
      
      message = `${message}\nYou are currently focused on one conversation. Use the respond tool, snooze_conversation, or await_energy.`;
    } else if (totalMessages == 0) {
      message = `${message}\nAim to stay at 100% energy with await_energy.`;
    }
    if (currentEnergy < 50) {
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
        if (this.debugMode) {
          console.log(`🔧 Executing ${modelResponse.toolCalls.length} tool calls`);
        }
        for (const toolCall of modelResponse.toolCalls) {
          await this.executeToolCall(toolCall);
        }
        return;
      }

      // If no tool calls, try to parse as JSON tool call
      const thoughts = modelResponse.content.trim();
      try {
        const toolCall = JSON.parse(thoughts);
        await this.executeToolCall(toolCall);
        return;
      } catch (error) {
        // Not a tool call, treat as thoughts
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
      // Validate response content
      if (!responseContent || typeof responseContent !== 'string') {
        console.error(`❌ Invalid response content for ${requestId}: ${typeof responseContent}`);
        return;
      }

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
      let energyLevel = this.energyRegulator.getEnergy();
      const modelUsed = this.intelligentModel.getCurrentModel();
      
      // Defensive: ensure energy is never NaN before saving to database
      if (isNaN(energyLevel) || energyLevel === null || energyLevel === undefined) {
        console.error(`⚠️ Energy level is invalid (${energyLevel}), using 0 instead`);
        energyLevel = 0;
      }

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

  private async respondWithApproval(requestId: string, responseContent: string, energyBudget?: number) {
    try {
      // Validate response content
      if (!responseContent || typeof responseContent !== 'string') {
        console.error(`❌ Invalid approval response content for ${requestId}: ${typeof responseContent}`);
        return;
      }

      console.log(`✋ Approval request for ${requestId}: ${this.truncateText(responseContent)}`);

      // Get conversation to retrieve user message
      const conversation = this.inbox.getConversation(requestId);
      if (!conversation) {
        console.error(`❌ No conversation found for ${requestId}`);
        const errorThought = `I tried to create an approval request for conversation ${requestId}, but it doesn't exist.`;
        if (this.selectedConversationId) {
          this.conversationThoughtManager.addThought(errorThought);
        } else {
          this.reviewThoughtManager.addThought(errorThought);
        }
        return;
      }

      // Add approval request to inbox
      const userMessage = conversation.inputMessage;
      let energyLevel = this.energyRegulator.getEnergy();
      const modelUsed = this.intelligentModel.getCurrentModel();
      
      // Defensive: ensure energy is never NaN before saving to database
      if (isNaN(energyLevel) || energyLevel === null || energyLevel === undefined) {
        console.error(`⚠️ Energy level is invalid (${energyLevel}), using 0 instead`);
        energyLevel = 0;
      }

      this.inbox.addApprovalRequest(requestId, userMessage, responseContent, energyLevel, modelUsed, energyBudget);

      // Don't remove from pending - approval requests keep conversation in pending state until approved/rejected

    } catch (error: any) {
      console.error(`❌ Error creating approval request for ${requestId}:`, error);
    }
  }

  private async handleSelectedConversation(totalConversations: number, unansweredConversations: number) {
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
      requestMessage: `${conversation.inputMessage || ''} [Cost: ${conversation.metadata.totalEnergyConsumed} units, ${conversation.responses.length} responses]`,
      responseMessages: conversation.responses.map(r => r.content),
      timestamp: new Date()
    }];

    const messages = [
      this.getSystemMessage(null), // No target conversation since we're improving an existing one
      ...this.getConversationMessages(conversationsToInclude),
      ...this.getThoughts(true), // Conversation-focused, so include conversation thoughts
      this.getEphemeralSystemMessage(conversationsToInclude, totalConversations, unansweredConversations), // 0 unanswered since we're reviewing completed
      {
        role: 'user',
        content: `You have selected this conversation. To append a response to the previous responses, use the respond tool, or use await_energy to manage your energy. Use end_conversation if you feel this conversation has been sufficiently addressed, or has become one-sided.`
      }
    ];

    if (this.debugMode) {
      console.log(`${this.getEnergyIndicator()} DEBUG LLM full prompt (selected conversation):`, JSON.stringify(messages, null, 2));
    }

    const modelResponse = await this.intelligentModel.generateResponse(messages, this.energyRegulator, false, ['respond', 'respond_with_approval', 'set_budget', 'adjust_budget', 'await_energy', 'think', 'end_conversation', 'snooze_conversation', 'mcp_add_server', 'mcp_list_servers', 'mcp_call_tool']);

    // Attribute the energy consumed during thinking to the selected conversation
    this.inbox.addEnergyConsumption(this.selectedConversationId, modelResponse.energyConsumed);

    // Clear the selection after handling
    this.selectedConversationId = null;

    await this.executeLLMAutonomousDecision(modelResponse);
  }

  private async selectConversation(requestId: string) {
    console.log(`🎯 Selecting conversation ${requestId}: ${this.inbox.getConversation(requestId)?.inputMessage}`);
    this.selectedConversationId = requestId;

    // Immediately trigger another cognitive action focused on this conversation
    await this.unifiedCognitiveAction();
  }

  private async executeToolCall(toolCall: { id: string; type: string; function: { name: string; arguments: string } }) {
    const { name, arguments: args } = toolCall.function;

    if (this.debugMode) {
      console.log(`🔧 Executing tool: ${name}, raw args: "${args}"`);
    }

    try {
      if (name === 'respond') {
        try {
          const { requestId, content } = JSON.parse(args);
          if (!requestId || !content) {
            console.log(`💬 Respond tool call missing required fields. requestId: ${requestId}, content: ${content}`);
            return;
          }
          await this.respondToRequest(this.extractValidConversationId(requestId), content);
        } catch (parseError) {
          console.log(`💬 Malformed respond tool call with args "${args}", ignoring`);
        }
      } else if (name === 'await_energy') {
        try {
          const parsed = JSON.parse(args);
          const level = parsed.level;
          
          if (level === undefined || level === null || isNaN(level)) {
            console.log(`💤 Invalid energy level in await_energy: ${level}, args: "${args}"`);
            return;
          }
          
          await this.energyRegulator.awaitEnergyLevel(level);
        } catch (parseError) {
          console.log(`💤 Malformed await_energy tool call with args "${args}", ignoring`);
        }
      } else if (name === 'select_conversation') {
        try {
          const { requestId } = JSON.parse(args);
          await this.selectConversation(this.extractValidConversationId(requestId));
        } catch (parseError) {
          console.log(`🎯 Malformed select_conversation tool call with args "${args}", ignoring`);
        }
      } else if (name === 'end_conversation') {
        try {
          const { requestId, reason } = JSON.parse(args);
          // Mark the current conversation as ended in the database
          this.inbox.endConversation(this.extractValidConversationId(requestId), reason);
          // Clear the current conversation selection
          this.selectedConversationId = null;
          // Add a thought about ending the conversation if reason provided
          if (reason && reason.trim()) {
            this.reviewThoughtManager.addThought(`Ended focused conversation work: ${reason}`);
          }
        } catch (parseError) {
          console.log(`🏁 Malformed end_conversation tool call with args "${args}", ignoring`);
        }
      } else if (name === 'snooze_conversation') {
        try {
          const { requestId, minutes } = JSON.parse(args);
          // Snooze the conversation for the specified number of minutes
          const snoozeUntil = this.inbox.snoozeConversation(this.extractValidConversationId(requestId), minutes);
          // Add a thought about snoozing the conversation
          this.reviewThoughtManager.addThought(`Snoozed conversation ${requestId} for ${minutes} minutes until ${snoozeUntil.toISOString()}`);
        } catch (parseError) {
          console.log(`😴 Malformed snooze_conversation tool call with args "${args}", ignoring`);
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
      } else if (name === 'mcp_add_server') {
        try {
          const { serverId, serverName, command, args: serverArgs } = JSON.parse(args);
          await this.handleMcpAddServer(serverId, serverName, command, serverArgs);
        } catch (parseError) {
          console.log(`🔌 Malformed mcp_add_server tool call with args "${args}", ignoring`);
        }
      } else if (name === 'mcp_list_servers') {
        try {
          await this.handleMcpListServers();
        } catch (parseError) {
          console.log(`🔌 Malformed mcp_list_servers tool call with args "${args}", ignoring`);
        }
      } else if (name === 'mcp_call_tool') {
        try {
          const { serverId, toolName, arguments: toolArgs } = JSON.parse(args);
          await this.handleMcpCallTool(serverId, toolName, toolArgs);
        } catch (parseError) {
          console.log(`🔌 Malformed mcp_call_tool tool call with args "${args}", ignoring`);
        }
      } else if (name === 'respond_with_approval') {
        try {
          const { requestId, content, energyBudget } = JSON.parse(args);
          if (!requestId || !content) {
            console.log(`✋ respond_with_approval tool call missing required fields. requestId: ${requestId}, content: ${content}`);
            return;
          }
          await this.respondWithApproval(this.extractValidConversationId(requestId), content, energyBudget);
        } catch (parseError) {
          console.log(`✋ Malformed respond_with_approval tool call with args "${args}", ignoring`);
        }
      } else if (name === 'set_budget') {
        try {
          const { requestId, budget } = JSON.parse(args);
          if (!requestId || budget === undefined || budget === null || budget < 0) {
            console.log(`💰 set_budget tool call invalid. requestId: ${requestId}, budget: ${budget}`);
            return;
          }
          this.inbox.setEnergyBudget(this.extractValidConversationId(requestId), budget);
          console.log(`💰 Set budget for ${requestId} to ${budget} units`);
        } catch (parseError) {
          console.log(`💰 Malformed set_budget tool call with args "${args}", ignoring`);
        }
      } else if (name === 'adjust_budget') {
        try {
          const { requestId, delta } = JSON.parse(args);
          if (!requestId || delta === undefined || delta === null) {
            console.log(`💰 adjust_budget tool call invalid. requestId: ${requestId}, delta: ${delta}`);
            return;
          }
          const extractedId = this.extractValidConversationId(requestId);
          const conversation = this.inbox.getConversation(extractedId);
          if (!conversation) {
            console.log(`💰 Cannot adjust budget: conversation ${extractedId} not found`);
            return;
          }
          const currentBudget = conversation.metadata.energyBudget || 0;
          const newBudget = Math.max(0, currentBudget + delta);
          this.inbox.setEnergyBudget(extractedId, newBudget);
          console.log(`💰 Adjusted budget for ${extractedId} by ${delta} (${currentBudget} → ${newBudget})`);
        } catch (parseError) {
          console.log(`💰 Malformed adjust_budget tool call with args "${args}", ignoring`);
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

  private extractValidConversationId(rawId: string): string {
    if (typeof rawId !== 'string') throw new Error(`Invalid conversation ID format: "${rawId}", ignoring`);

    // Extract UUID pattern from the input
    // This matches standard UUID format (8-4-4-4-12 hex characters)
    const uuidMatch = rawId.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
    if (!uuidMatch) {
      console.warn(`⚠️ Could not extract UUID from: "${rawId}"`);
      throw new Error(`Invalid conversation ID format: "${rawId}", ignoring`);
    }
    
    const extractedId = uuidMatch[0];
    if (this.debugMode) {
      console.log(`📝 Extracted UUID: ${extractedId} from "${rawId}"`);
    }
    return extractedId;
  }

  private async handleMcpAddServer(serverId: string, serverName: string, command: string, args: string[]) {
    console.log(`🔌 Requesting MCP sub-agent to add server: ${serverName} (${serverId})`);
    
    const serverConfig = {
      id: serverId,
      name: serverName,
      command,
      args,
      enabled: true
    };
    
    const requestId = this.mcpSubAgent.queueRequest('add_server', { serverConfig }, 'high');
    
    const thought = `Requested MCP sub-agent to add server "${serverName}" (${serverId}). Request ID: ${requestId}`;
    this.reviewThoughtManager.addThought(thought);
    
    console.log(`📋 MCP server addition queued (request: ${requestId})`);
  }

  private async handleMcpListServers() {
    console.log(`🔌 Listing MCP servers via sub-agent`);
    
    const requestId = this.mcpSubAgent.queueRequest('list_servers', {}, 'medium');
    
    const thought = `Requested list of MCP servers from sub-agent. Request ID: ${requestId}`;
    this.reviewThoughtManager.addThought(thought);
    
    console.log(`📋 MCP server list requested (request: ${requestId})`);
  }

  private async handleMcpCallTool(serverId: string, toolName: string, toolArgs: any) {
    console.log(`🔧 Calling MCP tool: ${toolName} on server ${serverId}`);
    
    try {
      // Get the connection for this server
      const connection = this.mcpClient.getConnection(serverId);
      
      if (!connection) {
        console.error(`❌ No connection found for server: ${serverId}`);
        const thought = `Failed to call MCP tool "${toolName}": Server ${serverId} not connected`;
        this.reviewThoughtManager.addThought(thought);
        return;
      }
      
      // Call the tool
      const result = await connection.client.callTool({
        name: toolName,
        arguments: toolArgs
      });
      
      console.log(`✅ MCP tool result:`, this.truncateText(JSON.stringify(result)));
      
      const thought = `Called MCP tool "${toolName}" on server "${serverId}". Result: ${JSON.stringify(result)}`;
      this.reviewThoughtManager.addThought(thought);
      
    } catch (error: any) {
      console.error(`❌ Error calling MCP tool ${toolName}:`, error?.message || error);
      const thought = `Error calling MCP tool "${toolName}": ${error?.message || error}`;
      this.reviewThoughtManager.addThought(thought);
    }
  }
}
