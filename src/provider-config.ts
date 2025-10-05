export interface ProviderConfig {
  baseURL: string;
  apiKey: string;
  defaultModel: string;
}

export class ProviderConfiguration {
  private static readonly configs: Record<string, ProviderConfig> = {
    ollama: {
      baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
      apiKey: process.env.OLLAMA_API_KEY || 'ollama',
      defaultModel: 'llama3.2:3b'
    },
    openrouter: {
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      defaultModel: 'x-ai/grok-4-fast'
    }
  };

  /**
   * Get the configuration for the specified provider
   */
  static getProviderConfig(provider?: string): ProviderConfig {
    const selectedProvider = provider || process.env.AI_PROVIDER || 'ollama';

    const config = this.configs[selectedProvider];
    if (!config) {
      throw new Error(`Unknown provider: ${selectedProvider}`);
    }

    return config;
  }

  /**
   * Get the model to use, with fallback to provider default
   */
  static getModel(provider?: string): string {
    const customModel = process.env.AI_MODEL;
    if (customModel) {
      return customModel;
    }

    const config = this.getProviderConfig(provider);
    return config.defaultModel;
  }

  /**
   * Validate that required environment variables are set
   */
  static validateConfig(provider: string): void {
    const config = this.getProviderConfig(provider);

    if (provider === 'openrouter' && !config.apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is required for OpenRouter provider');
    }

    if (provider === 'ollama' && !config.apiKey) {
      console.warn('OLLAMA_API_KEY not set, using default "ollama"');
    }
  }
}
