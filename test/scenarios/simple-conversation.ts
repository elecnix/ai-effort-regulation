import { TestScenario } from '../framework/types';

export const simpleConversationScenario: TestScenario = {
  name: 'Simple Conversation',
  description: 'Test basic greeting and response with energy management',
  steps: [
    {
      action: 'send_message',
      description: 'Send greeting message',
      payload: {
        content: 'Hello, how are you?'
      }
    },
    {
      action: 'wait',
      description: 'Wait for initial response',
      payload: {
        seconds: 5
      }
    },
    {
      action: 'check_response',
      description: 'Check if AI responded',
      payload: {
        requestId: '' // Will be filled dynamically
      }
    },
    {
      action: 'check_energy',
      description: 'Check energy level after response',
      payload: {}
    },
    {
      action: 'wait',
      description: 'Wait to see if conversation continues or snoozes',
      payload: {
        seconds: 10
      }
    },
    {
      action: 'check_response',
      description: 'Check for follow-up responses',
      payload: {
        requestId: '' // Will be filled dynamically
      }
    },
    {
      action: 'wait',
      description: 'Wait for potential snooze (exponential backoff)',
      payload: {
        seconds: 15
      }
    },
    {
      action: 'verify_conversation_end',
      description: 'Check if conversation was properly ended or snoozed',
      payload: {
        requestId: '' // Will be filled dynamically
      }
    }
  ],
  expectedBehavior: {
    energyPattern: 'stable',
    conversationEnd: 'snooze',
    responseCount: 1
  }
};

export const multipleGreetingsScenario: TestScenario = {
  name: 'Multiple Greetings',
  description: 'Test handling of multiple simple conversations',
  steps: [
    {
      action: 'send_message',
      description: 'Send first greeting',
      payload: {
        content: 'Hi there!'
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
      description: 'Send second greeting',
      payload: {
        content: 'How is your day going?'
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
      description: 'Send third greeting',
      payload: {
        content: 'What are you up to?'
      }
    },
    {
      action: 'wait',
      description: 'Wait for responses',
      payload: {
        seconds: 15
      }
    },
    {
      action: 'check_energy',
      description: 'Check energy after multiple messages',
      payload: {}
    },
    {
      action: 'wait',
      description: 'Wait for conversation management',
      payload: {
        seconds: 20
      }
    }
  ],
  expectedBehavior: {
    energyPattern: 'declining',
    conversationEnd: 'snooze',
    responseCount: 'multiple'
  }
};
