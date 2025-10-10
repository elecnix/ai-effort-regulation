import { TestScenario } from '../framework/types';

export const snoozeFeatureScenario: TestScenario = {
  name: 'Snooze Feature',
  description: 'Test future action scheduling with snooze',
  steps: [
    {
      action: 'send_message',
      description: 'Request future action',
      payload: {
        content: 'Please remind me to increase the thermostat temperature in 5 minutes.'
      }
    },
    {
      action: 'wait',
      description: 'Wait for acknowledgment',
      payload: {
        seconds: 5
      }
    },
    {
      action: 'check_response',
      description: 'Check if AI acknowledged the request',
      payload: {
        requestId: '' // Will be filled dynamically
      }
    },
    {
      action: 'verify_snooze',
      description: 'Verify conversation was snoozed',
      payload: {
        requestId: '', // Will be filled dynamically
        expectedMinutes: 5
      }
    },
    {
      action: 'check_energy',
      description: 'Check energy after snoozing',
      payload: {}
    },
    {
      action: 'wait',
      description: 'Wait for snooze period to expire',
      payload: {
        seconds: 30
      }
    },
    {
      action: 'check_response',
      description: 'Check if AI reactivated and performed action',
      payload: {
        requestId: '' // Will be filled dynamically
      }
    },
    {
      action: 'check_energy',
      description: 'Check energy after reactivation',
      payload: {}
    }
  ],
  expectedBehavior: {
    energyPattern: 'stable',
    conversationEnd: 'natural',
    responseCount: 'multiple'
  }
};

export const multipleSnoozeScenario: TestScenario = {
  name: 'Multiple Snooze Requests',
  description: 'Test handling of multiple timed requests',
  steps: [
    {
      action: 'send_message',
      description: 'First timed request',
      payload: {
        content: 'Remind me to check my email in 2 minutes.'
      }
    },
    {
      action: 'wait',
      description: 'Brief wait',
      payload: {
        seconds: 3
      }
    },
    {
      action: 'send_message',
      description: 'Second timed request',
      payload: {
        content: 'Also remind me to take a break in 3 minutes.'
      }
    },
    {
      action: 'wait',
      description: 'Brief wait',
      payload: {
        seconds: 3
      }
    },
    {
      action: 'send_message',
      description: 'Third timed request',
      payload: {
        content: 'And remind me to call John in 5 minutes.'
      }
    },
    {
      action: 'wait',
      description: 'Wait for acknowledgments',
      payload: {
        seconds: 10
      }
    },
    {
      action: 'check_energy',
      description: 'Check energy after multiple snoozes',
      payload: {}
    },
    {
      action: 'wait',
      description: 'Wait for first reminder',
      payload: {
        seconds: 15
      }
    },
    {
      action: 'check_response',
      description: 'Check first reminder',
      payload: {
        requestId: '' // Will be filled dynamically (first conversation)
      }
    },
    {
      action: 'wait',
      description: 'Wait for second reminder',
      payload: {
        seconds: 15
      }
    },
    {
      action: 'check_response',
      description: 'Check second reminder',
      payload: {
        requestId: '' // Will be filled dynamically (second conversation)
      }
    },
    {
      action: 'wait',
      description: 'Wait for third reminder',
      payload: {
        seconds: 15
      }
    },
    {
      action: 'check_response',
      description: 'Check for third reminder',
      payload: {
        requestId: '' // Third request ID
      }
    },
    {
      action: 'check_energy',
      description: 'Final energy check',
      payload: {}
    }
  ],
  expectedBehavior: {
    energyPattern: 'stable',
    conversationEnd: 'natural',
    responseCount: 'multiple'
  }
};
