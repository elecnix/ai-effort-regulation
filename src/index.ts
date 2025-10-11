import { startServer } from './server';
import { SensitiveLoop } from './loop';
import { ProviderConfiguration } from './provider-config';
import { EventBridge } from './event-bridge';
import { validateEnvVariables } from './validation';

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
  } else if (args[i] === '--provider') {
    const nextArg = args[i + 1];
    if (nextArg && (nextArg === 'ollama' || nextArg === 'openrouter')) {
      process.env.AI_PROVIDER = nextArg;
      console.log(`🤖 AI Provider set to: ${nextArg}`);
      i++; // Skip the next argument as it's the value
    } else {
      console.error('❌ Invalid provider. Must be "ollama" or "openrouter"');
    }
  } else if (args[i] === '--model') {
    const nextArg = args[i + 1];
    if (nextArg) {
      process.env.AI_MODEL = nextArg;
      console.log(`🧠 AI Model set to: ${nextArg}`);
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

  // Validate environment variables
  try {
    validateEnvVariables();
  } catch (error) {
    console.error(`❌ Environment validation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  // Validate provider configuration
  const provider = process.env.AI_PROVIDER || 'ollama';
  try {
    ProviderConfiguration.validateConfig(provider);
  } catch (error) {
    console.error(`❌ Configuration error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  // Start HTTP server and WebSocket server
  const { port, server, wsServer } = await startServer();

  // Initialize event bridge
  const eventBridge = new EventBridge(wsServer, sensitiveLoop);
  eventBridge.start();
  console.log('🌉 Event bridge initialized');

  // Make event bridge globally accessible
  (global as any).eventBridge = eventBridge;

  // Start the sensitive loop
  await sensitiveLoop.start(durationSeconds);
}

// Graceful shutdown handler
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    console.log('⚠️  Shutdown already in progress...');
    return;
  }
  
  isShuttingDown = true;
  console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);
  
  try {
    // Stop accepting new requests
    const globalLoop = (global as any).sensitiveLoop;
    const server = (global as any).httpServer;
    const wsServer = (global as any).wsServer;
    
    // Close WebSocket server
    if (wsServer) {
      console.log('📡 Closing WebSocket connections...');
      wsServer.close();
    }
    
    // Close HTTP server
    if (server) {
      console.log('🌐 Closing HTTP server...');
      await new Promise<void>((resolve) => {
        server.close(() => {
          console.log('✅ HTTP server closed');
          resolve();
        });
      });
    }
    
    // Stop the sensitive loop
    if (globalLoop) {
      console.log('🔄 Stopping cognitive loop...');
      globalLoop.stop();
    }
    
    // Close database connections
    if (globalLoop && globalLoop.inbox) {
      console.log('💾 Closing database...');
      const db = globalLoop.inbox.getDatabase();
      db.close();
    }
    
    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle various termination signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
