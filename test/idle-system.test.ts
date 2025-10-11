import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DB_PATH = path.join(process.cwd(), 'test-idle-conversations.db');
const TEST_DURATION_SECONDS = 30;
const REPLENISH_RATE = 10; // Faster energy replenishment for testing

console.log('🧪 Starting Idle System Test\n');
console.log('This test verifies the system runs correctly with no user input\n');
console.log(`Duration: ${TEST_DURATION_SECONDS} seconds`);
console.log(`Replenish rate: ${REPLENISH_RATE}\n\n`);

// Clean up test database if it exists
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

interface TestResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalLines: number;
    errorLines: number;
    warningLines: number;
    nanErrors: number;
    malformedToolCalls: number;
    databaseErrors: number;
    mcpErrors: number;
  };
}

async function runIdleTest(): Promise<TestResult> {
  return new Promise((resolve) => {
    const result: TestResult = {
      passed: true,
      errors: [],
      warnings: [],
      stats: {
        totalLines: 0,
        errorLines: 0,
        warningLines: 0,
        nanErrors: 0,
        malformedToolCalls: 0,
        databaseErrors: 0,
        mcpErrors: 0,
      }
    };

    console.log('🚀 Starting system with empty database...\n');

    // Start the system
    const serverProcess: ChildProcess = spawn('node', [
      'dist/src/index.js',
      '--replenish-rate', REPLENISH_RATE.toString(),
      '--duration', TEST_DURATION_SECONDS.toString()
    ], {
      env: {
        ...process.env,
        DB_PATH: TEST_DB_PATH
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    const startTime = Date.now();

    // Collect stdout
    serverProcess.stdout?.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text); // Echo to console
    });

    // Collect stderr
    serverProcess.stderr?.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stderr.write(text); // Echo to console
    });

    // Handle process exit
    serverProcess.on('exit', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n\n📊 System ran for ${duration} seconds (exit code: ${code})\n`);

      // Analyze output
      analyzeOutput(output, result);

      // Determine if test passed
      result.passed = result.stats.errorLines === 0 && 
                      result.stats.nanErrors === 0 &&
                      result.stats.databaseErrors === 0;

      resolve(result);
    });

    // Handle errors
    serverProcess.on('error', (error) => {
      result.errors.push(`Process error: ${error.message}`);
      result.passed = false;
      resolve(result);
    });

    // Timeout safety (should exit naturally via --duration)
    setTimeout(() => {
      if (serverProcess.exitCode === null) {
        console.log('\n⚠️ Forcing process termination (timeout)...\n');
        serverProcess.kill('SIGTERM');
      }
    }, (TEST_DURATION_SECONDS + 10) * 1000);
  });
}

function analyzeOutput(output: string, result: TestResult) {
  const lines = output.split('\n');
  result.stats.totalLines = lines.length;

  for (const line of lines) {
    // Count error patterns
    if (line.includes('❌') || line.includes('Error:') || /error/i.test(line)) {
      result.stats.errorLines++;
      result.errors.push(line.trim());
    }

    // Count warning patterns
    if (line.includes('⚠️') || /warning/i.test(line)) {
      result.stats.warningLines++;
      result.warnings.push(line.trim());
    }

    // Specific error patterns
    if (/NaN/.test(line) && !line.includes('Awaiting')) {
      result.stats.nanErrors++;
      result.errors.push(`NaN error: ${line.trim()}`);
    }

    if (line.includes('Malformed') || line.includes('malformed')) {
      result.stats.malformedToolCalls++;
      result.warnings.push(`Malformed tool call: ${line.trim()}`);
    }

    if (line.includes('Invalid energy level')) {
      result.stats.nanErrors++;
      result.errors.push(`Invalid energy: ${line.trim()}`);
    }

    if (/database|sqlite/i.test(line) && (/error/i.test(line) || line.includes('❌'))) {
      result.stats.databaseErrors++;
      result.errors.push(`Database error: ${line.trim()}`);
    }

    if (line.includes('MCP') && (line.includes('❌') || /error/i.test(line))) {
      result.stats.mcpErrors++;
      result.errors.push(`MCP error: ${line.trim()}`);
    }
  }
}

function printResults(result: TestResult) {
  console.log('==================================================');
  console.log('📊 Test Statistics');
  console.log('==================================================');
  console.log(`Total output lines: ${result.stats.totalLines}`);
  console.log(`Error lines: ${result.stats.errorLines}`);
  console.log(`Warning lines: ${result.stats.warningLines}`);
  console.log(`NaN errors: ${result.stats.nanErrors}`);
  console.log(`Malformed tool calls: ${result.stats.malformedToolCalls}`);
  console.log(`Database errors: ${result.stats.databaseErrors}`);
  console.log(`MCP errors: ${result.stats.mcpErrors}`);
  console.log('');

  if (result.errors.length > 0) {
    console.log('==================================================');
    console.log('❌ Errors Found');
    console.log('==================================================');
    const uniqueErrors = [...new Set(result.errors)].slice(0, 10); // Show first 10 unique
    uniqueErrors.forEach((error, i) => {
      console.log(`${i + 1}. ${error}`);
    });
    if (result.errors.length > 10) {
      console.log(`... and ${result.errors.length - 10} more errors`);
    }
    console.log('');
  }

  if (result.warnings.length > 0 && result.warnings.length <= 5) {
    console.log('==================================================');
    console.log('⚠️ Warnings Found');
    console.log('==================================================');
    const uniqueWarnings = [...new Set(result.warnings)];
    uniqueWarnings.forEach((warning, i) => {
      console.log(`${i + 1}. ${warning}`);
    });
    console.log('');
  }

  console.log('==================================================');
  if (result.passed) {
    console.log('✅ IDLE SYSTEM TEST PASSED');
    console.log('==================================================');
    console.log('The system ran successfully with no critical errors.');
    if (result.stats.malformedToolCalls > 0) {
      console.log(`Note: ${result.stats.malformedToolCalls} malformed tool calls were handled gracefully.`);
    }
  } else {
    console.log('❌ IDLE SYSTEM TEST FAILED');
    console.log('==================================================');
    console.log('The system encountered errors during idle operation.');
    console.log('Review the errors above to identify issues.');
  }
  console.log('');
}

async function main() {
  try {
    const result = await runIdleTest();
    printResults(result);

    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
      console.log('🧹 Cleaned up test database\n');
    }

    process.exit(result.passed ? 0 : 1);
  } catch (error: any) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
