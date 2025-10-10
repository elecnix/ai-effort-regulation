#!/bin/bash

# Helper script to run tests with properly configured server

set -e

TEST_TYPE=${1:-simple}

echo "🧹 Cleaning up..."
pkill -9 -f "node dist/src/index.js" 2>/dev/null || true
rm -f conversations.db
sleep 2

echo "📦 Building..."
npm run build

echo "📊 Calculating test duration..."
# Get recommended duration from test runner
DURATION_INFO=$(node dist/test/run-tests.js $TEST_TYPE 2>&1 | grep "Recommended server duration")
if [ -n "$DURATION_INFO" ]; then
    DURATION=$(echo "$DURATION_INFO" | grep -oP '\d+(?=s)')
    echo "✅ Recommended duration: ${DURATION}s"
else
    # Fallback durations
    case $TEST_TYPE in
        simple)
            DURATION=180
            ;;
        all)
            DURATION=600
            ;;
        *)
            DURATION=300
            ;;
    esac
    echo "⚠️  Using fallback duration: ${DURATION}s"
fi

echo ""
echo "🚀 Starting server (duration: ${DURATION}s, replenish rate: 10)..."
node dist/src/index.js --replenish-rate 10 --duration $DURATION > /tmp/ai-server.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to be ready
echo "⏳ Waiting for server to be ready..."
sleep 5

# Check if server is healthy
if ! curl -s http://localhost:3005/health > /dev/null; then
    echo "❌ Server failed to start"
    cat /tmp/ai-server.log
    exit 1
fi

echo "✅ Server is healthy"
echo ""

# Run tests
echo "🧪 Running tests: $TEST_TYPE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node dist/test/run-tests.js $TEST_TYPE

TEST_EXIT_CODE=$?

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Wait for server to finish gracefully
echo "⏳ Waiting for server to finish..."
wait $SERVER_PID 2>/dev/null || true

echo "✅ Test run complete"
echo ""

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All tests passed!"
else
    echo "❌ Some tests failed (exit code: $TEST_EXIT_CODE)"
    echo ""
    echo "📝 Server log available at: /tmp/ai-server.log"
fi

exit $TEST_EXIT_CODE
