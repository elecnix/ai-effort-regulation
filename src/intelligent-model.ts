import OpenAI from 'openai';
import { LLMConfig } from './config';
import { EnergyRegulator } from './energy';

const client = new OpenAI({
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
  apiKey: process.env.OLLAMA_API_KEY || 'ollama' // Ollama doesn't require a real API key
});

export interface ModelResponse {
  content: string;
  energyConsumed: number;
  modelUsed: string;
}

export class IntelligentModel {
  private currentModel: string;
  private readonly modelThresholds: Array<{ energyPerPrompt: number; model: string }> = [
    { energyPerPrompt: 5, model: 'qwen3:0.6b' }, // Low energy cost model
    { energyPerPrompt: 10, model: 'qwen3:4b' }, // Medium energy cost model
    { energyPerPrompt: 20, model: 'qwen3:8b' } // High energy cost model
  ];

  constructor() {
    this.currentModel = this.getModelForEnergy(100); // Start with high energy assumption
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
    // Select appropriate model based on energy
    const targetModel = this.getModelForEnergy(energyRegulator.getEnergy());

    // Switch model if needed
    if (this.currentModel !== targetModel) {
      this.currentModel = targetModel;
    }

    // Generate response
    const startTime = performance.now();
    const content = await this.generateLLMResponse(messages, this.currentModel, urgent);
    const endTime = performance.now();
    const timeElapsedSeconds = (endTime - startTime) / 1000;

    // Calculate energy consumption
    const baseEnergyConsumed = this.getEnergyConsumption(this.currentModel);
    const energyConsumed = baseEnergyConsumed - timeElapsedSeconds;

    energyRegulator.consumeEnergy(energyConsumed);

    return {
      content,
      energyConsumed,
      modelUsed: this.currentModel
    };
  }

  /**
   * Get the estimated energy cost for the current model
   */
  getEstimatedEnergyCost(): number {
    return this.getEnergyConsumption(this.currentModel);
  }

  /**
   * Get the appropriate model for a given energy level
   */
  private getModelForEnergy(energy: number): string {
    // Find the most expensive model we can afford (highest energyPerPrompt that energy meets)
    for (let i = this.modelThresholds.length - 1; i >= 0; i--) {
      const threshold = this.modelThresholds[i];
      if (threshold && energy >= threshold.energyPerPrompt) {
        return threshold.model;
      }
    }
    // Fallback to first model if no threshold matches
    const firstThreshold = this.modelThresholds[0];
    return firstThreshold ? firstThreshold.model : 'gemma:3b';
  }

  private getEnergyConsumption(model: string): number {
    // Energy consumption based on energy per prompt for the model
    const threshold = this.modelThresholds.find(t => t.model === model);
    return threshold ? threshold.energyPerPrompt : 0;
  }

  /**
   * Generate response from LLM API
   */
  private async generateLLMResponse(
    messages: Array<{ role: string; content: string }>,
    model: string,
    urgent: boolean
  ): Promise<string> {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Map our model names to Ollama model names
        const modelName = LLMConfig.getOllamaModel(model);

        // Add urgency instruction if needed
        let systemMessage = "Respond normally.";
        if (urgent) {
          systemMessage = "URGENT: Energy levels critically low. Respond with maximum brevity and pressing urgency. Be direct and to the point. This is an emergency situation.";
        }

        const fullMessages = [
          { role: 'system', content: systemMessage },
          ...messages
        ];

        const response = await client.chat.completions.create({
          model: modelName,
          messages: fullMessages as any, // Ollama accepts the same format
          max_tokens: urgent ? 50 : 200,
          temperature: urgent ? 0.5 : 0.7
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No content in LLM response');
        }

        return content;

      } catch (error: any) {
        console.error(`LLM generation error (attempt ${attempt}/${maxRetries}):`, error.message);

        // Don't retry on the last attempt
        if (attempt === maxRetries) {
          return 'I apologize, but I encountered an error processing your request. Please try again later.';
        }

        // Exponential backoff for retries
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but TypeScript requires it
    return 'I apologize, but I encountered an error processing your request.';
  }
}
