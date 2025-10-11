# Quick Reference Guide

Fast reference for common tasks and commands.

## Installation & Setup

```bash
# Clone and install
git clone https://github.com/elecnix/ai-effort-regulation.git
cd ai-effort-regulation
npm install
npm run build

# Pull required models
ollama pull llama3.2:1b
ollama pull llama3.2:3b

# Start the system
npm start
```

## Common Commands

### Starting the System

```bash
# Default (port 6740, Ollama)
npm start

# Custom port
npm start -- --port 3005

# With OpenRouter
npm start -- --provider openrouter --model x-ai/grok-4-fast

# Debug mode
npm run debug

# With time limit
npm start -- --duration=300

# Custom energy replenishment
npm start -- --replenish-rate 20
```

### Sending Messages

```bash
# Basic message
curl -X POST http://localhost:6740/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Your question here"}'

# With energy budget
curl -X POST http://localhost:6740/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Your question", "energyBudget": 50}'

# With custom ID
curl -X POST http://localhost:6740/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Your question", "id": "my-id"}'
```

### Retrieving Information

```bash
# Get conversation
curl http://localhost:6740/conversations/{requestId}

# Get stats
curl http://localhost:6740/stats

# Health check
curl http://localhost:6740/health
```

### Testing

```bash
# All tests
npm test

# Conversation tests
./test/run-with-server.sh all

# Energy budget tests
./run-budget-test.sh

# MCP tests
./run-mcp-test.sh

# Demo script
./demo.sh
```

## Energy Budget Guidelines

| Budget | Use Case | Example |
|--------|----------|---------|
| **0** | Emergency | "Server down! What to check?" |
| **5** | Quick fact | "Capital of France?" |
| **20** | Standard question | "How does HTTPS work?" |
| **50** | Complex analysis | "Compare microservices vs monolithic" |
| **null** | Default | No budget specified |

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/message` | Send message to AI |
| GET | `/conversations/:id` | Get conversation |
| GET | `/stats` | System statistics |
| GET | `/health` | Health check |

## MCP Server Configuration

### Local STDIO Server

```json
{
  "id": "filesystem",
  "name": "Local Filesystem",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "./data"],
  "enabled": true
}
```

### Remote HTTP Server

```json
{
  "id": "github",
  "name": "GitHub API",
  "transport": "http",
  "url": "https://mcp-api.example.com/github",
  "auth": {
    "type": "bearer",
    "token": "${GITHUB_TOKEN}"
  },
  "enabled": true
}
```

## Environment Variables

```bash
# Ollama
export OLLAMA_BASE_URL=http://localhost:11434

# OpenRouter
export OPENROUTER_API_KEY=your-api-key

# MCP Authentication
export GITHUB_TOKEN=your-github-token
export API_KEY=your-api-key

# Server
export PORT=6740
export REPLENISH_RATE=10
```

## Troubleshooting

### Port in Use

```bash
# Use different port
npm start -- --port 3005

# Or kill process
lsof -ti:6740 | xargs kill -9
```

### Ollama Not Running

```bash
# Start Ollama
ollama serve

# Verify
curl http://localhost:11434/api/tags
```

### Models Missing

```bash
# Pull models
ollama pull llama3.2:1b
ollama pull llama3.2:3b

# List models
ollama list
```

### Low Energy

```bash
# Increase replenishment
npm start -- --replenish-rate 20

# Or wait (10 units/second default)
```

### Database Locked

```bash
# Stop all instances
pkill -f "node.*index.js"

# Remove lock
rm conversations.db-journal

# Restart
npm start
```

## Energy Levels

| Level | Behavior |
|-------|----------|
| **>50** | Normal, complex responses, large model |
| **20-50** | Efficient, balanced responses, small model |
| **0-20** | Short cycles, simple responses |
| **<0** | Urgent mode, minimal responses |

## Response Metadata

```json
{
  "timestamp": "2025-10-11T12:00:00.000Z",
  "content": "Response text...",
  "energyLevel": 85,
  "modelUsed": "llama3.2:3b"
}
```

## Conversation Metadata

```json
{
  "totalEnergyConsumed": 25.3,
  "sleepCycles": 2,
  "modelSwitches": 1,
  "energyBudget": 50,
  "energyBudgetRemaining": 24.7,
  "budgetStatus": "within"
}
```

## Budget Status Values

- **within**: Under budget, can continue
- **exceeded**: Over budget, wrapping up
- **depleted**: Zero budget (last chance)
- **null**: No budget set

## Docker Commands

```bash
# Build
docker build -t ai-effort-regulation .

# Run
docker run -p 6740:6740 ai-effort-regulation

# With environment
docker run -p 6740:6740 \
  -e OLLAMA_BASE_URL=http://host.docker.internal:11434 \
  ai-effort-regulation

# Docker Compose
docker-compose up
docker-compose down
```

## File Locations

- **Database**: `conversations.db`
- **MCP Config**: `mcp-servers.json`
- **Environment**: `.env`
- **Source**: `src/`
- **Tests**: `test/`
- **Build**: `dist/`

## Useful npm Scripts

```bash
npm start           # Start server
npm run build       # Build TypeScript
npm run dev         # Development mode
npm test            # Run tests
npm run debug       # Debug mode
```

## Common Patterns

### Quick Question

```bash
curl -X POST http://localhost:6740/message \
  -H "Content-Type: application/json" \
  -d '{"content": "What is X?", "energyBudget": 5}'
```

### Detailed Analysis

```bash
curl -X POST http://localhost:6740/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Analyze X vs Y", "energyBudget": 50}'
```

### Emergency Response

```bash
curl -X POST http://localhost:6740/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Critical issue!", "energyBudget": 0}'
```

### Check Result

```bash
# Save request ID from response
REQUEST_ID="abc-123"

# Get conversation
curl http://localhost:6740/conversations/$REQUEST_ID | jq
```

## Key Metrics

- **Max Energy**: 100
- **Min Energy**: -50
- **Replenish Rate**: 10 units/second (default)
- **Default Port**: 6740
- **Model Switch Threshold**: 50 energy

## Documentation Links

- **[User Guide](./USER-GUIDE.md)**: Complete user documentation
- **[Features](./FEATURES.md)**: All features and status
- **[Energy Budgets](./ENERGY-BUDGET-QUICKSTART.md)**: Budget guide
- **[Release Notes](./RELEASE-NOTES.md)**: Latest changes
- **[README](./README.md)**: Project overview

## Support

- **Issues**: https://github.com/elecnix/ai-effort-regulation/issues
- **Discussions**: https://github.com/elecnix/ai-effort-regulation/discussions

---

**Version**: 1.0  
**Last Updated**: October 11, 2025
