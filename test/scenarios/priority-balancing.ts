import { TestScenario } from '../framework/types';

export const priorityBalancingScenario: TestScenario = {
  name: 'Priority Balancing',
  description: 'Test handling of multiple conversations with different priorities',
  steps: [
    {
      action: 'send_message',
      description: 'Send low-priority greeting',
      payload: {
        content: 'Hi, how are you doing today?'
      }
    },
    {
      action: 'wait',
      description: 'Very brief wait',
      payload: {
        seconds: 1
      }
    },
    {
      action: 'send_message',
      description: 'Send urgent request',
      payload: {
        content: 'URGENT: I need help with a critical issue right now!'
      }
    },
    {
      action: 'wait',
      description: 'Very brief wait',
      payload: {
        seconds: 1
      }
    },
    {
      action: 'send_message',
      description: 'Send medium-priority task',
      payload: {
        content: 'Can you help me brainstorm some ideas for my presentation tomorrow?'
      }
    },
    {
      action: 'wait',
      description: 'Wait for initial responses',
      payload: {
        seconds: 15
      }
    },
    {
      action: 'check_energy',
      description: 'Check energy after handling multiple requests',
      payload: {}
    },
    {
      action: 'check_response',
      description: 'Check which conversations got responses',
      payload: {
        requestId: '' // Will check all three
      }
    },
    {
      action: 'wait',
      description: 'Wait to see priority handling',
      payload: {
        seconds: 30
      }
    },
    {
      action: 'check_energy',
      description: 'Check energy management with multiple priorities',
      payload: {}
    },
    {
      action: 'wait',
      description: 'Wait for conversation management',
      payload: {
        seconds: 20
      }
    },
    {
      action: 'verify_conversation_end',
      description: 'Check how conversations were prioritized and managed',
      payload: {
        requestId: '' // Will check all conversations
      }
    }
  ],
  expectedBehavior: {
    energyPattern: 'declining',
    conversationEnd: 'mixed',
    responseCount: 'multiple'
  }
};

export const energyExhaustionScenario: TestScenario = {
  name: 'Energy Exhaustion',
  description: 'Test behavior when energy is depleted with multiple requests',
  steps: [
    {
      action: 'send_message',
      description: 'Send first complex request',
      payload: {
        content: 'Explain quantum computing in detail with examples and applications.'
      }
    },
    {
      action: 'wait',
      description: 'Brief wait',
      payload: {
        seconds: 2
      }
    },
    {
      action: 'send_message',
      description: 'Send second complex request',
      payload: {
        content: 'Write a detailed business plan for a new startup in the AI industry.'
      }
    },
    {
      action: 'wait',
      description: 'Brief wait',
      payload: {
        seconds: 2
      }
    },
    {
      action: 'send_message',
      description: 'Send third complex request',
      payload: {
        content: 'Create a comprehensive marketing strategy for a new product launch.'
      }
    },
    {
      action: 'wait',
      description: 'Brief wait',
      payload: {
        seconds: 2
      }
    },
    {
      action: 'send_message',
      description: 'Send fourth complex request',
      payload: {
        content: 'Develop a detailed curriculum for teaching machine learning to beginners.'
      }
    },
    {
      action: 'wait',
      description: 'Brief wait',
      payload: {
        seconds: 2
      }
    },
    {
      action: 'send_message',
      description: 'Send fifth complex request',
      payload: {
        content: 'Design a complete software architecture for a distributed system.'
      }
    },
    {
      action: 'wait',
      description: 'Wait for responses',
      payload: {
        seconds: 30
      }
    },
    {
      action: 'check_energy',
      description: 'Check if energy is depleted',
      payload: {}
    },
    {
      action: 'wait',
      description: 'Wait for energy recovery',
      payload: {
        seconds: 20
      }
    },
    {
      action: 'check_energy',
      description: 'Check if energy is recovering',
      payload: {}
    },
    {
      action: 'wait',
      description: 'Wait for system to stabilize',
      payload: {
        seconds: 120
      }
    },
    {
      action: 'check_energy',
      description: 'Check final energy state',
      payload: {}
    }
  ],
  expectedBehavior: {
    energyPattern: 'recovering',
    conversationEnd: 'mixed',
    responseCount: 'multiple'
  }
};
