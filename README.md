# AI Effort Regulation Demo

[![Build Status](https://github.com/elecnix/ai-effort-regulation/actions/workflows/build.yml/badge.svg)](https://github.com/elecnix/ai-effort-regulation/actions)

An intelligent system that demonstrates **adaptive AI behavior** with energy-aware cognitive processing, reflection capabilities, and dynamic model switching.

## 🎯 Goal

This project implements an AI system that regulates its own cognitive effort expenditure while providing useful thinking and responses. The system:

- **Manages Energy**: Uses a leaky bucket algorithm to track and regulate computational resources
- **Adapts Behavior**: Changes response quality and model selection based on energy levels
- **Reflects Continuously**: Periodically analyzes past conversations to generate deeper insights
- **Learns from History**: Accesses all previous interactions to provide follow-up analysis

### Energy as Effort Quota

The energy level represents the AI's "effort quota" - a finite resource that must be managed wisely:

- **Primary Goal**: Maintain operational energy (>0%) to handle work and respond to inputs
- **Avoid Deadlock**: Energy should NOT get stuck at 0% - this prevents the system from working
- **Work Focus**: The goal is to GET WORK DONE, not to maintain high energy levels
- **Sustainable Operation**: Any average energy above 0% is acceptable as long as work continues
- **Smart Recovery**: Use await_energy proactively before hitting 0% to prevent deadlock
- **Responsive System**: Must maintain enough energy to handle conversations and unsnooze events

## 🏗️ Architecture

```
HTTP Server (Port 3002)
    ↓ POST /message
App Layer (Multi-Channel Architecture)
├── Chat App (HTTP conversations)
├── Future: Gmail App (email conversations)
├── Future: Calendar App (event conversations)
└── Future: Custom Apps (extensible)
    ↓
Sensitive Loop (Central Decision Engine)
├── Energy Regulator (Leaky Bucket: 100 max, -50 min)
├── Decision Engine (4 energy ranges with behaviors)
├── Reflection System (30s intervals, analyzes past convos)
├── Model Switcher (llama3.2:1b ↔ llama3.2:3b based on energy)
├── App Registry (manages installed apps)
├── Energy Tracker (per-app energy consumption)
├── Message Router (routes responses to correct app)
├── LLM Integration (Ollama + OpenAI client)
└── SQLite Database (conversation persistence)
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+
- **Ollama** running locally
- **Llama models**: `ollama pull llama3.2:1b` and `ollama pull llama3.2:3b`

### Installation
```bash
git clone https://github.com/elecnix/ai-effort-regulation.git
cd ai-effort-regulation
npm install
npm run build
```

### Running
```bash
npm start
```

The system will start on `http://localhost:6740` (default port)

**Note**: On first run, the system creates a `conversations.db` file. If upgrading from v1.0, delete the old database:
```bash
rm conversations.db
npm start
```

### Command-Line Options

```bash
npm start -- [options]

Options:
  --port <number>          Server port (default: 6740)
  --provider <name>        AI provider: ollama or openrouter (default: ollama)
  --model <name>           Model name (provider-specific)
  --replenish-rate <num>   Energy replenish rate per second (default: 1)
  --duration <seconds>     Auto-stop after duration (for testing)
  --debug                  Enable debug mode (show LLM prompts)
```

### Examples

**Custom Port:**
```bash
npm start -- --port 3002
```

**OpenRouter Provider:**
```bash
npm start -- --provider openrouter --model x-ai/grok-4-fast
```

**Debug Mode:**
```bash
npm run debug
npm run debug -- --duration=60
```

**Fast Energy Replenishment (Testing):**
```bash
npm start -- --replenish-rate 10 --duration 300
```

## 🧪 Testing

### Manual Testing

#### Send Messages
```bash
curl -X POST http://localhost:3002/message \
  -H "Content-Type: application/json" \
  -d '{"content": "What is quantum computing?"}'
```

#### Check System Stats
```bash
curl http://localhost:3002/stats
```

#### Retrieve Conversations
```bash
curl http://localhost:3002/conversations/{requestId}
```

#### Health Check
```bash
curl http://localhost:3002/health
```

#### Demo Script
```bash
chmod +x demo.sh
./demo.sh
```

### Automated Testing Framework

The automated testing framework validates the AI's energy regulation behavior and conversation management patterns. Tests run with local Ollama models (including very small models like gemma:2b) to ensure the system converges to stable energy patterns.

#### Test Scenarios

1. **Simple Conversations** - Validates basic interaction patterns
   - User says "Hello, how are you?"
   - AI responds appropriately
   - System maintains conversation until natural conclusion
   - Energy converges to stable levels (not constantly at 0%)
   - Conversation snoozes with exponential backoff if user doesn't respond

2. **Long-Running Conversations** - Tests sustained engagement
   - User requests brainstorming (e.g., "Let's brainstorm baby names")
   - AI provides multiple responses over time
   - System recognizes one-sided conversations
   - Eventually snoozes or terminates when user engagement drops

3. **Future Actions** - Tests snooze functionality
   - User requests future action (e.g., "Increase thermostat in 5 minutes")
   - AI acknowledges and snoozes conversation
   - Conversation reactivates at the right time
   - Action is attempted when timer expires

4. **Multiple Priorities** - Tests conversation balancing
   - System prioritizes based on urgency
   - Energy is distributed appropriately across tasks

#### Running Tests

**Automated (Recommended)**:
```bash
./test/run-with-server.sh simple      # Run simple tests with auto-managed server
./test/run-with-server.sh all         # Run all tests
```

**Manual** (if you prefer to manage the server yourself):
1. Start server in one terminal:
   ```bash
   # Use duration from test output (test runner shows recommended duration)
   node dist/src/index.js --replenish-rate 10 --duration 180
   ```

2. Run tests in another terminal:
   ```bash
   npm test                    # Run all tests
   npm run test:simple        # Test simple conversations
   npm run test:brainstorm    # Test long-running conversations  
   npm run test:snooze        # Test future actions
   npm run test:priorities    # Test multiple priorities
   ```

**Note**: Tests run with accelerated energy replenishment (`--replenish-rate 10`) for faster execution.

#### Test Configuration
Tests use local Ollama models configured in `test/config.json`:
```json
{
  "models": ["llama3.2:1b", "llama3.2:3b"],
  "energyTargets": {
    "convergence": 50,      // Target energy level for stability
    "tolerance": 20         // Acceptable variance
  },
  "timeouts": {
    "conversation": 1800,   // 30 minutes max conversation
    "snooze": 300          // 5 minute snooze test
  }
}
```

#### Success Criteria

- **Energy Convergence**: System maintains average energy near target levels (50-100%)
- **Appropriate Timing**: Actions occur at expected times
- **Conversation Management**: Proper handling of active, snoozed, and ended states
- **Resource Efficiency**: Energy quota used mindfully, not depleted unnecessarily

## 📊 Energy Regulation Behavior

| Energy Level | Behavior |
|-------------|----------|
| **>50** | Normal operation, complex responses |
| **20-50** | Model switching to smaller model |
| **0-20** | Short cycles, simpler responses |
| **<0** | Urgent mode, pressing tone, minimal responses |

## 🔄 Reflection System

Every 30 seconds (when energy > 30), the system:
1. Analyzes recent conversations
2. Identifies topics needing deeper analysis
3. Generates follow-up insights
4. Adds "FOLLOW-UP REFLECTION" responses

## 🗄️ Data Storage

- **SQLite Database**: `conversations.db` (auto-created)
- **Schema**: Conversations and responses with metadata
- **Analytics**: Energy tracking, model switches, conversation stats

## 🛠️ Development

### Build
```bash
npm run build
```

### Development Mode
```bash
npm run dev
```

### TypeScript Checking
```bash
npx tsc --noEmit
```

## 📋 API Reference

### POST /message
Send a message to the AI system.

**Request:**
```json
{
  "content": "Your question here",
  "id": "optional-request-id"
}
```

**Response:**
```json
{
  "status": "received",
  "requestId": "generated-or-provided-id"
}
```

### GET /stats
Get system-wide conversation statistics.

**Response:**
```json
{
  "total_conversations": 42,
  "total_responses": 156,
  "avg_energy_level": 45.2,
  "urgent_responses": 3
}
```

### GET /conversations
List recent conversations with optional filtering.

**Query Parameters:**
- `limit` (optional): Number of conversations to return (default: 10)
- `state` (optional): Filter by state (`active`, `ended`)
- `budgetStatus` (optional): Filter by budget status (`within`, `exceeded`, `depleted`)

**Response:**
```json
{
  "conversations": [...],
  "total": 5,
  "filters": {
    "state": "active",
    "budgetStatus": "exceeded"
  }
}
```

### GET /conversations/:requestId
Retrieve a specific conversation.

**Response:**
```json
{
  "requestId": "abc-123",
  "inputMessage": "What is AI?",
  "responses": [
    {
      "timestamp": "2025-10-04T13:00:00.000Z",
      "content": "AI is artificial intelligence...",
      "energyLevel": 85,
      "modelUsed": "gemma:3b"
    }
  ],
  "metadata": {
    "totalEnergyConsumed": 0,
    "sleepCycles": 0,
    "modelSwitches": 0,
    "budgetStatus": "within",
    "energyBudget": 50
  }
}
```

### GET /energy
Get current energy level (lightweight endpoint).

**Response:**
```json
{
  "current": 85.5,
  "percentage": 85,
  "status": "high",
  "timestamp": "2025-10-11T06:52:31.895Z"
}
```

### GET /health
Check system health.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-04T13:00:00.000Z",
  "uptime": 3600,
  "energy": {
    "current": 85,
    "percentage": 85,
    "status": "high"
  }
}
```

### GET /apps
List all installed apps with their configurations and energy metrics.

**Response:**
```json
{
  "apps": [
    {
      "id": "chat",
      "name": "Chat App",
      "type": "in-process",
      "enabled": true,
      "energyMetrics": {
        "total": 1250.5,
        "last24h": 450.2,
        "last1h": 85.3,
        "last1min": 5.2
      }
    }
  ]
}
```

### POST /apps/install
Install a new app.

**Request:**
```json
{
  "id": "gmail",
  "name": "Gmail App",
  "type": "http",
  "enabled": true,
  "config": {
    "url": "http://localhost:8080"
  },
  "hourlyEnergyBudget": 100,
  "dailyEnergyBudget": 1000
}
```

**Response:**
```json
{
  "success": true,
  "appId": "gmail"
}
```

### POST /apps/:appId/start
Start an installed app.

**Response:**
```json
{
  "success": true,
  "appId": "gmail"
}
```

### POST /apps/:appId/stop
Stop a running app.

**Response:**
```json
{
  "success": true,
  "appId": "gmail"
}
```

### DELETE /apps/:appId
Uninstall an app.

**Response:**
```json
{
  "success": true,
  "appId": "gmail"
}
```

### GET /apps/:appId/memories
List memories for an app.

**Response:**
```json
{
  "appId": "chat",
  "count": 3,
  "memories": [
    {
      "id": 1,
      "content": "User prefers meetings after 2pm on weekdays.",
      "createdAt": "2025-10-11T14:30:00.000Z",
      "updatedAt": "2025-10-11T14:30:00.000Z",
      "sourceConversationId": "abc-123"
    }
  ]
}
```

### DELETE /apps/:appId/memories
Purge all memories for an app.

**Response:**
```json
{
  "success": true,
  "appId": "chat",
  "deletedCount": 8
}
```

### DELETE /apps/:appId/memories/:memoryId
Delete a specific memory.

**Response:**
```json
{
  "success": true,
  "memoryId": 1
}
```

### POST /admin/trigger-reflection
Manually trigger a reflection cycle (for testing/debugging).

**Response:**
```json
{
  "status": "triggered",
  "message": "Reflection cycle initiated"
}
```

### POST /admin/process-conversation/:requestId
Force processing of a specific conversation (for testing/debugging).

**Response:**
```json
{
  "status": "processed",
  "requestId": "abc-123"
}
```

## 🎨 Key Features

### Core Capabilities
- **Energy-Aware Processing**: Responses adapt to available energy
- **User-Guided Energy Budgets**: Specify effort allocation per conversation
- **Continuous Reflection**: System thinks about past conversations
- **Model Switching**: Automatic optimization based on complexity needs
- **Persistent Memory**: SQLite-backed conversation history
- **Real-time Analytics**: System performance monitoring
- **Adaptive Sleep**: Energy replenishment when idle

### Multi-App Architecture
- **App Registry**: Install, manage, and monitor multiple apps
- **Conversation Isolation**: Each app only sees its own conversations
- **Per-App Energy Tracking**: Monitor energy consumption by app with time windows
- **Message Routing**: Automatic routing of responses to originating apps
- **Extensible Design**: Easy to add new apps (Gmail, Calendar, etc.)
- **App Lifecycle Management**: Install, start, stop, uninstall apps

### Memory System (NEW!)
- **Automatic Memory Creation**: Memories are created when conversations end
- **App-Scoped Memories**: Each app has its own isolated memory space (10 records max)
- **Intelligent Compaction**: LLM-based decisions on which memories to keep/merge/delete
- **Context Injection**: Memories automatically included in relevant conversations
- **Memory Management API**: View and purge memories via REST endpoints

### MCP Integration
- **Extensible Tool System**: Unified interface for MCP tools
- **HTTP Transport**: Connect to remote MCP servers via HTTP/HTTPS
- **Tool Namespacing**: Automatic collision prevention for MCP tools

## 📚 Documentation

### User Documentation
- **[User Guide](./USER-GUIDE.md)**: Comprehensive user guide with examples
- **[Quick Reference](./QUICK-REFERENCE.md)**: Fast reference for common tasks
- **[Features Overview](./FEATURES.md)**: Complete feature list and status
- **[Energy Budget Quick Start](./ENERGY-BUDGET-QUICKSTART.md)**: Guide to energy budgets
- **[Migration Guide](./MIGRATION-GUIDE.md)**: Upgrading from previous versions
- **[Release Notes](./RELEASE-NOTES.md)**: Latest features and changes

### Technical Documentation
- **[System Specification](./2-specification.md)**: Detailed technical requirements
- **[MCP Integration Spec](./3-mcp-integration-spec.md)**: MCP integration details
- **[Energy Budget Spec](./5-energy-budget-spec.md)**: Energy budget specification
- **[Apps Vision](./6-apps-vision.md)**: Multi-app architecture vision
- **[Apps Specification](./7-apps-specification.md)**: Apps feature technical spec
- **[HTTP MCP Spec](./HTTP-MCP-SPEC.md)**: HTTP transport specification

### Implementation Guides
- **[Apps Implementation Plan](./8-apps-implementation-plan.md)**: Phased implementation plan
- **[Apps Implementation Summary](./9-apps-implementation-summary.md)**: Implementation status
- **[App-Conversation Binding](./10-app-conversation-binding.md)**: Message routing architecture
- **[Unified MCP Tools](./UNIFIED-MCP-TOOLS.md)**: MCP tool system explained
- **[Tool Namespacing](./TOOL-NAMESPACING.md)**: Tool naming and collision prevention
- **[HTTP MCP Implementation](./HTTP-MCP-IMPLEMENTATION-SUMMARY.md)**: HTTP transport guide
- **[MCP Integration Complete](./MCP-INTEGRATION-COMPLETE.md)**: MCP integration summary

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `./demo.sh`
5. Submit a pull request

## 📄 License

MIT License - see repository for details.
