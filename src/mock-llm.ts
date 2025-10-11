import { EnergyRegulator } from './energy';

export interface MockLLMResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface MockLLMConfig {
  responseDelay?: number; // Milliseconds to delay response (default: 0)
  defaultResponse?: string; // Default response text
  responses?: Map<string, string>; // Pattern-based responses
}

export class MockLLMProvider {
  private config: MockLLMConfig;
  private callCount: number = 0;

  constructor(config: MockLLMConfig = {}) {
    this.config = {
      responseDelay: 0,
      defaultResponse: 'This is a mocked LLM response.',
      ...config
    };
  }

  async generateResponse(
    messages: Array<{ role: string; content: string }>,
    energyRegulator: EnergyRegulator,
    includeToolCalls: boolean = false,
    availableTools: any[] = [],
    toolNamespaces: any[] = []
  ): Promise<MockLLMResponse> {
    this.callCount++;

    // Simulate delay if configured
    if (this.config.responseDelay && this.config.responseDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.responseDelay));
    }

    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    const userContent = lastMessage?.content || '';

    // Check for pattern-based responses
    let responseContent = this.config.defaultResponse || 'Mocked response';
    
    if (this.config.responses) {
      for (const [pattern, response] of this.config.responses.entries()) {
        if (userContent.toLowerCase().includes(pattern.toLowerCase())) {
          responseContent = response;
          break;
        }
      }
    }

    // Generate memory-specific responses
    if (userContent.includes('create a concise memory record') || userContent.includes('Create a memory record')) {
      responseContent = 'User discussed preferences and requirements in this conversation.';
    } else if (userContent.includes('decide which ONE to either') || userContent.includes('Analyze these memories')) {
      // Extract memory IDs from the prompt to make a valid decision
      const memoryIdMatch = userContent.match(/Memory (\d+):/);
      const matchedId = memoryIdMatch && memoryIdMatch[1] ? memoryIdMatch[1] : '1';
      const targetId = parseInt(matchedId);
      
      responseContent = JSON.stringify({
        action: 'delete',
        targetMemoryId: targetId,
        reason: 'Mocked compaction decision'
      });
    }

    return {
      content: responseContent,
      model: 'mock-model',
      usage: {
        prompt_tokens: Math.floor(userContent.length / 4),
        completion_tokens: Math.floor(responseContent.length / 4),
        total_tokens: Math.floor((userContent.length + responseContent.length) / 4)
      }
    };
  }

  getCallCount(): number {
    return this.callCount;
  }

  resetCallCount(): void {
    this.callCount = 0;
  }
}

// Helper to create common mock configurations
export const MockLLMPresets = {
  fast: (): MockLLMProvider => new MockLLMProvider({
    responseDelay: 0,
    defaultResponse: 'Fast mocked response'
  }),

  realistic: (): MockLLMProvider => new MockLLMProvider({
    responseDelay: 100, // 100ms to simulate network
    defaultResponse: 'Realistic mocked response with slight delay'
  }),

  memory: (): MockLLMProvider => new MockLLMProvider({
    responseDelay: 50,
    responses: new Map([
      ['create a concise memory', 'User shared important information about their preferences and workflow.'],
      ['decide which ONE', JSON.stringify({ action: 'delete', targetMemoryId: 1, reason: 'Oldest memory' })],
      ['summarize', 'This conversation covered key topics and decisions.']
    ])
  }),

  conversational: (): MockLLMProvider => new MockLLMProvider({
    responseDelay: 50,
    responses: new Map([
      ['hello', 'Hello! How can I help you today?'],
      ['help', 'I can assist you with various tasks. What do you need?'],
      ['thank', 'You\'re welcome! Let me know if you need anything else.'],
      ['bye', 'Goodbye! Have a great day!']
    ])
  })
};
