#!/bin/bash

# Run energy budget integration tests with auto-managed server

set -e

echo "🧪 Energy Budget Integration Tests"
echo "=================================="
echo ""

# Build the project
echo "📦 Building project..."
npm run build

# Start server in background
echo "🚀 Starting server..."
PORT=3005 node dist/src/index.js --replenish-rate 10 --duration 300 &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 3

# Check if server is running
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "❌ Server failed to start"
    exit 1
fi

echo "✅ Server started (PID: $SERVER_PID)"
echo ""

# Run tests
echo "🧪 Running budget tests..."
SERVER_URL=http://localhost:3005 npx ts-node test/run-budget-tests.ts
TEST_EXIT_CODE=$?

# Cleanup
echo ""
echo "🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All budget tests passed!"
    exit 0
else
    echo "❌ Some budget tests failed"
    exit 1
fi
