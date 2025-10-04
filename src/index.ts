import { startServer } from './server';
import { sensitiveLoop } from './loop';

async function main() {
  console.log('Starting AI Effort Regulation Demo...');

  // Start HTTP server
  startServer();

  // Start the sensitive loop
  await sensitiveLoop.start();
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
