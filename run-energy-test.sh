#!/bin/bash

echo "🔨 Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi

echo ""
echo "⚡ Running energy tracking tests..."
echo ""

node dist/test/subagent-energy.test.js
