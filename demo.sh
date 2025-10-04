#!/bin/bash

echo "=== AI Effort Regulation Demo ==="
echo "Waiting for system to be ready..."

# Wait for system to start sleeping (energy replenished)
sleep 10

echo "Sending demonstration messages..."

# Send a series of thoughtful questions
curl -s -X POST http://localhost:3001/message \
  -H "Content-Type: application/json" \
  -d '{"content": "What is the philosophical concept of consciousness, and how does it relate to artificial intelligence?"}' > /dev/null

sleep 2

curl -s -X POST http://localhost:3001/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Explain the difference between correlation and causation with a real-world example."}' > /dev/null

sleep 2

curl -s -X POST http://localhost:3001/message \
  -H "Content-Type: application/json" \
  -d '{"content": "How does evolution by natural selection explain the development of complex adaptations?"}' > /dev/null

echo "Messages sent. Monitoring system behavior..."
echo "Check the conversation files and server logs to see the thinking in action."
