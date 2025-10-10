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
Sensitive Loop
├── Energy Regulator (Leaky Bucket: 100 max, -50 min)
├── Decision Engine (4 energy ranges with behaviors)
├── Reflection System (30s intervals, analyzes past convos)
├── Model Switcher (llama3.2:1b ↔ llama3.2:3b based on energy)
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

The system will start on `http://localhost:3002`

### Running with OpenRouter
```bash
npm start -- --provider openrouter --model x-ai/grok-4-fast
```

### Debug Mode

You can run the system in debug mode to see the messages sent to the LLM:
```bash
npm run debug
```

It can also be useful to limit the run time to a few seconds:
```bash
npm run debug -- --duration=60
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
    "modelSwitches": 0
  }
}
```

### GET /health
Check system health.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-04T13:00:00.000Z"
}
```

## 🎨 Key Features

- **Energy-Aware Processing**: Responses adapt to available energy
- **Continuous Reflection**: System thinks about past conversations
- **Model Switching**: Automatic optimization based on complexity needs
- **Persistent Memory**: SQLite-backed conversation history
- **Real-time Analytics**: System performance monitoring
- **Adaptive Sleep**: Energy replenishment when idle

## 📚 Learn More

- **[Specification](./2-specification.md)**: Detailed technical requirements
- **[Original Prompt](./1-prompt.md)**: Initial project requirements

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `./demo.sh`
5. Submit a pull request

## 📄 License

MIT License - see repository for details.
