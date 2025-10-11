# Apps Feature - Technical Specification

**Version:** 1.0  
**Date:** October 11, 2025  
**Status:** Proposed

## Overview

This specification defines the technical architecture for transforming the AI Effort Regulation system into a multi-channel app-based platform. Apps communicate with the central sensitive loop through conversations, enabling modular, specialized functionality while maintaining energy-aware operation.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    HTTP Server (Express)                     │
│  /message, /apps/*, /conversations/*, /stats, /health       │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────────┐
│              Central Sensitive Loop                          │
│  - Conversation prioritization                              │
│  - Energy management                                         │
│  - Cross-app decision making                                │
│  - App message routing                                       │
└─────┬──────────────┬──────────────┬────────────────────────┘
      │              │              │
┌─────┴─────┐  ┌────┴─────┐  ┌────┴──────┐
│ Chat App  │  │ MCP App  │  │ HTTP App  │  ... (more apps)
│(in-proc)  │  │(in-proc) │  │(out-proc) │
└───────────┘  └──────────┘  └───────────┘
      │              │              │
      │         ┌────┴────┐         │
      │         │MCP Srv  │         │
      │         └─────────┘         │
      │                             │
┌─────┴─────────────────────────────┴─────────────────────────┐
│                    App Registry (SQLite)                     │
│  - Installed apps                                            │
│  - App configurations                                        │
│  - Energy consumption tracking                               │
│  - Conversation-app associations                             │
└──────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### Central Sensitive Loop
- Routes messages between apps and conversations
- Manages global energy budget
- Prioritizes conversations across all apps
- Tracks per-app energy consumption
- Enforces app energy budgets

#### App Registry
- Stores app metadata and configuration
- Tracks app lifecycle state
- Records energy consumption metrics
- Manages app-conversation associations

#### Apps
- Implement specialized functionality
- Communicate via conversation protocol
- Report energy consumption
- Handle lifecycle events

## Data Model

### Database Schema

#### apps table
```sql
CREATE TABLE apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- 'in-process', 'http', 'mcp'
  version TEXT,
  config TEXT, -- JSON configuration
  enabled BOOLEAN DEFAULT TRUE,
  installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_active_at DATETIME,
  
  -- Connection details (type-specific)
  endpoint TEXT, -- HTTP URL or process command
  
  -- Energy budgets
  hourly_energy_budget REAL,
  daily_energy_budget REAL,
  
  -- Metadata
  metadata TEXT -- JSON for extensibility
);

CREATE INDEX idx_apps_app_id ON apps(app_id);
CREATE INDEX idx_apps_enabled ON apps(enabled);
```

#### app_energy table
```sql
CREATE TABLE app_energy (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  energy_consumed REAL NOT NULL,
  conversation_id TEXT, -- Optional: link to specific conversation
  operation TEXT, -- Optional: what operation consumed energy
  
  FOREIGN KEY (app_id) REFERENCES apps(app_id)
);

CREATE INDEX idx_app_energy_app_id ON app_energy(app_id);
CREATE INDEX idx_app_energy_timestamp ON app_energy(timestamp);
CREATE INDEX idx_app_energy_conversation ON app_energy(conversation_id);
```

#### app_conversations table
```sql
CREATE TABLE app_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (conversation_id) REFERENCES conversations(request_id),
  FOREIGN KEY (app_id) REFERENCES apps(app_id)
);

CREATE INDEX idx_app_conv_conversation ON app_conversations(conversation_id);
CREATE INDEX idx_app_conv_app ON app_conversations(app_id);
```

#### Extend conversations table
```sql
ALTER TABLE conversations ADD COLUMN app_id TEXT;
ALTER TABLE conversations ADD COLUMN app_metadata TEXT; -- JSON
```

### TypeScript Interfaces

```typescript
interface AppConfig {
  id: string;
  name: string;
  description?: string;
  type: 'in-process' | 'http' | 'mcp';
  version?: string;
  config?: Record<string, any>;
  enabled: boolean;
  endpoint?: string; // For HTTP or process apps
  hourlyEnergyBudget?: number;
  dailyEnergyBudget?: number;
  metadata?: Record<string, any>;
}

interface AppEnergyMetrics {
  total: number;
  last24h: number;
  last1h: number;
  last1min: number;
}

interface AppMessage {
  conversationId: string;
  from: string; // app_id or 'loop'
  to: string; // app_id or 'loop'
  content: any; // JSON payload
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface AppLifecycle {
  install(config: AppConfig): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  uninstall(): Promise<void>;
  configure(config: Record<string, any>): Promise<void>;
}

interface App extends AppLifecycle {
  id: string;
  name: string;
  
  // Message handling
  sendMessage(message: AppMessage): Promise<void>;
  receiveMessage(message: AppMessage): Promise<void>;
  
  // Energy reporting
  reportEnergyConsumption(amount: number, conversationId?: string, operation?: string): void;
  
  // Status
  getStatus(): Promise<AppStatus>;
}

interface AppStatus {
  id: string;
  name: string;
  enabled: boolean;
  running: boolean;
  energy: AppEnergyMetrics;
  conversations: {
    active: number;
    total: number;
  };
  lastActive?: Date;
  health: 'healthy' | 'degraded' | 'unhealthy';
}
```

## App Protocol

### Message Format

All app-loop communication uses a standard message format:

```typescript
interface AppProtocolMessage {
  version: '1.0';
  messageId: string; // UUID
  conversationId: string; // Links to conversation
  from: string; // Sender app_id or 'loop'
  to: string; // Recipient app_id or 'loop'
  type: 'request' | 'response' | 'notification' | 'error';
  timestamp: string; // ISO 8601
  payload: {
    action?: string; // For requests
    data?: any; // Message content
    error?: {
      code: string;
      message: string;
      details?: any;
    };
  };
  metadata?: {
    energyCost?: number; // Estimated or actual
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    timeout?: number; // Milliseconds
    [key: string]: any;
  };
}
```

### Conversation Flow

#### App-Initiated Conversation

```typescript
// 1. App creates conversation
const message: AppProtocolMessage = {
  version: '1.0',
  messageId: uuidv4(),
  conversationId: uuidv4(), // New conversation
  from: 'gmail-app',
  to: 'loop',
  type: 'request',
  timestamp: new Date().toISOString(),
  payload: {
    action: 'new_email',
    data: {
      from: 'user@example.com',
      subject: 'Important: Review needed',
      preview: '...'
    }
  },
  metadata: {
    priority: 'high'
  }
};

// 2. Loop processes and responds
const response: AppProtocolMessage = {
  version: '1.0',
  messageId: uuidv4(),
  conversationId: message.conversationId,
  from: 'loop',
  to: 'gmail-app',
  type: 'response',
  timestamp: new Date().toISOString(),
  payload: {
    data: {
      action: 'reply',
      content: 'Thank you for the email...'
    }
  }
};

// 3. App executes action and confirms
const confirmation: AppProtocolMessage = {
  version: '1.0',
  messageId: uuidv4(),
  conversationId: message.conversationId,
  from: 'gmail-app',
  to: 'loop',
  type: 'notification',
  timestamp: new Date().toISOString(),
  payload: {
    data: {
      status: 'completed',
      result: 'Email sent successfully'
    }
  },
  metadata: {
    energyCost: 5.2
  }
};
```

#### Loop-Initiated Conversation

```typescript
// 1. Loop initiates (e.g., scheduled task)
const message: AppProtocolMessage = {
  version: '1.0',
  messageId: uuidv4(),
  conversationId: uuidv4(),
  from: 'loop',
  to: 'calendar-app',
  type: 'request',
  timestamp: new Date().toISOString(),
  payload: {
    action: 'get_upcoming_meetings',
    data: {
      timeRange: '1h'
    }
  }
};

// 2. App responds
const response: AppProtocolMessage = {
  version: '1.0',
  messageId: uuidv4(),
  conversationId: message.conversationId,
  from: 'calendar-app',
  to: 'loop',
  type: 'response',
  timestamp: new Date().toISOString(),
  payload: {
    data: {
      meetings: [...]
    }
  },
  metadata: {
    energyCost: 2.1
  }
};
```

### Energy Reporting

Apps report energy consumption through the protocol:

```typescript
interface EnergyReport {
  appId: string;
  amount: number;
  conversationId?: string;
  operation?: string;
  timestamp: Date;
}

// Apps send energy reports
app.reportEnergyConsumption(5.2, conversationId, 'send_email');

// Registry tracks and aggregates
registry.recordEnergyConsumption({
  appId: 'gmail-app',
  amount: 5.2,
  conversationId: 'abc-123',
  operation: 'send_email',
  timestamp: new Date()
});
```

## App Types

### In-Process Apps

Apps running in the same Node.js process as the sensitive loop.

```typescript
class InProcessApp implements App {
  constructor(
    public id: string,
    public name: string,
    private registry: AppRegistry
  ) {}
  
  async sendMessage(message: AppMessage): Promise<void> {
    // Direct method call to loop
    await this.registry.routeMessage(message);
  }
  
  async receiveMessage(message: AppMessage): Promise<void> {
    // Handle message in-process
    await this.handleMessage(message);
  }
  
  reportEnergyConsumption(amount: number, conversationId?: string): void {
    this.registry.recordEnergy(this.id, amount, conversationId);
  }
}
```

**Advantages**: Low latency, shared memory, simple debugging  
**Disadvantages**: No isolation, can crash main process

### HTTP Apps

Apps running as separate HTTP services.

```typescript
class HttpApp implements App {
  constructor(
    public id: string,
    public name: string,
    private endpoint: string,
    private registry: AppRegistry
  ) {}
  
  async sendMessage(message: AppMessage): Promise<void> {
    // HTTP POST to app endpoint
    await fetch(`${this.endpoint}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
  }
  
  async receiveMessage(message: AppMessage): Promise<void> {
    // Received via webhook from app
    await this.handleMessage(message);
  }
}
```

**Advantages**: Process isolation, language-agnostic, scalable  
**Disadvantages**: Network latency, more complex deployment

### MCP Apps

Apps implemented as LLMs using MCP servers.

```typescript
class McpApp implements App {
  constructor(
    public id: string,
    public name: string,
    private mcpServerId: string,
    private llmConfig: LLMConfig,
    private registry: AppRegistry
  ) {}
  
  async receiveMessage(message: AppMessage): Promise<void> {
    // Translate message to LLM prompt
    const prompt = this.messageToPrompt(message);
    
    // Get MCP tools for this server
    const tools = await this.getMcpTools();
    
    // Run LLM with tools
    const response = await this.llm.generate(prompt, tools);
    
    // Execute tool calls
    const results = await this.executeMcpTools(response.toolCalls);
    
    // Send response back to loop
    await this.sendMessage({
      conversationId: message.conversationId,
      from: this.id,
      to: 'loop',
      content: results
    });
  }
}
```

**Advantages**: Specialized LLM per domain, MCP tool integration  
**Disadvantages**: Higher energy cost, LLM unpredictability

## App Registry Implementation

### Core Registry Class

```typescript
class AppRegistry {
  private db: Database;
  private apps: Map<string, App> = new Map();
  private energyTracker: EnergyTracker;
  
  async install(config: AppConfig): Promise<void> {
    // Validate config
    this.validateConfig(config);
    
    // Store in database
    await this.db.insertApp(config);
    
    // Create app instance
    const app = await this.createApp(config);
    
    // Initialize app
    await app.install(config);
    
    // Register
    this.apps.set(config.id, app);
  }
  
  async start(appId: string): Promise<void> {
    const app = this.apps.get(appId);
    if (!app) throw new Error(`App ${appId} not found`);
    
    await app.start();
    await this.db.updateAppStatus(appId, { running: true });
  }
  
  async routeMessage(message: AppMessage): Promise<void> {
    const targetApp = this.apps.get(message.to);
    if (!targetApp) {
      throw new Error(`Target app ${message.to} not found`);
    }
    
    // Track conversation-app association
    await this.db.associateConversation(message.conversationId, message.to);
    
    // Deliver message
    await targetApp.receiveMessage(message);
  }
  
  recordEnergy(appId: string, amount: number, conversationId?: string): void {
    this.energyTracker.record(appId, amount, conversationId);
  }
  
  getEnergyMetrics(appId: string): AppEnergyMetrics {
    return this.energyTracker.getMetrics(appId);
  }
}
```

### Energy Tracker

```typescript
class EnergyTracker {
  private db: Database;
  private cache: Map<string, CircularBuffer<EnergyEvent>> = new Map();
  
  record(appId: string, amount: number, conversationId?: string): void {
    const event: EnergyEvent = {
      timestamp: Date.now(),
      amount,
      conversationId
    };
    
    // Add to in-memory cache
    if (!this.cache.has(appId)) {
      this.cache.set(appId, new CircularBuffer(1000));
    }
    this.cache.get(appId)!.push(event);
    
    // Persist to database (async, non-blocking)
    this.db.insertEnergyEvent(appId, event).catch(console.error);
  }
  
  getMetrics(appId: string): AppEnergyMetrics {
    const events = this.cache.get(appId);
    if (!events) return { total: 0, last24h: 0, last1h: 0, last1min: 0 };
    
    const now = Date.now();
    const oneMin = now - 60 * 1000;
    const oneHour = now - 60 * 60 * 1000;
    const oneDay = now - 24 * 60 * 60 * 1000;
    
    let total = 0;
    let last24h = 0;
    let last1h = 0;
    let last1min = 0;
    
    for (const event of events.items()) {
      total += event.amount;
      if (event.timestamp > oneDay) last24h += event.amount;
      if (event.timestamp > oneHour) last1h += event.amount;
      if (event.timestamp > oneMin) last1min += event.amount;
    }
    
    return { total, last24h, last1h, last1min };
  }
}
```

## Integration with Sensitive Loop

### Modified Loop Architecture

```typescript
class SensitiveLoop {
  private appRegistry: AppRegistry;
  
  async unifiedCognitiveAction() {
    // Get conversations from all apps
    const conversations = await this.getAllConversations();
    
    // Prioritize based on:
    // - Energy budgets
    // - App priority
    // - Conversation urgency
    // - Current energy level
    const prioritized = this.prioritizeConversations(conversations);
    
    // Process highest priority conversation
    const target = prioritized[0];
    
    // Determine source app
    const appId = await this.inbox.getConversationApp(target.id);
    
    // Generate response
    const response = await this.generateResponse(target);
    
    // Route response to app
    if (appId) {
      await this.appRegistry.routeMessage({
        conversationId: target.id,
        from: 'loop',
        to: appId,
        content: response
      });
    } else {
      // Legacy conversation (no app)
      await this.respondToRequest(target.id, response);
    }
  }
  
  private getAllConversations(): Conversation[] {
    // Combine:
    // 1. Legacy inbox conversations
    // 2. App-initiated conversations
    const legacy = this.inbox.getRecentConversations();
    const appConvs = this.appRegistry.getActiveConversations();
    
    return [...legacy, ...appConvs];
  }
  
  private prioritizeConversations(conversations: Conversation[]): Conversation[] {
    return conversations.sort((a, b) => {
      // Priority factors:
      // 1. Urgency (explicit priority)
      // 2. Energy budget remaining
      // 3. App energy consumption (prefer low-energy apps when depleted)
      // 4. Age (older first)
      
      const aApp = this.appRegistry.getApp(a.appId);
      const bApp = this.appRegistry.getApp(b.appId);
      
      const aEnergy = aApp ? this.appRegistry.getEnergyMetrics(aApp.id) : null;
      const bEnergy = bApp ? this.appRegistry.getEnergyMetrics(bApp.id) : null;
      
      // Implement prioritization logic
      // ...
    });
  }
}
```

## API Endpoints

### App Management

```typescript
// Install app
POST /apps/install
Body: { appId, name, type, config, endpoint?, ... }
Response: { appId, status: 'installed' }

// List apps
GET /apps
Response: { apps: AppStatus[] }

// Get app details
GET /apps/:appId
Response: AppStatus

// Update app config
PUT /apps/:appId/config
Body: { config: {...} }
Response: { status: 'updated' }

// Enable/disable app
PUT /apps/:appId/enabled
Body: { enabled: boolean }
Response: { status: 'updated' }

// Uninstall app
DELETE /apps/:appId
Response: { status: 'uninstalled' }

// Get app energy metrics
GET /apps/:appId/energy
Response: AppEnergyMetrics

// Get app conversations
GET /apps/:appId/conversations
Response: { conversations: Conversation[] }
```

### App Communication (for HTTP apps)

```typescript
// Webhook endpoint for apps to send messages
POST /apps/messages
Body: AppProtocolMessage
Response: { messageId, status: 'received' }

// Endpoint for apps to report energy
POST /apps/:appId/energy
Body: { amount, conversationId?, operation? }
Response: { status: 'recorded' }
```

## Security Considerations

### App Isolation

- Out-of-process apps run in separate processes
- Resource limits (CPU, memory) enforced
- Network access controlled per app
- File system access restricted

### Authentication

- App-to-loop communication authenticated via API keys
- HTTP apps use bearer tokens
- MCP apps use MCP authentication

### Authorization

- Apps can only access their own conversations
- Apps cannot directly access other apps' data
- Loop mediates all cross-app communication

### Rate Limiting

- Per-app message rate limits
- Energy budget enforcement
- Automatic throttling of high-energy apps

## Performance Considerations

### Message Routing

- In-memory message queue for low latency
- Async processing for HTTP apps
- Connection pooling for HTTP apps

### Energy Tracking

- In-memory circular buffers for recent data
- Periodic database writes (batch)
- Indexed queries for fast aggregation

### Database

- Prepared statements for frequent queries
- Indexes on app_id, conversation_id, timestamp
- Periodic cleanup of old energy events

### Scalability

- Support for 10+ concurrent apps
- 100+ conversations across apps
- <100ms message routing latency
- <10ms energy tracking overhead

## Testing Strategy

### Unit Tests

- App registry operations
- Energy tracking accuracy
- Message routing
- Database operations

### Integration Tests

- In-process app lifecycle
- HTTP app communication
- MCP app integration
- Cross-app conversations

### End-to-End Tests

- Multi-app scenarios
- Energy budget enforcement
- App prioritization
- Failure recovery

### Performance Tests

- Message throughput
- Energy tracking overhead
- Database query performance
- Concurrent app handling

## Migration Path

### Backward Compatibility

- Existing `/message` endpoint continues to work
- Legacy conversations handled by implicit "chat" app
- Gradual migration of features to apps

### Migration Steps

1. Deploy app infrastructure (registry, energy tracking)
2. Create chat app wrapping existing functionality
3. Route new conversations through chat app
4. Migrate existing conversations to chat app
5. Add new app types (MCP, HTTP)
6. Deprecate legacy endpoints (optional)

## Conclusion

This specification provides a comprehensive technical foundation for the apps feature, enabling modular, energy-aware application development while maintaining backward compatibility with the existing system.

---

**Status**: Ready for implementation  
**Next**: Implementation plan and phased rollout
