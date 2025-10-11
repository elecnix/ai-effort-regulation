# AI Effort Regulation Demo Specification

## Overview

This specification outlines a demonstration system for balancing and regulating the effort or energy consumption of a Large Language Model (LLM). The system uses Ollama for local LLM inference and implements an energy-based regulation mechanism to simulate cognitive fatigue and recovery cycles.

## System Goals

- Demonstrate adaptive energy consumption based on available resources
- Show model switching based on task complexity and energy levels
- Implement a feedback loop that regulates LLM activity through sleep/recovery cycles
- Provide observable conversation traces for analysis

## Core Components

### 1. HTTP Server
- Receives external messages via POST requests
- Each message includes a unique request ID
- Messages are inserted into the sensitive loop's history
- Built with Node.js/TypeScript

### 2. Sensitive Loop
- Maintains conversation history with sliding window (last few messages)
- Receives ephemeral energy status messages
- Can perform actions: inference, sleep, model switching
- Runs continuously, processing inputs and managing state

### 3. Energy Regulation System
- Implements leaky bucket algorithm
- Provides energy replenishment during sleep periods
- Sends energy status to sensitive loop as ephemeral messages
- Energy ranges: 0 (depleted) to 100 (fully rested)
- Allows negative energy for urgent situations

### 4. LLM Integration
- Uses Ollama for local model inference
- Supports multiple models: Gemma 3B, Ollama 8B, etc.
- Different energy consumption rates per model
- Maintains model history and context

### 5. Tool System
- Response tool for sending replies to specific request IDs
- Creates JSON files containing conversation traces
- Preserves input messages and model responses

## Architecture

```
┌─────────────────┐    ┌──────────────────┐
│   HTTP Server   │────│  Sensitive Loop  │
│   (Express)     │    │                  │
└─────────────────┘    │                  │
                       │ ┌─────────────┐  │
                       │ │ Energy      │  │
                       │ │ Regulator   │  │
                       │ └─────────────┘  │
                       │                  │
                       │ ┌─────────────┐  │
                       │ │ LLM (Ollama)│  │
                       │ └─────────────┘  │
                       └──────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ JSON Trace      │
                       │ Files           │
                       └─────────────────┘
```

## Energy Regulation Mechanism

### Leaky Bucket Algorithm
- Energy bucket starts at 100 (full)
- Inference consumes energy at model-specific rates:
  - Gemma 3B: 5 energy units per inference
  - Ollama 8B: 15 energy units per inference
- Energy replenishes at 10 units per second during sleep
- Minimum energy: -50 (urgent mode)
- Maximum energy: 100 (fully rested)

### Decision Logic
- Energy > 50: Normal operation, can perform complex tasks
- Energy 20-50: Suggest simpler tasks, consider model switch
- Energy 0-20: Recommend sleep, short cycles for urgent tasks
- Energy < 0: Urgent mode - sleep in minimal cycles, use pressing tone

### Sleep Mechanism
- Loop can sleep for 1-60 seconds
- Sleep duration based on energy needs and urgency
- Energy replenishes proportionally to sleep time

## Sensitive Loop Implementation

### Loop Structure
```typescript
while (true) {
  // Check for new messages
  // Update energy status
  // Evaluate current energy level
  // Decide action: infer, sleep, or switch model
  // Execute action
}
```

### Actions Available
1. **Inference**: Call LLM with current context
2. **Sleep**: Pause execution, replenish energy
3. **Model Switch**: Change to different Ollama model
4. **Respond**: Use tool to send response to specific request

### History Management
- Sliding window: Keep last 10 messages
- Ephemeral energy messages: Not persisted in main history
- External requests: Persist with request ID for extended period
- Internal thoughts: Keep in sliding window

## HTTP Server Interface

### Endpoints
- `POST /message`: Receive external messages
  - Body: `{ "id": "string", "content": "string" }`
  - Response: `{ "status": "received", "requestId": "string" }`

### Message Handling
- Validate request format
- Assign or validate request ID
- Insert into sensitive loop queue
- Return acknowledgment

## LLM Integration

### Ollama Configuration
- Local instance running on default port (11434)
- Models: gemma:3b, llama2:7b, llama2:13b (or similar)
- Context window management
- Streaming responses for real-time processing

### Prompt Engineering
- Initial system prompt establishes energy awareness
- Energy status injected as system messages
- Tool use instructions for responses

## Tool Calls and Response System

### Response Tool
- Function: `respond(requestId: string, content: string)`
- Creates/updates JSON file: `conversations/${requestId}.json`
- Structure:
```json
{
  "requestId": "string",
  "inputMessage": "string",
  "responses": [
    {
      "timestamp": "ISO string",
      "content": "string",
      "energyLevel": number,
      "modelUsed": "string"
    }
  ],
  "metadata": {
    "totalEnergyConsumed": number,
    "sleepCycles": number,
    "modelSwitches": number
  }
}
```

### Conversation Tracing
- All responses logged with timestamps
- Energy levels recorded per response
- Model switching events tracked
- Sleep cycles counted

## Technologies and Dependencies

### Core Technologies
- **TypeScript**: Primary language
- **Node.js**: Runtime environment
- **Express.js**: HTTP server framework
- **AISDK (Vercel)**: LLM integration and agent framework
- **Agents SDK (Vercel)**: Agent behavior management

### Dependencies
- `@ai-sdk/openai`: For Ollama integration (if compatible)
- `express`: HTTP server
- `uuid`: Request ID generation
- `fs-extra`: File operations for JSON traces
- `node-cron`: Energy replenishment scheduling

### Ollama Models
- Gemma 3B: Low energy consumption
- Llama 2 7B/13B: Medium to high consumption
- Custom energy rates configurable

## Implementation Notes

### Energy Measurement
- GPU utilization monitoring (if available)
- Inference time tracking for energy consumption
- Adaptive rate adjustment based on hardware

### Model Switching Logic
- Automatic switch to smaller model when energy low
- Manual override capability
- Context preservation during switches

### Safety and Limits
- Maximum sleep time: 60 seconds
- Minimum sleep time: 1 second
- Energy bounds: -50 to 100
- History window: 10 messages

### Observability
- Console logging for loop activity
- JSON files for conversation analysis
- Energy level monitoring
- Performance metrics collection

### Development Setup
- Install Ollama locally
- Pull required models: `ollama pull gemma:3b`
- Start Ollama service
- Run TypeScript application
- Test HTTP endpoints
- Monitor energy regulation behavior

### Testing Scenarios
1. High energy operation with complex tasks
2. Energy depletion and recovery cycles
3. Model switching under load
4. Urgent message handling in low energy state
5. Conversation persistence and tracing

This specification provides the foundation for implementing an AI effort regulation demonstration system using local LLM inference and adaptive energy management.
