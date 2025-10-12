/**
 * Test to verify single model configuration
 */

import { LLMConfig } from '../src/config';
import { IntelligentModel } from '../src/intelligent-model';
import * as assert from 'assert';

console.log('🧪 Single Model Configuration Test');
console.log('='.repeat(50));

let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.error(`   Error: ${error}`);
    testsFailed++;
  }
}

async function runTests() {
  console.log('\n📝 Testing LLM config mapping');
  test('should map any model to llama2:7b', () => {
    assert.strictEqual(LLMConfig.getOllamaModel('any-model'), 'llama2:7b');
    assert.strictEqual(LLMConfig.getOllamaModel('llama3.2:1b'), 'llama2:7b');
    assert.strictEqual(LLMConfig.getOllamaModel('llama3.2:3b'), 'llama2:7b');
  });

  console.log('\n📝 Testing model selection logic');
  test('should always select the single model regardless of energy', () => {
    const model = new IntelligentModel();
    // Access private method via type assertion
    const selectedModel = (model as any).getModelForEnergy(100);
    assert.strictEqual(selectedModel, 'llama2:7b');

    const selectedModelLow = (model as any).getModelForEnergy(10);
    assert.strictEqual(selectedModelLow, 'llama2:7b');

    const selectedModelZero = (model as any).getModelForEnergy(0);
    assert.strictEqual(selectedModelZero, 'llama2:7b');
  });

  console.log('\n📝 Testing current model getter');
  test('should return llama2:7b as current model', () => {
    const model = new IntelligentModel();
    const currentModel = model.getCurrentModel();
    assert.strictEqual(currentModel, 'llama2:7b');
  });

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log('='.repeat(50));

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
