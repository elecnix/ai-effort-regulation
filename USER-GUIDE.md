# AI Effort Regulation - User Guide

**Version:** 1.0 (October 2025)

## Table of Contents

1. [Introduction](#introduction)
2. [Quick Start](#quick-start)
3. [Core Concepts](#core-concepts)
4. [Using the System](#using-the-system)
5. [Energy Budget Feature](#energy-budget-feature)
6. [MCP Integration](#mcp-integration)
7. [API Reference](#api-reference)
8. [Testing & Verification](#testing--verification)
9. [Troubleshooting](#troubleshooting)
10. [Advanced Configuration](#advanced-configuration)

---

## Introduction

The AI Effort Regulation system is an intelligent AI assistant that manages its own computational resources through **energy-aware cognitive processing**. Unlike traditional AI systems that process every request with maximum effort, this system adapts its behavior based on available energy, providing a more sustainable and realistic model of AI cognition.

### Key Features

- **🔋 Energy Management**: Leaky bucket algorithm regulates computational effort
- **🧠 Adaptive Behavior**: Response quality adjusts to energy levels
- **💰 Energy Budgets**: User-guided effort allocation per conversation
- **🔌 MCP Integration**: Extensible tool system via Model Context Protocol
- **🌐 HTTP Transport**: Connect to remote MCP servers
- **🔄 Continuous Reflection**: Analyzes past conversations for insights
- **📊 Real-time Analytics**: Monitor system performance and energy usage

### What Makes This Different?

Traditional AI systems treat every request equally, consuming maximum resources regardless of task complexity. This system:

- **Prioritizes sustainability** over constant high performance
- **Adapts dynamically** to resource availability
- **Learns from history** through reflection mechanisms
- **Extends capabilities** through MCP tool integration
- **Respects user guidance** via energy budgets

---

## Quick Start

### Prerequisites

- **Node.js** 18 or higher
- **Ollama** running locally (for local LLM inference)
- **Required models**: `llama3.2:1b` and `llama3.2:3b`

### Installation

```bash
# Clone the repository
git clone https://github.com/elecnix/ai-effort-regulation.git
cd ai-effort-regulation

# Install dependencies
npm install

# Build the project
npm run build

# Pull required Ollama models
ollama pull llama3.2:1b
ollama pull llama3.2:3b
```

### Running the System

```bash
# Start with default settings (port 6740)
npm start

# Start with custom port
npm start -- --port 3005

# Start with OpenRouter instead of Ollama
npm start -- --provider openrouter --model x-ai/grok-4-fast

# Debug mode (shows LLM messages)
npm run debug

# Debug with time limit
npm run debug -- --duration=60
```

### Your First Message

```bash
# Send a message
curl -X POST http://localhost:6740/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello! How does energy regulation work?"}'

# Check system status
curl http://localhost:6740/stats

# View health
curl http://localhost:6740/health
```

---

## Core Concepts

### Energy Regulation

The system uses a **leaky bucket algorithm** to manage energy:

- **Maximum Energy**: 100 units (fully rested)
- **Minimum Energy**: -50 units (urgent mode)
- **Replenishment Rate**: 10 units per second during idle periods
- **Consumption**: Varies by model and task complexity

#### Energy Ranges and Behavior

| Energy Level | Behavior | Model Selection |
|--------------|----------|-----------------|
| **>50** | Normal operation, complex responses | `llama3.2:3b` |
| **20-50** | Efficient operation, balanced responses | `llama3.2:1b` |
| **0-20** | Short cycles, simpler responses | `llama3.2:1b` |
| **<0** | Urgent mode, minimal responses | `llama3.2:1b` |

### Conversation Management

Each message creates a **conversation** with:

- **Request ID**: Unique identifier for tracking
- **State**: `active`, `snoozed`, or `ended`
- **Priority**: Determines processing order
- **Energy Tracking**: Monitors consumption per conversation
- **Response History**: All AI responses with metadata

### Reflection System

Every 30 seconds (when energy > 30), the system:

1. Analyzes recent conversations
2. Identifies topics needing deeper analysis
3. Generates follow-up insights
4. Adds reflections as new responses

This creates a **continuous learning loop** where the AI thinks about past interactions.

### Model Switching

The system automatically switches between models based on energy:

- **High Energy (>50)**: Uses larger model (`llama3.2:3b`) for complex tasks
- **Low Energy (<50)**: Switches to smaller model (`llama3.2:1b`) for efficiency
- **Context Preservation**: Maintains conversation context across switches

---

## Using the System

### Sending Messages

#### Basic Message

```bash
curl -X POST http://localhost:6740/message \
  -H "Content-Type: application/json" \
  -d '{"content": "What is quantum computing?"}'
```

Response:
```json
{
  "status": "received",
  "requestId": "abc-123-def-456"
}
```

#### Message with Custom ID

```bash
curl -X POST http://localhost:6740/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Explain AI safety", "id": "my-custom-id"}'
```

#### Message with Energy Budget

```bash
curl -X POST http://localhost:6740/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Compare microservices vs monolithic", "energyBudget": 50}'
```

### Retrieving Conversations

```bash
# Get specific conversation
curl http://localhost:6740/conversations/abc-123-def-456
```

Response:
```json
{
  "requestId": "abc-123-def-456",
  "inputMessage": "What is quantum computing?",
  "responses": [
    {
      "timestamp": "2025-10-11T12:00:00.000Z",
      "content": "Quantum computing is...",
      "energyLevel": 85,
      "modelUsed": "llama3.2:3b"
    }
  ],
  "metadata": {
    "totalEnergyConsumed": 15.5,
    "sleepCycles": 0,
    "modelSwitches": 0,
    "energyBudget": null,
    "energyBudgetRemaining": null,
    "budgetStatus": null
  }
}
```

### Monitoring System Stats

```bash
curl http://localhost:6740/stats
```

Response:
```json
{
  "total_conversations": 42,
  "total_responses": 156,
  "avg_energy_level": 45.2,
  "urgent_responses": 3
}
```

### Health Checks

```bash
curl http://localhost:6740/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-11T12:00:00.000Z"
}
```

---

## Energy Budget Feature

Energy budgets let you guide how much computational effort the AI should spend on your request.

### Understanding Energy Budgets

An energy budget is a **soft target** (not a hard limit) that tells the AI:
- How detailed you want the response
- How much effort to invest
- When to wrap up the conversation

### Budget Guidelines

| Budget Range | Use Case | Expected Behavior |
|--------------|----------|-------------------|
| **0** | Emergency/Last chance | Critical info only, immediate response |
| **1-10** | Quick questions | Concise, focused answers |
| **11-30** | Standard questions | Balanced responses with detail |
| **31-50** | Complex analysis | Comprehensive, detailed responses |
| **51+** | Deep exploration | Extensive analysis, multiple angles |
| **null** | Default | Normal energy management |

### Examples

#### Emergency (Budget: 0)

```bash
curl -X POST http://localhost:6740/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Server is down! What should I check?", "energyBudget": 0}'
```

**Result**: AI provides the most critical troubleshooting steps immediately.

#### Quick Fact (Budget: 5)

```bash
curl -X POST http://localhost:6740/message \
  -H "Content-Type: application/json" \
  -d '{"content": "What is the capital of France?", "energyBudget": 5}'
```

**Result**: Simple, direct answer: "Paris."

#### Standard Question (Budget: 20)

```bash
curl -X POST http://localhost:6740/message \
  -H "Content-Type: application/json" \
  -d '{"content": "How does HTTPS work?", "energyBudget": 20}'
```

**Result**: Balanced explanation covering key concepts.

#### Complex Analysis (Budget: 50)

```bash
curl -X POST http://localhost:6740/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Compare microservices vs monolithic architecture", "energyBudget": 50}'
```

**Result**: Comprehensive comparison with pros, cons, use cases.

### Budget Status

The system tracks budget usage:

- **within**: Under budget, can continue
- **exceeded**: Over budget, AI will try to wrap up
- **depleted**: Zero budget (last chance response)
- **null**: No budget was set

### Important Notes

1. **Soft Limit**: Budget is a guide, not a strict limit. The AI can exceed it if necessary for quality.
2. **Zero Budget**: Special case meaning "last chance to respond" - use for emergencies only.
3. **Backward Compatible**: Omitting the budget parameter works as before.
4. **Quality First**: The AI prioritizes response quality over strict budget adherence.

---

## MCP Integration

The Model Context Protocol (MCP) allows the AI to use external tools and services, dramatically extending its capabilities.

### What is MCP?

MCP is a standard protocol that connects AI systems with:
- File systems
- Databases
- APIs
- Cloud services
- Custom tools

### Available MCP Features

#### 1. Unified Tool System

MCP tools appear directly in the AI's tool list alongside core tools. No complex nesting or indirection.

**Before (Complex)**:
```json
{
  "name": "mcp_call_tool",
  "arguments": {
    "serverId": "filesystem",
    "toolName": "read_file",
    "arguments": {"path": "/etc/hosts"}
  }
}
```

**After (Simple)**:
```json
{
  "name": "filesystem_read_file",
  "arguments": {"path": "/etc/hosts"}
}
```

#### 2. HTTP Transport

Connect to remote MCP servers via HTTP/HTTPS:

- Cloud-based MCP services
- Containerized MCP servers
- Remote API integrations
- Distributed tool systems

#### 3. Tool Namespacing

Automatic prefixing prevents name collisions when multiple servers provide similar tools:

```
Server A (id: "fs-local"): fs-local_read_file
Server B (id: "fs-remote"): fs-remote_read_file
```

### Configuring MCP Servers

Create `mcp-servers.json`:

#### Local STDIO Server

```json
{
  "servers": [
    {
      "id": "filesystem-local",
      "name": "Local Filesystem",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./data"],
      "enabled": true
    }
  ]
}
```

#### Remote HTTP Server

```json
{
  "servers": [
    {
      "id": "github-remote",
      "name": "Remote GitHub Server",
      "transport": "http",
      "url": "https://mcp-api.example.com/github",
      "timeout": 30000,
      "auth": {
        "type": "bearer",
        "token": "${GITHUB_MCP_TOKEN}"
      },
      "enabled": true
    }
  ]
}
```

#### HTTP Server with API Key

```json
{
  "servers": [
    {
      "id": "weather-api",
      "name": "Weather API Server",
      "transport": "http",
      "url": "http://localhost:8080/mcp",
      "auth": {
        "type": "apikey",
        "apiKey": "${WEATHER_API_KEY}",
        "headerName": "X-API-Key"
      },
      "enabled": true
    }
  ]
}
```

### Setting Up Environment Variables

For servers using authentication:

```bash
# Set environment variables
export GITHUB_MCP_TOKEN="your-token-here"
export WEATHER_API_KEY="your-api-key-here"

# Start the system
npm start
```

### MCP Server Examples

#### Filesystem Server

Provides file operations:
- Read/write files
- List directories
- Search file contents
- File metadata

```bash
# Install
npm install -g @modelcontextprotocol/server-filesystem

# Configure in mcp-servers.json
{
  "id": "filesystem",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/directory"]
}
```

#### GitHub Server

Provides GitHub integration:
- Clone repositories
- Read repository files
- Query issues/PRs
- Commit changes

```bash
# Configure in mcp-servers.json
{
  "id": "github",
  "transport": "http",
  "url": "https://mcp.github.com/api",
  "auth": {
    "type": "bearer",
    "token": "${GITHUB_TOKEN}"
  }
}
```

### Security Best Practices

1. **Use HTTPS**: Always use HTTPS for remote servers in production
2. **Environment Variables**: Never hardcode credentials
3. **Strong Tokens**: Use strong authentication tokens
4. **Rate Limiting**: Implement rate limiting on server side
5. **Monitor Activity**: Watch for suspicious patterns

---

## API Reference

### POST /message

Send a message to the AI system.

**Endpoint**: `POST /message`

**Request Body**:
```json
{
  "content": "Your message here",
  "id": "optional-custom-id",
  "energyBudget": 50
}
```

**Parameters**:
- `content` (required): The message text
- `id` (optional): Custom request ID (auto-generated if not provided)
- `energyBudget` (optional): Energy budget for this conversation (0 or positive number)

**Response**:
```json
{
  "status": "received",
  "requestId": "generated-or-provided-id"
}
```

**Status Codes**:
- `200`: Message received successfully
- `400`: Invalid request (e.g., negative energy budget)
- `500`: Server error

### GET /conversations/:requestId

Retrieve a specific conversation.

**Endpoint**: `GET /conversations/:requestId`

**Response**:
```json
{
  "requestId": "abc-123",
  "inputMessage": "What is AI?",
  "responses": [
    {
      "timestamp": "2025-10-11T12:00:00.000Z",
      "content": "AI is artificial intelligence...",
      "energyLevel": 85,
      "modelUsed": "llama3.2:3b"
    }
  ],
  "metadata": {
    "totalEnergyConsumed": 15.5,
    "sleepCycles": 0,
    "modelSwitches": 0,
    "energyBudget": 50,
    "energyBudgetRemaining": 34.5,
    "budgetStatus": "within"
  }
}
```

**Status Codes**:
- `200`: Conversation found
- `404`: Conversation not found

### GET /stats

Get system-wide statistics.

**Endpoint**: `GET /stats`

**Response**:
```json
{
  "total_conversations": 42,
  "total_responses": 156,
  "avg_energy_level": 45.2,
  "urgent_responses": 3
}
```

### GET /health

Check system health.

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-10-11T12:00:00.000Z"
}
```

**Status Codes**:
- `200`: System healthy
- `500`: System unhealthy

---

## Testing & Verification

### Manual Testing

#### Demo Script

```bash
chmod +x demo.sh
./demo.sh
```

This script sends several test messages and displays responses.

#### Individual Tests

```bash
# Test basic message
curl -X POST http://localhost:6740/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello!"}'

# Test with energy budget
curl -X POST http://localhost:6740/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Explain AI", "energyBudget": 20}'

# Check stats
curl http://localhost:6740/stats

# Check health
curl http://localhost:6740/health
```

### Automated Testing

#### Run All Tests

```bash
npm test
```

#### Specific Test Suites

```bash
# Simple conversation tests
./test/run-with-server.sh simple

# All conversation tests
./test/run-with-server.sh all

# Energy budget tests
./run-budget-test.sh

# MCP integration tests
./run-mcp-test.sh

# Sub-agent tests
./run-subagent-test.sh
```

### Test Scenarios

The system includes comprehensive test scenarios:

1. **Simple Conversations**: Basic interaction patterns
2. **Long-Running Conversations**: Sustained engagement
3. **Future Actions**: Snooze functionality
4. **Multiple Priorities**: Conversation balancing
5. **Energy Budgets**: Budget compliance and behavior
6. **MCP Integration**: Tool discovery and invocation

---

## Troubleshooting

### Common Issues

#### Port Already in Use

**Problem**: Port 6740 is already occupied.

**Solution**:
```bash
# Use a different port
npm start -- --port 3005

# Or find and kill the process using port 6740
lsof -ti:6740 | xargs kill -9
```

#### Ollama Not Running

**Problem**: Cannot connect to Ollama.

**Solution**:
```bash
# Start Ollama
ollama serve

# Verify it's running
curl http://localhost:11434/api/tags
```

#### Models Not Found

**Problem**: Required models not available.

**Solution**:
```bash
# Pull required models
ollama pull llama3.2:1b
ollama pull llama3.2:3b

# Verify models are available
ollama list
```

#### Low Energy / System Unresponsive

**Problem**: System energy is depleted.

**Solution**:
```bash
# Start with higher replenishment rate
npm start -- --replenish-rate 20

# Or wait for energy to naturally replenish
# Energy replenishes at 10 units/second by default
```

#### MCP Server Connection Failed

**Problem**: Cannot connect to MCP server.

**Solution**:
1. Check server configuration in `mcp-servers.json`
2. Verify environment variables are set
3. Test server connectivity manually
4. Check server logs for errors
5. Ensure authentication credentials are correct

#### Database Locked

**Problem**: SQLite database is locked.

**Solution**:
```bash
# Stop all instances
pkill -f "node.*index.js"

# Remove lock file if it exists
rm conversations.db-journal

# Restart
npm start
```

### Debug Mode

Enable debug mode to see detailed LLM interactions:

```bash
# Debug mode with full output
npm run debug

# Debug mode with time limit
npm run debug -- --duration=60

# Debug mode with custom settings
npm start -- --debug --replenish-rate 20
```

### Logs and Monitoring

The system logs to console. Monitor for:

- Energy level changes
- Model switches
- Tool invocations
- Error messages
- Conversation state changes

---

## Advanced Configuration

### Command Line Options

```bash
npm start -- [options]

Options:
  --port <number>           Server port (default: 6740)
  --provider <string>       LLM provider: ollama|openrouter (default: ollama)
  --model <string>          Model name (default: llama3.2:3b)
  --replenish-rate <number> Energy replenishment rate (default: 10)
  --duration <number>       Run duration in seconds (default: unlimited)
  --debug                   Enable debug mode
```

### Environment Variables

Create a `.env` file:

```bash
# LLM Provider
OLLAMA_BASE_URL=http://localhost:11434
OPENROUTER_API_KEY=your-api-key

# MCP Authentication
GITHUB_MCP_TOKEN=your-github-token
WEATHER_API_KEY=your-weather-key

# Server Configuration
PORT=6740
REPLENISH_RATE=10
```

### Energy Configuration

Adjust energy parameters in code (`src/energy-regulator.ts`):

```typescript
const energyRegulator = new EnergyRegulator({
  maxEnergy: 100,        // Maximum energy
  minEnergy: -50,        // Minimum energy (urgent mode)
  replenishRate: 10,     // Units per second
  initialEnergy: 100     // Starting energy
});
```

### Model Configuration

Configure models in `src/intelligent-model.ts`:

```typescript
const modelConfig = {
  smallModel: 'llama3.2:1b',    // Low energy model
  largeModel: 'llama3.2:3b',    // High energy model
  switchThreshold: 50            // Energy threshold for switching
};
```

### Database Configuration

The system uses SQLite with automatic schema management. Database file: `conversations.db`

To reset the database:

```bash
rm conversations.db
npm start  # Database will be recreated
```

### Docker Deployment

```bash
# Build image
docker build -t ai-effort-regulation .

# Run container
docker run -p 6740:6740 \
  -e OLLAMA_BASE_URL=http://host.docker.internal:11434 \
  ai-effort-regulation

# Or use docker-compose
docker-compose up
```

---

## Best Practices

### Energy Budget Usage

1. **Start without budget** to see default behavior
2. **Use low budgets (5-10)** for quick questions
3. **Use medium budgets (20-30)** for standard questions
4. **Use high budgets (40-60)** for complex analysis
5. **Reserve zero budget** for true emergencies

### MCP Server Management

1. **Use descriptive server IDs** (e.g., `github-prod`, not `server1`)
2. **Keep server IDs short** for cleaner tool names
3. **Use environment variables** for credentials
4. **Enable only needed servers** to reduce overhead
5. **Monitor server health** regularly

### Performance Optimization

1. **Adjust replenishment rate** based on workload
2. **Use appropriate models** for task complexity
3. **Monitor energy levels** to prevent depletion
4. **Clean up old conversations** periodically
5. **Limit concurrent conversations** for better performance

### Security

1. **Use HTTPS** for remote MCP servers
2. **Rotate credentials** regularly
3. **Limit server permissions** to minimum required
4. **Monitor for unusual activity**
5. **Keep dependencies updated**

---

## Additional Resources

### Documentation

- **[README.md](./README.md)**: Project overview and quick start
- **[RELEASE-NOTES.md](./RELEASE-NOTES.md)**: Latest features and changes
- **[ENERGY-BUDGET-QUICKSTART.md](./ENERGY-BUDGET-QUICKSTART.md)**: Energy budget guide
- **[UNIFIED-MCP-TOOLS.md](./UNIFIED-MCP-TOOLS.md)**: MCP tool system details
- **[HTTP-MCP-IMPLEMENTATION-SUMMARY.md](./HTTP-MCP-IMPLEMENTATION-SUMMARY.md)**: HTTP transport guide
- **[TOOL-NAMESPACING.md](./TOOL-NAMESPACING.md)**: Tool namespacing explained

### Technical Specifications

- **[2-specification.md](./2-specification.md)**: System specification
- **[3-mcp-integration-spec.md](./3-mcp-integration-spec.md)**: MCP integration spec
- **[5-energy-budget-spec.md](./5-energy-budget-spec.md)**: Energy budget spec

### Community

- **GitHub Repository**: https://github.com/elecnix/ai-effort-regulation
- **Issues**: https://github.com/elecnix/ai-effort-regulation/issues
- **Discussions**: https://github.com/elecnix/ai-effort-regulation/discussions

---

## License

MIT License - See repository for details.

---

**Last Updated**: October 11, 2025  
**Version**: 1.0  
**Status**: Production Ready ✅
