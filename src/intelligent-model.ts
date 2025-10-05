import OpenAI from 'openai';
import { LLMConfig } from './config';
import { ProviderConfiguration } from './provider-config';
import { EnergyRegulator } from './energy';

export interface ModelResponse {
  content: string;
  energyConsumed: number;
  modelUsed: string;
  toolCalls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export class IntelligentModel {
  private currentModel: string;
  // Start with estimates of energy consumption
  private readonly modelConsumption: Array<{ energyPerPrompt: number; model: string }> = [
    { energyPerPrompt: 1, model: 'qwen3:0.6b' }, // Low energy cost model
    { energyPerPrompt: 2, model: 'qwen3:4b' }, // Medium energy cost model
    { energyPerPrompt: 5, model: 'qwen3:8b' } // High energy cost model
  ];
  private requestStats: Map<string, {energy: number}[]> = new Map();

  constructor() {
    this.currentModel = this.getModelForEnergy(100); // Start with high energy assumption
  }

  /**
   * Get the appropriate OpenAI client for the current provider
   */
  private getClient(): OpenAI {
    const provider = process.env.AI_PROVIDER || 'ollama';
    const config = ProviderConfiguration.getProviderConfig(provider);

    return new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey
    });
  }

  /**
   * Get the provider-specific model name
   */
  private getProviderModelName(model: string): string {
    const provider = process.env.AI_PROVIDER || 'ollama';
    return LLMConfig.getModelForProvider(provider, model);
  }

  /**
   * Generate a response using the appropriate model based on current energy levels
   * Returns both the content and the energy consumed
   */
  async generateResponse(
    messages: Array<{ role: string; content: string }>,
    energyRegulator: EnergyRegulator,
    urgent: boolean = false
  ): Promise<ModelResponse> {
    const provider = process.env.AI_PROVIDER || 'ollama';

    // Select appropriate model based on provider and energy
    let targetModel: string;
    if (provider === 'openrouter') {
      // For OpenRouter, use the specified model directly (bypass energy-based selection)
      targetModel = process.env.AI_MODEL || 'x-ai/grok-4-fast';
    } else {
      // For Ollama, use energy-based model selection
      targetModel = this.getModelForEnergy(energyRegulator.getEnergy());
    }

    // Switch model if needed
    if (this.currentModel !== targetModel) {
      this.currentModel = targetModel;
    }

    // Generate response
    const startTime = performance.now();
    const llmResponse = await this.generateLLMResponse(messages, this.currentModel, urgent);
    const endTime = performance.now();
    const timeElapsedSeconds = (endTime - startTime) / 1000;

    const actualEnergyConsumed = timeElapsedSeconds;
    energyRegulator.consumeEnergy(actualEnergyConsumed);

    this.updateConsumption(this.currentModel, actualEnergyConsumed);

    return {
      content: llmResponse.content,
      energyConsumed: actualEnergyConsumed,
      modelUsed: this.currentModel,
      ...(llmResponse.toolCalls && { toolCalls: llmResponse.toolCalls })
    };
  }

  private updateConsumption(model: string, actualEnergyConsumed: number) {
    const stats = this.requestStats.get(model) || [];
    stats.push({ energy: actualEnergyConsumed });
    if (stats.length > 5) stats.shift();
    this.requestStats.set(model, stats);
    const averageEnergyConsumed = stats.reduce((sum, s) => sum + s.energy, 0) / stats.length;

    // Find existing model config or create new one for unknown models
    let modelConsumption = this.modelConsumption.find((consumption) => consumption.model === model);
    if (!modelConsumption) {
      // Add new model to consumption tracking for any provider
      modelConsumption = { energyPerPrompt: averageEnergyConsumed, model };
      this.modelConsumption.push(modelConsumption);
    } else {
      modelConsumption.energyPerPrompt = averageEnergyConsumed;
    }
  }

  getCurrentModel(): string {
    return this.currentModel;
  }

  /**
   * Get the estimated energy cost for the current model
   */
  getEstimatedEnergyCost(): number {
    const stats = this.requestStats.get(this.currentModel);
    if (stats && stats.length > 0) {
      const averageEnergy = stats.reduce((sum, s) => sum + s.energy, 0) / stats.length;
      return averageEnergy;
    } else {
      return this.getEnergyConsumption(this.currentModel);
    }
  }

  /**
   * Get the appropriate model for a given energy level
   */
  private getModelForEnergy(energy: number): string {
    // Find the most expensive model we can afford (highest energyPerPrompt that energy meets)
    for (let i = this.modelConsumption.length - 1; i >= 0; i--) {
      const threshold = this.modelConsumption[i];
      if (threshold && energy >= threshold.energyPerPrompt) {
        return threshold.model;
      }
    }
    // Fallback to first model if no threshold matches
    const firstThreshold = this.modelConsumption[0];
    return firstThreshold ? firstThreshold.model : 'gemma:3b';
  }

  private getEnergyConsumption(model: string): number {
    // Energy consumption based on energy per prompt for the model
    const config = this.modelConsumption.find(t => t.model === model);
    const defaultConsumption = 10; // Depletion rate of 1 unit per second provides 10 seconds of runtime (10/100)
    return config ? config.energyPerPrompt : defaultConsumption;
  }

  /**
   * Generate response from LLM API
   */
  private async generateLLMResponse(
    messages: Array<{ role: string; content: string }>,
    model: string,
    urgent: boolean
  ): Promise<{ content: string; toolCalls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }> }> {
    const maxRetries = 3;
    const client = this.getClient();

    // Define tools
    const tools = [
      {
        type: 'function' as const,
        function: {
          name: 'respond',
          description: 'Respond to a user message with the given request ID',
          parameters: {
            type: 'object',
            properties: {
              requestId: {
                type: 'string',
                description: 'The ID of the request to respond to'
              },
              content: {
                type: 'string',
                description: 'The response content'
              }
            },
            required: ['requestId', 'content']
          }
        }
      },
      {
        type: 'function' as const,
        function: {
          name: 'await_energy',
          description: 'Wait until energy level reaches the specified percentage',
          parameters: {
            type: 'object',
            properties: {
              level: {
                type: 'number',
                description: 'The energy level percentage to wait for (0-100)'
              }
            },
            required: ['level']
          }
        }
      }
    ];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Map our model names to provider model names
        const modelName = this.getProviderModelName(model);

        // Add urgency instruction if needed
        let systemMessage = "Respond normally.";
        if (urgent) {
          systemMessage = "URGENT: Energy levels critically low. Respond with maximum brevity and pressing urgency. Be direct and to the point. This is an emergency situation.";
        }

        const fullMessages = [
          { role: 'system', content: systemMessage },
          ...messages
        ];

        console.log(`🤖 Attempting LLM call - Model: ${modelName}, Attempt: ${attempt}/${maxRetries}`);

        try {
          const response = await client.chat.completions.create({
            model: modelName,
            messages: fullMessages as any, // OpenAI accepts the same format
            max_tokens: urgent ? 50 : 200,
            temperature: urgent ? 0.5 : 0.7,
            tools: tools,
            tool_choice: 'required'
          });

          console.log(`🤖 LLM API call successful - Model: ${modelName}`);

          const message = response.choices[0]?.message;
          if (!message) {
            throw new Error('No message in LLM response');
          }

          const content = message.content || '';
          const toolCalls = message.tool_calls?.map(tc => ({
            id: tc.id,
            type: tc.type,
            function: {
              name: (tc as any).function.name,
              arguments: (tc as any).function.arguments
            }
          }));

          console.log(`🤖 LLM Response - Content length: ${content.length}, Tool calls: ${toolCalls?.length || 0}`);

          return {
            content,
            ...(toolCalls && { toolCalls })
          };

        } catch (llmError: any) {
          console.error(`❌ LLM API Error on attempt ${attempt}:`, llmError.message);
          throw llmError;
        }

      } catch (error: any) {
        console.error(`LLM generation error (attempt ${attempt}/${maxRetries}):`, error.message);

        // Don't retry on the last attempt
        if (attempt === maxRetries) {
          return {
            content: 'I apologize, but I encountered an error processing your request. Please try again later.'
          };
        }

        // Exponential backoff for retries
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but TypeScript requires it
    return {
      content: 'I apologize, but I encountered an error processing your request.'
    };
  }
}
