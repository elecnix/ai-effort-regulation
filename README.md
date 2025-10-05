# AI Effort Regulation Demo

[![Build Status](https://github.com/elecnix/ai-effort-regulation/actions/workflows/build.yml/badge.svg)](https://github.com/elecnix/ai-effort-regulation/actions)

An intelligent system that demonstrates **adaptive AI behavior** with energy-aware cognitive processing, reflection capabilities, and dynamic model switching.

## 🎯 Goal

This project implements an AI system that regulates its own cognitive effort expenditure while providing useful thinking and responses. The system:

- **Manages Energy**: Uses a leaky bucket algorithm to track and regulate computational resources
- **Adapts Behavior**: Changes response quality and model selection based on energy levels
- **Reflects Continuously**: Periodically analyzes past conversations to generate deeper insights
- **Learns from History**: Accesses all previous interactions to provide follow-up analysis

## 🏗️ Architecture

```
HTTP Server (Port 3002)
    ↓ POST /message
Sensitive Loop
├── Energy Regulator (Leaky Bucket: 100 max, -50 min)
├── Decision Engine (4 energy ranges with behaviors)
├── Reflection System (30s intervals, analyzes past convos)
├── Model Switcher (gemma:3b ↔ gemma:7b based on energy)
├── LLM Integration (Ollama + OpenAI client)
└── SQLite Database (conversation persistence)
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+
- **Ollama** running locally
- **Gemma models**: `ollama pull gemma:2b` and `ollama pull gemma:7b`

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

### Send Messages
```bash
curl -X POST http://localhost:3002/message \
  -H "Content-Type: application/json" \
  -d '{"content": "What is quantum computing?"}'
```

### Check System Stats
```bash
curl http://localhost:3002/stats
```

### Retrieve Conversations
```bash
curl http://localhost:3002/conversations/{requestId}
```

### Health Check
```bash
curl http://localhost:3002/health
```

### Demo Script
```bash
chmod +x demo.sh
./demo.sh
```

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
