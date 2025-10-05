export class LLMConfig {
  /**
   * Maps our internal model names to Ollama model names
   * This is used for backward compatibility with the existing energy-based model switching
   */
  static getOllamaModel(model: string): string {
    // Use llama3.2:3b for better tool-calling support (still small)
    return 'llama3.2:3b';
  }

  /**
   * Get the model name for the current provider
   * For OpenRouter, this will use the model specified via --model or default
   */
  static getModelForProvider(provider: string, model: string): string {
    if (provider === 'openrouter') {
      // For OpenRouter, we use the model as-is (e.g., x-ai/grok-4-fast)
      return model;
    } else {
      // For Ollama, use the existing mapping
      return this.getOllamaModel(model);
    }
  }
}
