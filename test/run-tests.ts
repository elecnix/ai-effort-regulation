#!/usr/bin/env node

import { TestRunner } from './framework/TestRunner';
import { TestScenario } from './framework/types';
import { simpleConversationScenario, multipleGreetingsScenario } from './scenarios/simple-conversation';
import { brainstormingScenario, abandonedBrainstormingScenario } from './scenarios/brainstorming';
import { snoozeFeatureScenario, multipleSnoozeScenario } from './scenarios/snooze-feature';
import { priorityBalancingScenario, energyExhaustionScenario } from './scenarios/priority-balancing';
import { TestClient } from './framework/TestClient';
import * as fs from 'fs-extra';
import * as path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const testType = args[0] || 'all';
const configPath = args[1] || './config.json';

// Load configuration
const config = fs.readJsonSync(path.resolve(__dirname, configPath));

// Define test suites
const testSuites: Record<string, TestScenario[]> = {
  simple: [simpleConversationScenario, multipleGreetingsScenario],
  brainstorm: [brainstormingScenario, abandonedBrainstormingScenario],
  snooze: [snoozeFeatureScenario, multipleSnoozeScenario],
  priorities: [priorityBalancingScenario, energyExhaustionScenario],
  all: [
    simpleConversationScenario,
    multipleGreetingsScenario,
    brainstormingScenario,
    abandonedBrainstormingScenario,
    snoozeFeatureScenario,
    multipleSnoozeScenario,
    priorityBalancingScenario,
    energyExhaustionScenario
  ]
};

async function main() {
  console.log('🚀 AI Effort Regulation Test Suite\n');
  console.log(`📋 Test Type: ${testType}`);
  console.log(`⚙️ Config: ${configPath}`);
  console.log(`🌐 Server: ${config.serverUrl}`);
  console.log(`🤖 Models: ${config.models.join(', ')}\n`);

  // Check if server is running
  const client = new TestClient(config.serverUrl);
  const isHealthy = await client.isServerHealthy();
  
  if (!isHealthy) {
    console.error('❌ Server is not running or not healthy!');
    console.error(`   Please start the server first: npm start`);
    process.exit(1);
  }

  console.log('✅ Server is healthy\n');

  // Get scenarios to run
  const scenarios = testSuites[testType];
  
  if (!scenarios) {
    console.error(`❌ Unknown test type: ${testType}`);
    console.error(`   Available types: ${Object.keys(testSuites).join(', ')}`);
    process.exit(1);
  }

  // Create test runner
  const runner = new TestRunner(configPath);

  // Handle dynamic request ID assignment
  const scenariosWithIds = await prepareScenarios(scenarios, client);

  // Run tests
  try {
    await runner.runAll(scenariosWithIds);
    console.log('\n✨ Test suite completed!\n');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

async function prepareScenarios(scenarios: TestScenario[], client: TestClient): Promise<TestScenario[]> {
  // This function would prepare scenarios with actual request IDs
  // For now, we'll return them as-is since the TestRunner handles ID generation
  return scenarios.map(scenario => {
    // Clone the scenario to avoid modifying the original
    const preparedScenario = JSON.parse(JSON.stringify(scenario));
    
    // The TestRunner will handle dynamic ID assignment
    let currentRequestId: string | null = null;
    
    for (const step of preparedScenario.steps) {
      if (step.action === 'send_message') {
        // Mark that we need to capture the request ID
        step.payload.captureId = true;
      } else if (step.action === 'check_response' || 
                 step.action === 'verify_snooze' || 
                 step.action === 'verify_conversation_end') {
        // These steps will use the captured ID
        step.payload.useCapturedId = true;
      }
    }
    
    return preparedScenario;
  });
}

// Run the tests
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
