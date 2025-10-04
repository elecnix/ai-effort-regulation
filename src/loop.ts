import { messageQueue, Message } from './server';
import { EnergyRegulator } from './energy';
import { generateResponse } from './llm';
import { respond, getConversation, getConversationStats, getRecentConversationIds } from './tools';

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
  private currentModel = 'gemma:3b'; // Start with smaller model (matches spec)
  private isRunning = false;
  private modelSwitches = 0;

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
          // Energy-based decision making: think based on energy levels only
          const energy = this.energyRegulator.getEnergy();
          const now = Date.now();

          if (energy > 50) {
            // High energy - continuous thinking but less noisy
            // Only log thinking occasionally to reduce spam
            if (Math.random() < 0.2) { // 20% chance to log thinking
              console.log(`🧠 Thinking at high energy (${energy})`);
            }
            await this.unifiedCognitiveAction();
          } else if (energy > 20) {
            // Medium energy - occasional thinking (random chance)
            if (Math.random() < 0.3) { // 30% chance to think
              console.log(`🧠 Thinking (${energy})`);
              await this.unifiedCognitiveAction();
            } else {
              await this.sleep(1);
            }
          } else if (energy > 0) {
            // Low energy - minimal thinking, mostly sleep
            if (Math.random() < 0.1) { // 10% chance to think
              console.log(`🧠 Brief thought (${energy})`);
              await this.unifiedCognitiveAction();
            } else {
              const sleepTime = 2;
              console.log(`😴 Resting: ${sleepTime}s (${energy})`);
              await this.sleep(sleepTime);
            }
          } else {
            // Critical energy - sleep for recovery
            const sleepTime = 5;
            console.log(`😴 Deep rest: ${sleepTime}s (${energy})`);
            await this.sleep(sleepTime);
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

      console.log(`💬 Processed: "${message.content.substring(0, 30)}..."`);

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
      // Get conversation statistics to understand patterns
      const stats = getConversationStats();
      if (!stats || stats.total_conversations === 0) {
        return;
      }

      // Get a random recent conversation to reflect on
      const recentConversations = this.getRecentConversationIds();
      if (recentConversations.length === 0) {
        return;
      }

      const randomConversationId = recentConversations[Math.floor(Math.random() * Math.min(recentConversations.length, 5))];
      const conversation = getConversation(randomConversationId);

      if (!conversation || conversation.responses.length === 0) {
        return;
      }

      // Analyze the conversation and decide if follow-up is needed
      const shouldFollowUp = this.analyzeConversationForFollowUp(conversation);

      if (shouldFollowUp) {
        // Build conversation history for this specific conversation
        const conversationMessages = this.buildConversationHistory(conversation);

        // Create reflection prompt with current energy context
        const currentEnergy = this.energyRegulator.getEnergy();
        const energyStatus = this.energyRegulator.getStatus();

        const reflectionPrompt = `Current energy level: ${currentEnergy} (${energyStatus})

You are reflecting on the conversation above. The last message was: "${conversation.responses[conversation.responses.length - 1].content}"

Please provide additional insights, follow-up thoughts, or deeper analysis on this topic. Keep your response concise but meaningful.`;

        const messages = [
          ...conversationMessages,
          { role: 'user', content: reflectionPrompt }
        ];

        const reflectionResponse = await generateResponse(messages, this.currentModel, false);

        // Send follow-up response to the same conversation
        await respond(randomConversationId, `FOLLOW-UP REFLECTION: ${reflectionResponse}`, this.energyRegulator.getEnergy(), this.currentModel, this.modelSwitches);

        console.log(`🔍 Reflected on conversation`);
      }

    } catch (error: any) {
      console.error(`❌ Reflection error:`, error.message);
    }
  }

  private async unifiedCognitiveAction() {
    try {
      // Build conversation history (rely on prompt caching for efficiency)
      const conversationHistory = this.buildUnifiedContext();

      // Create the agency prompt with current energy context
      const currentEnergy = this.energyRegulator.getEnergy();
      const energyStatus = this.energyRegulator.getStatus();

      const agencyPrompt = `Current energy level: ${currentEnergy} (${energyStatus})

You are an AI with full cognitive agency. Based on your conversation history above, decide what action to take:

AVAILABLE ACTIONS:
1. GENERATE_THOUGHT: Create an internal thought exploring ideas or connections
2. REFLECT_ON_CONVERSATIONS: Analyze past conversations and provide insights
3. MAKE_TOOL_CALL: Use a tool to perform an action (like checking stats)
4. NO_ACTION: If nothing needs to be done right now

Choose ONE action and provide:
- Action type
- Target (message ID, conversation ID, etc. if applicable)
- Content/Response/Thought

Format your response as:
ACTION: [action_type]
TARGET: [target_id or "none"]
CONTENT: [your response/thought/content]`;

      const messages = [
        ...conversationHistory, // Full conversation history (cached)
        { role: 'user', content: agencyPrompt } // Current energy context
      ];

      const llmResponse = await generateResponse(messages, this.currentModel, false);

      // Parse LLM decision and show concise result
      await this.executeLLMDecision(llmResponse);

    } catch (error) {
      console.error(`❌ Thinking error:`, error.message);
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

  private async executeLLMDecision(llmResponse: string) {
    try {
      // Parse the LLM response
      const actionMatch = llmResponse.match(/ACTION:\s*(.+)/i);
      const targetMatch = llmResponse.match(/TARGET:\s*(.+)/i);
      const contentMatch = llmResponse.match(/CONTENT:\s*([\s\S]+)/i);

      if (!actionMatch) {
        // Default to internal thought - show first 100 chars
        const thought = llmResponse.substring(0, 100) + (llmResponse.length > 100 ? '...' : '');
        console.log(`🤔 Thought: "${thought}"`);
        return;
      }

      const action = actionMatch[1].trim().toUpperCase();
      const target = targetMatch ? targetMatch[1].trim() : null;
      const content = contentMatch ? contentMatch[1].trim() : llmResponse;

      switch (action) {
        case 'GENERATE_THOUGHT':
          // Show first 200 characters of the thought
          const thought = content.substring(0, 200) + (content.length > 200 ? '...' : '');
          console.log(`🤔 Thought: "${thought}"`);
          break;

        case 'REFLECT_ON_CONVERSATIONS':
          if (target && target !== 'none') {
            await respond(target, `FOLLOW-UP REFLECTION: ${content}`, this.energyRegulator.getEnergy(), this.currentModel, this.modelSwitches);
            console.log(`🔍 Reflected on: "${target}"`);
          } else {
            console.log(`🔍 General reflection completed`);
          }
          break;

        case 'MAKE_TOOL_CALL':
          console.log(`🔧 Tool request: "${content.substring(0, 200)}..."`);
          break;

        case 'NO_ACTION':
          // Don't log anything for no action - keep it quiet
          break;

        default:
          const defaultThought = content.substring(0, 100) + (content.length > 100 ? '...' : '');
          console.log(`🤔 Thought: "${defaultThought}"`);
      }

    } catch (error: any) {
      console.error(`❌ Decision error:`, error.message);
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

  private buildConversationHistory(conversation: any): Array<{ role: string; content: string }> {
    // Build message history from a specific conversation
    const messages: Array<{ role: string; content: string }> = [];

    // Add the original user message if available
    if (conversation.inputMessage && conversation.inputMessage !== 'Input message to be populated') {
      messages.push({
        role: 'user',
        content: conversation.inputMessage
      });
    }

    // Add all responses (assistant messages)
    if (conversation.responses) {
      for (const response of conversation.responses) {
        messages.push({
          role: 'assistant',
          content: response.content
        });
      }
    }

    return messages;
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
