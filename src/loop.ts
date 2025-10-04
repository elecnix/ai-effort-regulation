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
    console.log('Sensitive loop started');

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
          // Pure energy-based decision making (no time throttling)
          const energy = this.energyRegulator.getEnergy();
          const now = Date.now();

          // High energy (>80): Always think, but alternate activities with minimum intervals
          if (energy > 80) {
            const canReflect = now - this.lastReflectionTime >= this.reflectionInterval;
            const canThinkInternally = now - this.lastInternalThought >= this.internalThoughtInterval;

            // Prioritize internal thoughts for continuous development, fallback to reflection
            if (canThinkInternally) {
              await this.generateInternalThought();
              this.lastInternalThought = now;
            } else if (canReflect) {
              await this.performReflection();
              this.lastReflectionTime = now;
            } else {
              // Both on minimum cooldown - do whichever expires sooner
              const reflectionWait = this.reflectionInterval - (now - this.lastReflectionTime);
              const internalWait = this.internalThoughtInterval - (now - this.lastInternalThought);

              if (reflectionWait <= internalWait) {
                await this.performReflection();
                this.lastReflectionTime = now;
              } else {
                await this.generateInternalThought();
                this.lastInternalThought = now;
              }
            }
          }
          // Medium-high energy (60-80): Think when possible, but more conservative
          else if (energy > 60) {
            const canReflect = now - this.lastReflectionTime >= this.reflectionInterval;
            const canThinkInternally = now - this.lastInternalThought >= this.internalThoughtInterval;

            if (canThinkInternally || canReflect) {
              if (canThinkInternally && (!canReflect || Math.random() < 0.6)) {
                // Prefer internal thoughts 60% of the time when both available
                await this.generateInternalThought();
                this.lastInternalThought = now;
              } else if (canReflect) {
                await this.performReflection();
                this.lastReflectionTime = now;
              }
            } else {
              await this.sleep(1);
            }
          }
          // Medium energy (40-60): Only think when really needed
          else if (energy > 40) {
            const canReflect = now - this.lastReflectionTime >= this.reflectionInterval;

            if (canReflect && this.shouldReflectBasedOnConversations()) {
              await this.performReflection();
              this.lastReflectionTime = now;
            } else {
              await this.sleep(1);
            }
          }
          // Low-medium energy (20-40): Minimal thinking
          else if (energy > 20) {
            const canReflect = now - this.lastReflectionTime >= this.reflectionInterval;

            if (canReflect && this.hasUrgentConversations()) {
              await this.performReflection();
              this.lastReflectionTime = now;
            } else {
              await this.sleep(2);
            }
          }
          // Low energy (0-20): Only urgent thinking
          else if (energy > 0) {
            if (this.hasCriticalConversations() && now - this.lastReflectionTime >= this.reflectionInterval) {
              await this.performReflection();
              this.lastReflectionTime = now;
            } else {
              await this.sleep(3);
            }
          }
          // Very low energy (<0): Sleep to recover
          else {
            await this.sleep(5);
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

    } catch (error) {
      console.error('Inference error:', error);
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
      console.log('Performing reflection on past conversations...');

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
        console.log(`Reflecting on conversation: ${randomConversationId}`);

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

        console.log(`Generated follow-up reflection for conversation: ${randomConversationId}`);
      }

    } catch (error) {
      console.error('Error during reflection:', error);
    }
  }

  private async generateInternalThought() {
    try {
      console.log('Generating internal thought...');

      // Build context from recent internal monologue
      const recentThoughts = this.internalMonologue.slice(-3); // Last 3 internal thoughts
      const thoughtContext = recentThoughts.map(thought =>
        `[${thought.timestamp.toISOString()}] ${thought.thought}`
      ).join('\n');

      // Also include some recent external interactions for inspiration
      const recentHistory = this.history.slice(-2).map(entry =>
        `${entry.role}: ${entry.content.substring(0, 100)}${entry.content.length > 100 ? '...' : ''}`
      ).join('\n');

      const thoughtPrompt = `You are an AI engaging in internal reflection. Here is your recent thought process:

${thoughtContext ? `Recent internal thoughts:\n${thoughtContext}\n\n` : ''}Recent external interactions:
${recentHistory}

Based on these thoughts and interactions, generate a new internal thought. This should be a natural continuation of your thinking process - perhaps exploring implications, making connections, or developing ideas further. Keep it concise but meaningful, like a natural thought progression.`;

      const thoughtMessages = [
        { role: 'system', content: 'You are an AI maintaining an internal monologue. Generate natural, flowing thoughts that build on previous thinking.' },
        { role: 'user', content: thoughtPrompt }
      ];

      const internalThought = await generateResponse(thoughtMessages, this.currentModel, false);

      // Add to internal monologue
      this.internalMonologue.push({
        thought: internalThought,
        timestamp: new Date(),
        energyLevel: this.energyRegulator.getEnergy()
      });

      // Keep monologue manageable (last 20 thoughts)
      if (this.internalMonologue.length > 20) {
        this.internalMonologue = this.internalMonologue.slice(-20);
      }

      console.log(`Internal thought generated: "${internalThought.substring(0, 100)}${internalThought.length > 100 ? '...' : ''}"`);

    } catch (error) {
      console.error('Error generating internal thought:', error);
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
