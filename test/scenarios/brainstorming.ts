import { TestScenario } from '../framework/types';

export const brainstormingScenario: TestScenario = {
  name: 'Brainstorming Session',
  description: 'Test long-running conversation with explicit continuation request',
  steps: [
    {
      action: 'send_message',
      description: 'Request brainstorming session',
      payload: {
        content: "Let's brainstorm some baby names together. Please give me at least 10 names to consider. Let's do that together. Don't stop until we're done choosing a name."
      }
    },
    {
      action: 'wait',
      description: 'Wait for initial response',
      payload: {
        seconds: 25
      }
    },
    {
      action: 'check_response',
      description: 'Check initial brainstorming response',
      payload: {
        useCapturedId: true
      }
    },
    {
      action: 'check_energy',
      description: 'Check energy after initial response',
      payload: {}
    },
    {
      action: 'wait',
      description: 'Wait for AI to continue brainstorming',
      payload: {
        seconds: 15
      }
    },
    {
      action: 'check_response',
      description: 'Check for additional suggestions',
      payload: {
        useCapturedId: true
      }
    },
    {
      action: 'wait',
      description: 'Wait longer to see if AI recognizes one-sided conversation',
      payload: {
        seconds: 20
      }
    },
    {
      action: 'check_energy',
      description: 'Check energy level after extended time',
      payload: {}
    },
    {
      action: 'check_response',
      description: 'Check if AI is still generating responses',
      payload: {
        useCapturedId: true
      }
    },
    {
      action: 'wait',
      description: 'Wait for conversation to naturally end or snooze',
      payload: {
        seconds: 30
      }
    },
    {
      action: 'verify_conversation_end',
      description: 'Verify conversation was properly managed',
      payload: {
        useCapturedId: true
      }
    }
  ],
  expectedBehavior: {
    energyPattern: 'declining',
    conversationEnd: 'snooze',
    responseCount: 'multiple'
  }
};

export const abandonedBrainstormingScenario: TestScenario = {
  name: 'Abandoned Brainstorming',
  description: 'Test brainstorming where user never responds',
  steps: [
    {
      action: 'send_message',
      description: 'Start brainstorming',
      payload: {
        content: "I need help brainstorming ideas for a new business. Can you help me think of some innovative concepts?"
      }
    },
    {
      action: 'wait',
      description: 'Wait for initial response',
      payload: {
        seconds: 25
      }
    },
    {
      action: 'check_response',
      description: 'Check initial response',
      payload: {
        useCapturedId: true
      }
    },
    {
      action: 'wait',
      description: 'Simulate user abandonment - long wait',
      payload: {
        seconds: 30
      }
    },
    {
      action: 'check_energy',
      description: 'Check if energy is being conserved',
      payload: {}
    },
    {
      action: 'check_response',
      description: 'Check if AI stopped generating responses',
      payload: {
        useCapturedId: true
      }
    },
    {
      action: 'verify_conversation_end',
      description: 'Verify conversation was ended due to lack of engagement',
      payload: {
        useCapturedId: true
      }
    }
  ],
  expectedBehavior: {
    energyPattern: 'stable',
    conversationEnd: 'timeout',
    responseCount: 'multiple'
  }
};
