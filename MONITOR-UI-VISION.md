# Monitor UI - Vision Document

## Overview

The Monitor UI is a real-time web-based dashboard that provides deep visibility into the AI Effort Regulation system's "central nervous system" - the main cognitive loop that processes conversations, manages energy, and coordinates MCP tools.

## Purpose

This interface serves as both a **development tool** and a **demonstration platform**, allowing power users and developers to:

1. **Observe** the AI's cognitive processes in real-time
2. **Interact** with the system as a user through a chat interface
3. **Monitor** energy levels, model switches, and system health
4. **Debug** conversation flows and tool invocations
5. **Demonstrate** the system's adaptive behavior to stakeholders

## Core Philosophy

### Transparency First

The monitor exposes the AI's "thought process" - not just final responses, but the internal events that drive decision-making:
- Energy level fluctuations
- Model switching decisions
- Sleep/recovery cycles
- Tool invocations
- Conversation state transitions

### Non-Intrusive Observation

The monitor is a **passive observer** with **active participation capability**:
- Broadcast events flow to all connected clients
- Users can send messages and create conversations
- Monitoring doesn't affect system performance
- Multiple users can observe simultaneously

### Power User Focus

This is not a consumer-facing interface. It's designed for:
- Developers debugging the system
- Researchers studying adaptive AI behavior
- Stakeholders seeing live demonstrations
- Power users exploring system capabilities

## Key Features

### 1. Real-Time Event Stream

A live feed of system events:
- **Energy Updates**: Track energy consumption and replenishment
- **Conversation Events**: New messages, responses, state changes
- **Model Switches**: When and why the AI switches models
- **Sleep Cycles**: Recovery periods and energy restoration
- **Tool Invocations**: MCP tool calls and results
- **Reflections**: Background analysis and insights

### 2. Multi-Conversation View

Navigate between active conversations:
- **Conversation List**: All active, snoozed, and recent conversations
- **Quick Switch**: Jump between conversations instantly
- **Status Indicators**: Visual cues for conversation state
- **Energy Attribution**: See energy consumed per conversation

### 3. Live Chat Interface

Interact with the system directly:
- **Send Messages**: Create new conversations
- **Energy Budgets**: Specify effort allocation
- **Real-Time Responses**: See AI responses as they're generated
- **Message History**: Full conversation context

### 4. System Health Dashboard

Monitor overall system state:
- **Energy Gauge**: Current energy level with visual indicator
- **Active Conversations**: Count and status
- **Response Queue**: Pending work
- **Model Status**: Current model and switch history
- **Uptime & Stats**: System metrics

### 5. Conversation "Tap" Mode

Observe conversations as they unfold:
- **Live Updates**: Messages appear in real-time
- **Non-Participant View**: Watch without interfering
- **Multi-Tap**: Monitor multiple conversations simultaneously
- **Event Timeline**: See all events in chronological order

## User Experience

### Visual Design

**Modern & Minimal**
- Clean, uncluttered interface
- Dark mode optimized for extended viewing
- Syntax highlighting for technical content
- Smooth animations for state transitions

**Information Density**
- Compact but readable
- Collapsible sections
- Filterable event streams
- Responsive layout

### Interaction Patterns

**No Login Required**
- Instant access for development/demo use
- WebSocket connection on page load
- Automatic reconnection on disconnect

**Keyboard-First**
- Shortcuts for common actions
- Quick conversation switching
- Fast message composition

**Real-Time Feedback**
- Immediate visual confirmation
- Loading states for async operations
- Error messages with context

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────┐
│              React Frontend (UI)                │
│  ┌──────────┬──────────┬─────────┬───────────┐ │
│  │  Chat    │  Event   │ Convo   │  System   │ │
│  │  Panel   │  Stream  │  List   │  Health   │ │
│  └──────────┴──────────┴─────────┴───────────┘ │
└─────────────────────────────────────────────────┘
                      │ WebSocket
                      ↓
┌─────────────────────────────────────────────────┐
│         WebSocket Server (Node.js)              │
│  ┌──────────────────────────────────────────┐  │
│  │  Event Broadcaster                       │  │
│  │  - Energy updates                        │  │
│  │  - Conversation events                   │  │
│  │  - System notifications                  │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────┐
│         Sensitive Loop (Core System)            │
│  - Energy Regulator                             │
│  - Conversation Manager                         │
│  - Model Switcher                               │
│  - MCP Integration                              │
└─────────────────────────────────────────────────┘
```

### WebSocket Protocol

**Bi-Directional Communication**

Client → Server:
- `message`: Send new message to AI
- `subscribe`: Subscribe to conversation updates
- `unsubscribe`: Unsubscribe from conversation
- `get_conversations`: Request conversation list
- `get_stats`: Request system statistics

Server → Client (Broadcast):
- `energy_update`: Energy level changed
- `conversation_new`: New conversation created
- `conversation_message`: New message in conversation
- `conversation_state`: Conversation state changed
- `model_switch`: AI switched models
- `sleep_start`: System entering sleep/recovery
- `sleep_end`: System exiting sleep/recovery
- `tool_invocation`: MCP tool called
- `system_stats`: System statistics update

### Technology Stack

**Frontend**
- React 18+ with TypeScript
- TailwindCSS for styling
- shadcn/ui for components
- Lucide React for icons
- WebSocket client for real-time communication

**Backend**
- ws (WebSocket library for Node.js)
- Integrated with existing Express server
- Event emitter pattern for broadcasts

## Success Metrics

### Usability
- ✅ Can observe system behavior without reading code
- ✅ Can interact with AI through chat interface
- ✅ Can switch between conversations seamlessly
- ✅ Can understand energy regulation in real-time

### Performance
- ✅ WebSocket latency < 50ms
- ✅ UI updates at 60fps
- ✅ Handles 100+ events/second without lag
- ✅ Reconnects automatically on disconnect

### Demonstration Value
- ✅ Clearly shows adaptive behavior
- ✅ Makes energy regulation visible
- ✅ Demonstrates MCP tool integration
- ✅ Provides "wow factor" for stakeholders

## Future Enhancements

### Phase 2 (Post-MVP)
- **Event Filtering**: Filter by event type, conversation, etc.
- **Playback Mode**: Replay past events
- **Export**: Download conversation logs
- **Metrics Dashboard**: Charts and graphs for trends
- **Multi-User**: Show who's connected
- **Annotations**: Add notes to events

### Phase 3 (Advanced)
- **Performance Profiling**: Detailed timing analysis
- **A/B Testing**: Compare different configurations
- **Alerts**: Notifications for specific conditions
- **Custom Views**: User-configurable layouts

## Non-Goals

This interface is **NOT**:
- A production user interface for end users
- A replacement for the HTTP API
- A configuration management tool
- A full-featured IDE or debugger
- A multi-tenant system with authentication

## Conclusion

The Monitor UI transforms the AI Effort Regulation system from a "black box" into a transparent, observable system. By providing real-time visibility into the cognitive loop, it enables better understanding, debugging, and demonstration of adaptive AI behavior.

This is the window into the AI's "mind" - showing not just what it thinks, but how it thinks.

---

**Version**: 1.0  
**Status**: Vision Complete  
**Next Step**: Technical Specification
