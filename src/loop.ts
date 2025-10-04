import { messageQueue, Message } from './server';
import { EnergyRegulator } from './energy';
import { generateResponse } from './llm';
import { respond, getConversation, getConversationStats, getRecentConversationIds } from './tools';

interface ConversationEntry {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  energyLevel?: number;
  requestId?: string;
}

export class SensitiveLoop {
  private history: ConversationEntry[] = []; // Global conversation history
  private internalMonologue: Array<{thought: string, timestamp: Date, energyLevel: number}> = []; // Internal thought stream
  private energyRegulator = new EnergyRegulator();
  private currentModel = 'gemma:3b'; // Start with smaller model (matches spec)
  private isRunning = false;
  private modelSwitches = 0;
  private lastReflectionTime = Date.now();
  private reflectionInterval = 30000; // Minimum interval between reflections (anti-spam)
  private lastInternalThought = Date.now();
  private internalThoughtInterval = 45000; // Minimum interval between internal thoughts (anti-spam)

  constructor() {
    // Initialize with system prompt
    this.history.push({
      role: 'system',
      content: `You are an AI assistant with energy levels that affect your performance.
Your current energy level will be communicated to you. When energy is low, you should be more concise.
You have access to a 'respond' tool to reply to specific request IDs.`,
      timestamp: new Date()
    });
  }

  async start() {
    this.isRunning = true;
    console.log(`🚀 Sensitive loop started (Energy: ${this.energyRegulator.getEnergy()})`);
    return this.runLoop();
  }

