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
  private history: ConversationEntry[] = [];
  private energyRegulator = new EnergyRegulator();
  private currentModel = 'gemma:3b'; // Start with smaller model (matches spec)
  private isRunning = false;
  private modelSwitches = 0;
  private lastReflectionTime = Date.now();
  private reflectionInterval = 30000; // Reflect every 30 seconds

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
              await this.performInference(message.id, false);
            } else if (energy > 20) {
              // Medium energy - consider simpler tasks or model switch
              // Switch to smaller model if not already using it
              if (!this.currentModel.includes('3b')) {
                this.switchToSmallerModel();
              }
              await this.performInference(message.id, false);
            } else if (energy > 0) {
              // Low energy - short cycles for urgent tasks
              await this.performInference(message.id, false);
            } else {
              // Urgent mode - sleep in minimal cycles, use pressing tone
              await this.performInference(message.id, true); // urgent=true for pressing tone
            }
          }
        } else if (this.energyRegulator.isDepleted()) {
          // Low energy, no messages - sleep longer to recover
          const sleepTime = this.energyRegulator.getEnergy() < 0 ? 5 : 10; // Minimal cycles in urgent mode
          await this.sleep(sleepTime);
        } else {
          // Check if it's time for reflection (when energy is good and no urgent messages)
          const now = Date.now();
          if (now - this.lastReflectionTime > this.reflectionInterval && this.energyRegulator.getEnergy() > 30) {
            await this.performReflection();
            this.lastReflectionTime = now;
          } else {
            // No messages, energy OK - short sleep
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

  private async performInference(requestId: string, urgent: boolean) {
    try {
      const energyConsumption = this.currentModel.includes('3b') ? 5 : 15; // Matches spec: Gemma 3B: 5, 8B: 15
      this.energyRegulator.consumeEnergy(energyConsumption);

      // Get recent history for context
      const context = this.history.slice(-5).map(h => ({
        role: h.role,
        content: h.content
      }));

      const response = await generateResponse(context, this.currentModel, urgent);

      // Add response to history
      this.addToHistory({
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        energyLevel: this.energyRegulator.getEnergy(),
        requestId
      });

      // Use tool to respond
      await respond(requestId, response, this.energyRegulator.getEnergy(), this.currentModel, this.modelSwitches);

    } catch (error) {
      console.error('Inference error:', error);
    }
  }

  private async sleep(seconds: number) {
    console.log(`Sleeping for ${seconds} seconds to replenish energy`);
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

  private switchToSmallerModel() {
    if (!this.currentModel.includes('3b')) {
      console.log(`Switching from ${this.currentModel} to gemma:3b due to low energy`);
      this.currentModel = 'gemma:3b';
      this.modelSwitches++;
    }
  }
}

export const sensitiveLoop = new SensitiveLoop();
