import { startServer } from './server';
import { SensitiveLoop } from './loop';

// Parse command line arguments
const args = process.argv.slice(2);
let durationSeconds: number | undefined;
let debugMode = false;
let replenishRate: number = 1;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--duration') {
    const nextArg = args[i + 1];
    if (nextArg) {
      const duration = parseInt(nextArg);
      if (!isNaN(duration) && duration > 0) {
        durationSeconds = duration;
        console.log(`⏰ Auto-stop enabled: will run for ${durationSeconds} seconds`);
      }
      i++; // Skip the next argument as it's the value
    }
  } else if (args[i] === '--debug') {
    debugMode = true;
    console.log(`🔍 Debug mode enabled: full LLM prompts will be logged`);
  } else if (args[i] === '--replenish-rate') {
    const nextArg = args[i + 1];
    if (nextArg) {
      const rate = parseFloat(nextArg);
      if (!isNaN(rate) && rate > 0) {
        replenishRate = rate;
        console.log(`⚡ Replenish rate set to ${replenishRate} units per second`);
      }
      i++; // Skip the next argument as it's the value
    }
  }
}

// Create sensitive loop instance with debug mode
const sensitiveLoop = new SensitiveLoop(debugMode, replenishRate);

// Make sensitive loop globally accessible for server endpoints
(global as any).sensitiveLoop = sensitiveLoop;

async function main() {
  console.log('Starting AI Effort Regulation Demo...');

  // Start HTTP server
  startServer();

  // Start the sensitive loop
  await sensitiveLoop.start(durationSeconds);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  sensitiveLoop.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  sensitiveLoop.stop();
  process.exit(0);
});

main().catch(console.error);
