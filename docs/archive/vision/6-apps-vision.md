# Apps Feature - Vision Document

**Version:** 1.0  
**Date:** October 11, 2025  
**Status:** Proposed

## Executive Summary

The AI Effort Regulation system will evolve from a single-channel conversational interface into a **multi-channel app-based architecture**. This transformation enables the central sensitive loop to interact with multiple specialized applications, each competing for attention and energy allocation while maintaining the core energy regulation principles.

## Vision

### Current State

The system currently operates with a single communication channel:
- Users send messages via HTTP POST
- The sensitive loop processes conversations sequentially
- All interactions flow through a unified conversational interface
- Energy is managed globally across all conversations

### Future State

The system will become a **cognitive operating system** where:
- Multiple apps communicate with the central sensitive loop
- Each app represents a specialized domain (email, calendar, tasks, monitoring, etc.)
- Apps compete for the loop's attention through conversations
- The loop makes cross-app decisions while managing energy budgets
- Users can install, configure, and monitor apps
- Energy consumption is tracked per-app for informed prioritization

## Core Principles

### 1. **Conversation-Based Communication**

All app interactions occur through conversations:
- Apps send messages to the central loop
- The loop responds through the same conversation thread
- Messages are primarily JSON-based for structured data
- Conversations are tracked and managed by the loop

### 2. **Energy-Aware App Ecosystem**

Energy becomes a first-class concern across apps:
- Each app's energy consumption is tracked (total, 24h, 1h, 1min)
- The central loop sees energy metrics when prioritizing
- Apps compete for limited cognitive resources
- High-energy apps may be throttled or deprioritized

### 3. **Flexible App Implementation**

Apps can be implemented in multiple ways:
- **In-process apps**: Direct TypeScript/JavaScript integration (e.g., chat app)
- **Out-of-process apps**: Separate processes communicating via IPC or HTTP
- **MCP apps**: Specialized LLMs using MCP servers as their backend
- **Hybrid apps**: Combining multiple approaches

### 4. **Extensibility Through Standards**

The app protocol is designed for extensibility:
- Clear interface contracts
- JSON-based message format
- Standard lifecycle hooks (install, configure, start, stop, uninstall)
- Registry-based discovery and management

## Key Use Cases

### Use Case 1: Gmail App

**Scenario**: A specialized LLM manages Gmail through the Gmail MCP server

**Flow**:
1. Gmail app monitors inbox via MCP server
2. New email arrives → app sends conversation to central loop
3. Central loop decides priority based on energy and context
4. Loop responds with action (reply, archive, snooze, delegate)
5. Gmail app translates decision into Gmail API calls
6. App reports completion back to loop

**Benefits**:
- Email management without overwhelming the central loop
- Specialized LLM optimized for email communication
- Energy tracking shows email's cognitive cost
- Loop can deprioritize email during high-priority work

### Use Case 2: Calendar App

**Scenario**: Proactive meeting preparation and scheduling

**Flow**:
1. Calendar app monitors upcoming meetings
2. 30 minutes before meeting → app initiates conversation
3. Central loop reviews meeting context and prepares
4. Loop may request information from other apps (email, docs)
5. Calendar app provides meeting summary and action items

**Benefits**:
- Proactive cognitive preparation
- Cross-app context gathering
- Energy allocation for important meetings
- Automated meeting follow-up

### Use Case 3: Monitoring App

**Scenario**: System health and alert management

**Flow**:
1. Monitoring app watches server metrics
2. CPU spike detected → app sends alert conversation
3. Central loop evaluates urgency vs. current work
4. Loop may snooze alert or escalate based on context
5. Monitoring app tracks resolution

**Benefits**:
- Intelligent alert filtering
- Context-aware escalation
- Energy-based priority decisions
- Reduced alert fatigue

### Use Case 4: Research App

**Scenario**: Deep research with web search and document analysis

**Flow**:
1. User requests research through chat app
2. Central loop delegates to research app
3. Research app uses web search, document MCP servers
4. App conducts multi-step research process
5. App reports findings back to loop
6. Loop synthesizes and responds to user

**Benefits**:
- Specialized research capabilities
- Parallel processing of research tasks
- Energy tracking for research intensity
- Modular research tools

## Architectural Vision

### Central Sensitive Loop

The loop becomes an **orchestrator and decision-maker**:
- Receives conversations from all apps
- Prioritizes based on energy, urgency, and context
- Makes cross-app decisions
- Manages global energy budget
- Delegates specialized work to apps

### App Registry

A database-backed registry manages the app ecosystem:
- Installed apps with configuration
- App metadata (name, description, version)
- Communication endpoints (process, HTTP, MCP)
- Energy consumption history
- Enable/disable state

### App Protocol

A standardized protocol for app communication:
- **Message Format**: JSON with conversation ID, content, metadata
- **Lifecycle Events**: install, configure, start, stop, uninstall
- **Conversation Flow**: initiate, respond, close
- **Energy Reporting**: consumption events sent to loop

### MCP App Protocol

