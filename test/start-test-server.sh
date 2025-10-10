#!/bin/bash

# Start the server with accelerated replenish rate for testing
# This makes energy recovery instant so tests run much faster

REPLENISH_RATE=${REPLENISH_RATE:-1000}

echo "🧪 Starting test server with replenish rate: $REPLENISH_RATE"
node dist/src/index.js --replenish-rate $REPLENISH_RATE