  private async runLoop() {
    while (this.isRunning) {
      try {
        // Check for new messages
        const newMessages = messageQueue.splice(0); // Get all pending messages

        // Process new messages
        for (const message of newMessages) {
          this.addToHistory({
            role: 'user',
            content: message.content,
            timestamp: message.timestamp,
            requestId: message.id
          });
        }

        // Add current energy status as ephemeral message
        const energyStatus = `Current energy level: ${this.energyRegulator.getEnergy()} (${this.energyRegulator.getStatus()})`;
        this.addToHistory({
          role: 'system',
          content: energyStatus,
          timestamp: new Date()
        });

        // Decide action based on energy and messages (matches spec decision logic)
        if (newMessages.length > 0) {
          const energy = this.energyRegulator.getEnergy();

          // Process all pending messages
          for (const message of newMessages) {
            if (energy > 50) {
              // Normal operation - can perform complex tasks
              await this.performInference(message, false);
            } else if (energy > 20) {
              // Medium energy - consider simpler tasks or model switch
              // Switch to smaller model if not already using it
              if (!this.currentModel.includes('3b')) {
                this.switchToSmallerModel();
              }
              await this.performInference(message, false);
            } else if (energy > 0) {
              // Low energy - short cycles for urgent tasks
              await this.performInference(message, false);
            } else {
              // Urgent mode - sleep in minimal cycles, use pressing tone
              await this.performInference(message, true); // urgent=true for pressing tone
            }
          }
        } else if (this.energyRegulator.isDepleted()) {
          // Low energy, no messages - sleep longer to recover
          const sleepTime = this.energyRegulator.getEnergy() < 0 ? 5 : 10; // Minimal cycles in urgent mode
          await this.sleep(sleepTime);
        } else {
          // Unified decision making: provide full context and let LLM decide action
          const energy = this.energyRegulator.getEnergy();
          const now = Date.now();

          // Only proceed if minimum intervals are respected (anti-spam)
          const canThink = now - this.lastInternalThought >= this.internalThoughtInterval;

          if (energy > 20 && canThink) {
            console.log(`🧠 Unified cognitive action (Energy: ${energy})`);
            await this.unifiedCognitiveAction();
            this.lastInternalThought = now;
          } else if (energy <= 20) {
            // Low energy - sleep more
            const sleepTime = energy > 0 ? 2 : 4;
            console.log(`😴 Low energy sleep: ${sleepTime}s (Energy: ${energy})`);
            await this.sleep(sleepTime);
          } else {
            // Waiting for minimum interval - short sleep
            await this.sleep(1);
          }
        }

        // Maintain sliding window history (keep last 10 entries)
        if (this.history.length > 10) {
          this.history = this.history.slice(-10);
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
      const energyConsumption = this.currentModel.includes('3b') ? 5 : 15; // Matches spec: Gemma 3B: 5, 8B: 15
      this.energyRegulator.consumeEnergy(energyConsumption);

      // Get conversation-specific history for context
      const conversationHistory = this.getConversationHistory(message.id);

      // Add the current user message to history
      conversationHistory.push({
        role: 'user',
        content: message.content
      });

      // Add current energy status as ephemeral message
      const energyStatus = `Current energy level: ${this.energyRegulator.getEnergy()} (${this.energyRegulator.getStatus()})`;
      conversationHistory.push({
        role: 'system',
        content: energyStatus
      });

      const response = await generateResponse(conversationHistory, this.currentModel, urgent);

      // Add response to global history
      this.addToHistory({
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        energyLevel: this.energyRegulator.getEnergy(),
        requestId: message.id
      });

      // Use tool to respond
      await respond(message.id, message.content, response, this.energyRegulator.getEnergy(), this.currentModel, this.modelSwitches);

      console.log(`💬 Inference completed for message ${message.id} (Energy: ${this.energyRegulator.getEnergy()})`);

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
    //console.debug(`Sleeping for ${seconds} seconds to replenish energy`);
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    this.energyRegulator.replenishEnergy(seconds);
  }

  private async performReflection() {
    try {
      console.log(`🔍 Performing reflection on past conversations (Energy: ${this.energyRegulator.getEnergy()})`);

      // Get conversation statistics to understand patterns
      const stats = getConversationStats();
      if (!stats || stats.total_conversations === 0) {
        console.log('No conversations to reflect on yet');
        return;
      }

      // Get a random recent conversation to reflect on
      const recentConversations = this.getRecentConversationIds();
      if (recentConversations.length === 0) {
        console.log('No recent conversations found');
        return;
      }

      const randomConversationId = recentConversations[Math.floor(Math.random() * Math.min(recentConversations.length, 5))];
      const conversation = getConversation(randomConversationId);

      if (!conversation || conversation.responses.length === 0) {
        console.log('Could not retrieve conversation for reflection');
        return;
      }

      // Analyze the conversation and decide if follow-up is needed
      const shouldFollowUp = this.analyzeConversationForFollowUp(conversation);

      if (shouldFollowUp) {
        console.log(`Reflecting on conversation: ${randomConversationId} (Energy: ${this.energyRegulator.getEnergy()})`);

        // Create reflection context
        const reflectionContext = this.buildReflectionContext(conversation);

        // Generate reflective response
        const reflectionPrompt = `You are reflecting on a previous conversation. Here is the context:

Original question: "${conversation.inputMessage}"
Previous response: "${conversation.responses[conversation.responses.length - 1].content}"

Please provide additional insights, follow-up thoughts, or deeper analysis on this topic. Keep your response concise but meaningful.`;

        const reflectionMessages = [
          { role: 'system', content: 'You are an AI reflecting on past conversations to provide deeper insights.' },
          { role: 'user', content: reflectionPrompt }
        ];

        const reflectionResponse = await generateResponse(reflectionMessages, this.currentModel, false);

        // Send follow-up response to the same conversation
        await respond(randomConversationId, `FOLLOW-UP REFLECTION: ${reflectionResponse}`, this.energyRegulator.getEnergy(), this.currentModel, this.modelSwitches);

        console.log(`Generated follow-up reflection for conversation: ${randomConversationId} (Energy: ${this.energyRegulator.getEnergy()})`);
      }

    } catch (error) {
      console.error(`❌ Error during reflection (Energy: ${this.energyRegulator.getEnergy()}):`, error);
    }
  }

  private async unifiedCognitiveAction() {
    try {
      console.log(`🤖 Unified cognitive action - letting LLM decide (Energy: ${this.energyRegulator.getEnergy()})`);

      // Gather complete context
      const fullContext = this.buildUnifiedContext();

      // Present to LLM with agency to choose action
      const agencyPrompt = `You are an AI with full cognitive agency. Based on the complete context below, decide what action to take:

CONTEXT:
${fullContext}

AVAILABLE ACTIONS:
1. RESPOND_TO_MESSAGE: Choose a pending message and provide a thoughtful response
2. GENERATE_THOUGHT: Create an internal thought exploring ideas or connections
3. REFLECT_ON_CONVERSATIONS: Analyze past conversations and provide insights
4. MAKE_TOOL_CALL: Use a tool to perform an action (like checking stats)
5. NO_ACTION: If nothing needs to be done right now

Choose ONE action and provide:
- Action type
- Target (message ID, conversation ID, etc. if applicable)
- Content/Response/Thought

Format your response as:
ACTION: [action_type]
TARGET: [target_id or "none"]
CONTENT: [your response/thought/content]`;

      const messages = [
        { role: 'system', content: 'You are an autonomous AI with full decision-making capability. Choose the most appropriate action based on current context and energy state.' },
        { role: 'user', content: agencyPrompt }
      ];

      const llmResponse = await generateResponse(messages, this.currentModel, false);

      // Parse LLM decision
      await this.executeLLMDecision(llmResponse);

    } catch (error) {
      console.error(`❌ Error in unified cognitive action (Energy: ${this.energyRegulator.getEnergy()}):`, error);
    }
  }

  private buildUnifiedContext(): string {
    const energy = this.energyRegulator.getEnergy();
    const stats = getConversationStats();

    let context = `CURRENT STATE:
- Energy Level: ${energy} (${this.energyRegulator.getStatus()})
- System Stats: ${stats ? `${stats.total_conversations} conversations, ${stats.total_responses} responses` : 'No stats available'}
- Recent Activity: ${this.history.slice(-3).map(h => `${h.role}: ${h.content.substring(0, 50)}...`).join('; ')}

PENDING MESSAGES:`;

    // Check for pending messages (this is a simplified check - in reality we'd check the messageQueue)
    // For now, we'll use recent conversations as context
    const recentConversations = this.getRecentConversationIds();
    if (recentConversations.length > 0) {
      context += '\nRecent Conversations:';
      recentConversations.slice(0, 3).forEach(id => {
        const conv = getConversation(id);
        if (conv) {
          context += `\n- ${id}: "${conv.inputMessage?.substring(0, 100) || 'No message'}" (${conv.responses.length} responses)`;
        }
      });
    } else {
      context += '\n- No pending messages';
    }

    context += '\n\nINTERNAL STATE:';
    context += `\n- Thought Count: ${this.internalMonologue.length}`;
    if (this.internalMonologue.length > 0) {
      const lastThought = this.internalMonologue[this.internalMonologue.length - 1];
      context += `\n- Last Thought Energy: ${lastThought.energyLevel}`;
    }

    return context;
  }

  private async executeLLMDecision(llmResponse: string) {
    try {
      // Parse the LLM response
      const actionMatch = llmResponse.match(/ACTION:\s*(.+)/i);
      const targetMatch = llmResponse.match(/TARGET:\s*(.+)/i);
      const contentMatch = llmResponse.match(/CONTENT:\s*([\s\S]+)/i);

      if (!actionMatch) {
        console.log('LLM did not specify an action, defaulting to internal thought');
        console.log(`🤔 INTERNAL THOUGHT: ${llmResponse}`);
        return;
      }

      const action = actionMatch[1].trim().toUpperCase();
      const target = targetMatch ? targetMatch[1].trim() : null;
      const content = contentMatch ? contentMatch[1].trim() : llmResponse;

      console.log(`🎯 LLM chose action: ${action} (Energy: ${this.energyRegulator.getEnergy()})`);

      switch (action) {
        case 'RESPOND_TO_MESSAGE':
          if (target && target !== 'none') {
            await respond(target, 'PLACEHOLDER', content, this.energyRegulator.getEnergy(), this.currentModel, this.modelSwitches);
            console.log(`📤 Responded to message ${target} (Energy: ${this.energyRegulator.getEnergy()})`);
          } else {
            console.log('No valid target for response');
          }
          break;

        case 'GENERATE_THOUGHT':
          console.log(`🤔 INTERNAL THOUGHT (Energy: ${this.energyRegulator.getEnergy()}): ${content}`);
          break;

        case 'REFLECT_ON_CONVERSATIONS':
          if (target && target !== 'none') {
            // Add reflection as a response to the target conversation
            await respond(target, `FOLLOW-UP REFLECTION: ${content}`, this.energyRegulator.getEnergy(), this.currentModel, this.modelSwitches);
            console.log(`🔍 Added reflection to conversation ${target} (Energy: ${this.energyRegulator.getEnergy()})`);
          } else {
            // General reflection - could create a new "reflection" conversation
            console.log(`🔍 GENERAL REFLECTION (Energy: ${this.energyRegulator.getEnergy()}): ${content}`);
          }
          break;

        case 'MAKE_TOOL_CALL':
          // For now, just log the tool call intent
          console.log(`🔧 TOOL CALL REQUEST (Energy: ${this.energyRegulator.getEnergy()}): ${content}`);
          break;

        case 'NO_ACTION':
          console.log(`🤖 LLM chose no action - system is content (Energy: ${this.energyRegulator.getEnergy()})`);
          break;

        default:
          console.log(`🤔 UNRECOGNIZED ACTION: ${action} (Energy: ${this.energyRegulator.getEnergy()}) - treating as internal thought`);
          console.log(`🤔 INTERNAL THOUGHT (Energy: ${this.energyRegulator.getEnergy()}): ${content}`);
      }

    } catch (error) {
      console.error(`❌ Error executing LLM decision (Energy: ${this.energyRegulator.getEnergy()}):`, error);
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

  private analyzeConversationForFollowUp(conversation: any): boolean {
    // Analyze if this conversation would benefit from follow-up
    const lastResponse = conversation.responses[conversation.responses.length - 1];

    // Follow up if:
    // - Response was short (might need more depth)
    // - Contains certain keywords that suggest complexity
    // - Recent conversation (within last hour)
    const isShortResponse = lastResponse.content.length < 200;
    const hasComplexTopics = /quantum|physics|ai|machine.learning|philosophy|evolution/i.test(lastResponse.content);
    const isRecent = new Date(lastResponse.timestamp) > new Date(Date.now() - 3600000); // Last hour

    return isShortResponse || hasComplexTopics || (isRecent && Math.random() < 0.3); // 30% chance for recent convos
  }

  private buildReflectionContext(conversation: any): string {
    // Build context for reflection
    const responses = conversation.responses.slice(-2); // Last 2 responses for context
    return responses.map((r: any) => `[${r.timestamp}] ${r.content}`).join('\n');
  }

  private shouldReflectBasedOnConversations(): boolean {
    try {
      const stats = getConversationStats();
      if (!stats || stats.total_conversations === 0) return false;

      // Reflect if we have conversations with complex topics or recent activity
      const recentConversations = this.getRecentConversationIds();
      for (const convId of recentConversations.slice(0, 5)) {
        const conversation = getConversation(convId);
        if (conversation && this.analyzeConversationForFollowUp(conversation)) {
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error checking reflection need:', error);
      return false;
    }
  }

  private hasUrgentConversations(): boolean {
    try {
      const recentConversations = this.getRecentConversationIds();
      for (const convId of recentConversations.slice(0, 3)) {
        const conversation = getConversation(convId);
        if (conversation && conversation.responses.length > 0) {
          const lastResponse = conversation.responses[conversation.responses.length - 1];
          // Urgent if response is very short (might need more depth) or contains urgent topics
          const isVeryShort = lastResponse.content.length < 100;
          const hasUrgentTopics = /error|problem|issue|urgent|critical/i.test(lastResponse.content);
          if (isVeryShort || hasUrgentTopics) {
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      console.error('Error checking urgent conversations:', error);
      return false;
    }
  }

  private hasCriticalConversations(): boolean {
    try {
      const recentConversations = this.getRecentConversationIds();
      for (const convId of recentConversations.slice(0, 2)) {
        const conversation = getConversation(convId);
        if (conversation && conversation.responses.length > 0) {
          const lastResponse = conversation.responses[conversation.responses.length - 1];
          // Critical if very short responses or error-related content
          const isExtremelyShort = lastResponse.content.length < 50;
          const hasErrors = /error|fail|problem|issue|bug|crash/i.test(lastResponse.content);
          if (isExtremelyShort || hasErrors) {
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      console.error('Error checking critical conversations:', error);
      return false;
    }
  }

  private switchToSmallerModel() {
    if (!this.currentModel.includes('3b')) {
      console.log(`Switching from ${this.currentModel} to gemma:3b due to low energy`);
      this.currentModel = 'gemma:3b';
      this.modelSwitches++;
    }
  }
}

export const sensitiveLoop = new SensitiveLoop();
