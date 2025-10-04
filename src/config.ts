export class LLMConfig {
  /**
   * Maps our model names to Ollama model names based on energy levels
   */
  static getOllamaModel(model: string): string {
    return model.includes('3b') ? 'gemma:2b' : 'gemma:7b';
  }
}
