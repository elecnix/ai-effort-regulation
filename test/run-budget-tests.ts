import { TestClient } from './framework/TestClient';
import { zeroBudgetScenario } from './scenarios/zero-budget';
import { lowBudgetScenario } from './scenarios/low-budget';
import { highBudgetScenario } from './scenarios/high-budget';
import { noBudgetScenario } from './scenarios/no-budget';
import { budgetExceededScenario } from './scenarios/budget-exceeded';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3005';

async function runBudgetTests() {
  console.log('🧪 Energy Budget Integration Tests\n');
  console.log(`Server: ${SERVER_URL}\n`);
  
  const client = new TestClient(SERVER_URL);
  
  // Check server health
  console.log('Checking server health...');
  const isHealthy = await client.isServerHealthy();
  if (!isHealthy) {
    console.error('❌ Server is not healthy. Please start the server first.');
    process.exit(1);
  }
  console.log('✅ Server is healthy\n');
  
  const scenarios = [
    zeroBudgetScenario,
    lowBudgetScenario,
    highBudgetScenario,
    noBudgetScenario,
    budgetExceededScenario
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const scenario of scenarios) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 ${scenario.name}`);
    console.log(`   ${scenario.description}`);
    console.log('='.repeat(60));
    
    try {
      if (!scenario.run) {
        console.error(`\n❌ ${scenario.name} has no run method`);
        failed++;
        continue;
      }
      
      const result = await scenario.run(client);
      if (result) {
        passed++;
        console.log(`\n✅ ${scenario.name} PASSED`);
      } else {
        failed++;
        console.log(`\n❌ ${scenario.name} FAILED`);
      }
    } catch (error) {
      failed++;
      console.error(`\n❌ ${scenario.name} FAILED with error:`, error);
    }
    
    // Wait between scenarios
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 Test Results');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}/${scenarios.length}`);
  console.log(`❌ Failed: ${failed}/${scenarios.length}`);
  console.log('='.repeat(60));
  
  if (failed > 0) {
    process.exit(1);
  }
}

runBudgetTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