A specialized protocol for MCP-based apps:
- MCP server provides tools/resources
- App LLM translates conversations to tool calls
- Standard message format for loop communication
- Energy tracking includes LLM + tool usage

## Energy Management Vision

### Per-App Tracking

Energy consumption tracked at multiple granularities:
- **Total**: Since app installation
- **24 hours**: Rolling 24-hour window
- **1 hour**: Rolling 1-hour window  
- **1 minute**: Rolling 1-minute window

### Energy-Based Decisions

The central loop uses energy data to:
- Prioritize low-energy apps when depleted
- Throttle high-energy apps
- Allocate energy budgets per app
- Identify energy-inefficient apps

### Energy Budgets

Apps can have energy budgets:
- **Per-conversation budgets**: Limit for specific tasks
- **Hourly budgets**: Rate limiting
- **Daily budgets**: Prevent app monopolization
- **Dynamic budgets**: Adjusted based on priority

## User Experience Vision

### Installation

```bash
# Install app from registry
curl -X POST http://localhost:6740/apps/install \
  -d '{"appId": "gmail", "config": {...}}'

# Install custom app
curl -X POST http://localhost:6740/apps/install \
  -d '{"name": "My App", "endpoint": "http://localhost:8080"}'
```

### Configuration

```bash
# Configure app
curl -X PUT http://localhost:6740/apps/gmail/config \
  -d '{"credentials": {...}, "filters": {...}}'
```

### Monitoring

```bash
# View app energy consumption
curl http://localhost:6740/apps/gmail/energy

# Response:
{
  "appId": "gmail",
  "energy": {
    "total": 1250.5,
    "last24h": 45.2,
    "last1h": 8.3,
    "last1min": 0.5
  },
  "conversations": {
    "active": 3,
    "total": 127
  }
}
```

### App Management

```bash
# List installed apps
curl http://localhost:6740/apps

# Enable/disable app
curl -X PUT http://localhost:6740/apps/gmail/enabled -d '{"enabled": false}'

# Uninstall app
curl -X DELETE http://localhost:6740/apps/gmail
```

## Success Metrics

### Technical Metrics

- **App Isolation**: Apps run independently without affecting others
- **Energy Accuracy**: Per-app tracking within 5% accuracy
- **Scalability**: Support 10+ concurrent apps
- **Latency**: <100ms for app message routing
- **Reliability**: 99.9% uptime for app registry

### User Metrics

- **App Ecosystem**: 5+ apps available at launch
- **Installation Success**: 95% successful installations
- **Energy Visibility**: Users can see per-app consumption
- **Cross-App Value**: Demonstrable multi-app workflows

## Risks and Mitigations

### Risk 1: Complexity Explosion

**Risk**: App ecosystem becomes too complex to manage

**Mitigation**:
- Start with simple in-process chat app
- Gradual rollout of app types
- Clear documentation and examples
- Automated testing for each app type

### Risk 2: Energy Tracking Overhead

**Risk**: Per-app energy tracking adds significant overhead

**Mitigation**:
- Efficient time-series data structures
- Periodic aggregation instead of real-time
- Database indexing for fast queries
- Optional detailed tracking

### Risk 3: App Misbehavior

**Risk**: Buggy apps crash or consume excessive resources

**Mitigation**:
- Process isolation for out-of-process apps
- Energy budget enforcement
- Automatic app disable on repeated failures
- Health monitoring and alerts

### Risk 4: Breaking Changes

**Risk**: Apps feature breaks existing functionality

**Mitigation**:
- Comprehensive test suite before implementation
- Backward compatibility for existing API
- Gradual migration path
- Feature flags for rollout control

## Roadmap

### Phase 1: Foundation (Weeks 1-2)

- Database schema for app registry
- App interface definitions
- In-process chat app implementation
- Basic energy tracking per app

### Phase 2: MCP Integration (Weeks 3-4)

- MCP app protocol specification
- MCP app adapter implementation
- Example MCP app (filesystem or simple tool)
- Enhanced energy tracking

### Phase 3: Out-of-Process Apps (Weeks 5-6)

- HTTP/IPC communication layer
- Process management for apps
- Example out-of-process app
- App lifecycle management

### Phase 4: Ecosystem (Weeks 7-8)

- App marketplace/registry
- Multiple example apps (Gmail, Calendar, etc.)
- Documentation and tutorials
- Performance optimization

## Conclusion

The apps feature transforms the AI Effort Regulation system from a single-purpose conversational AI into a **cognitive operating system** capable of managing multiple specialized applications. By maintaining energy awareness throughout the app ecosystem, the system demonstrates how AI systems can scale their capabilities while respecting resource constraints.

This vision enables:
- **Modularity**: Specialized apps for specific domains
- **Scalability**: Add capabilities without core system changes
- **Sustainability**: Energy-aware app prioritization
- **Extensibility**: Third-party app development
- **Intelligence**: Cross-app decision making

The result is a system that can grow in capability while maintaining the core principle of energy-regulated cognitive processing.

---

**Next Steps**:
1. Review and approve this vision
2. Create detailed technical specification
3. Develop implementation plan
4. Begin Phase 1 implementation
