/**
 * Tests for environment variable defaults
 */

import { validateEnvVariables } from '../src/validation';
import * as assert from 'assert';

console.log('🧪 Environment Variable Defaults Tests');
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
  const originalEnv = process.env;

  console.log('\n📝 Testing default OLLAMA_BASE_URL');
  test('should set default OLLAMA_BASE_URL when not provided', () => {
    process.env = { ...originalEnv };
    delete process.env.OLLAMA_BASE_URL;
    
    validateEnvVariables();
    
    assert.strictEqual(process.env.OLLAMA_BASE_URL, 'http://localhost:11434');
  });

  console.log('\n📝 Testing default PORT');
  test('should set default PORT when not provided', () => {
    process.env = { ...originalEnv };
    delete process.env.PORT;
    
    validateEnvVariables();
    
    assert.strictEqual(process.env.PORT, '6740');
  });

  console.log('\n📝 Testing OLLAMA_BASE_URL override');
  test('should not override existing OLLAMA_BASE_URL', () => {
    process.env = { ...originalEnv };
    process.env.OLLAMA_BASE_URL = 'http://custom:8080';
    
    validateEnvVariables();
    
    assert.strictEqual(process.env.OLLAMA_BASE_URL, 'http://custom:8080');
  });

  console.log('\n📝 Testing PORT override');
  test('should not override existing PORT', () => {
    process.env = { ...originalEnv };
    process.env.PORT = '3000';
    
    validateEnvVariables();
    
    assert.strictEqual(process.env.PORT, '3000');
  });

  console.log('\n📝 Testing validation without errors');
  test('should validate without throwing when defaults are applied', () => {
    process.env = { ...originalEnv };
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.PORT;
    
    assert.doesNotThrow(() => validateEnvVariables());
  });

  // Restore original env
  process.env = originalEnv;

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
