# Apps Feature - Implementation Plan

**Version:** 1.0  
**Date:** October 11, 2025  
**Status:** Proposed

## Overview

This document outlines a phased, responsible implementation plan for the apps feature. The plan prioritizes stability, backward compatibility, and comprehensive testing at each phase.

## Implementation Principles

1. **Backward Compatibility**: Existing functionality must continue to work
2. **Incremental Delivery**: Each phase delivers working, testable functionality
3. **Test-Driven**: Comprehensive tests before and after each phase
4. **No Regressions**: All existing tests must pass after each phase
5. **Documentation**: Update docs alongside code changes

## Phase 0: Pre-Implementation (Week 0)

### Goals
- Establish baseline
- Verify all existing tests pass
- Document current architecture

### Tasks

#### 0.1 Run Full Test Suite
```bash
npm test
npm run test:unit
npm run test:simple
npm run test:brainstorm
npm run test:snooze
npm run test:priorities
```

**Success Criteria**: All tests pass

#### 0.2 Document Current State
- Create architecture diagram of current system
- Document all API endpoints
- List all database tables and schemas
- Identify integration points

#### 0.3 Create Feature Branch
```bash
git checkout -b feature/apps-architecture
```

### Deliverables
- ✅ All tests passing
- ✅ Current architecture documented
- ✅ Feature branch created

## Phase 1: Foundation (Weeks 1-2)

### Goals
- Database schema for apps
- App registry infrastructure
- Energy tracking per app
- No changes to existing functionality

### Tasks

#### 1.1 Database Schema (Day 1-2)

Create migration for new tables:

```typescript
// src/migrations/001-apps-schema.ts
export function migrateAppsSchema(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS apps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      version TEXT,
      config TEXT,
      enabled BOOLEAN DEFAULT TRUE,
      installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_active_at DATETIME,
      endpoint TEXT,
      hourly_energy_budget REAL,
      daily_energy_budget REAL,
      metadata TEXT
    );
    
    CREATE TABLE IF NOT EXISTS app_energy (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      energy_consumed REAL NOT NULL,
      conversation_id TEXT,
      operation TEXT,
      FOREIGN KEY (app_id) REFERENCES apps(app_id)
    );
    
    CREATE TABLE IF NOT EXISTS app_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      app_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(request_id),
      FOREIGN KEY (app_id) REFERENCES apps(app_id)
    );
    
    -- Extend conversations table
    ALTER TABLE conversations ADD COLUMN app_id TEXT;
    ALTER TABLE conversations ADD COLUMN app_metadata TEXT;
    
    -- Indexes
    CREATE INDEX idx_apps_app_id ON apps(app_id);
    CREATE INDEX idx_apps_enabled ON apps(enabled);
    CREATE INDEX idx_app_energy_app_id ON app_energy(app_id);
    CREATE INDEX idx_app_energy_timestamp ON app_energy(timestamp);
    CREATE INDEX idx_app_energy_conversation ON app_energy(conversation_id);
    CREATE INDEX idx_app_conv_conversation ON app_conversations(conversation_id);
    CREATE INDEX idx_app_conv_app ON app_conversations(app_id);
  `);
}
```

**Tests**:
```typescript
// test/database-apps-schema.test.ts
describe('Apps Database Schema', () => {
  it('should create apps table', () => {});
  it('should create app_energy table', () => {});
  it('should create app_conversations table', () => {});
  it('should extend conversations table', () => {});
  it('should create all indexes', () => {});
});
```

#### 1.2 TypeScript Interfaces (Day 2-3)

```typescript
// src/apps/types.ts
export interface AppConfig {
  id: string;
  name: string;
  description?: string;
  type: 'in-process' | 'http' | 'mcp';
  version?: string;
  config?: Record<string, any>;
  enabled: boolean;
  endpoint?: string;
  hourlyEnergyBudget?: number;
  dailyEnergyBudget?: number;
  metadata?: Record<string, any>;
}

export interface AppEnergyMetrics {
  total: number;
  last24h: number;
  last1h: number;
  last1min: number;
}

export interface AppMessage {
  conversationId: string;
  from: string;
  to: string;
  content: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface App {
  id: string;
  name: string;
  
  install(config: AppConfig): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  uninstall(): Promise<void>;
  
  sendMessage(message: AppMessage): Promise<void>;
  receiveMessage(message: AppMessage): Promise<void>;
  
  reportEnergyConsumption(amount: number, conversationId?: string, operation?: string): void;
  getStatus(): Promise<AppStatus>;
}

export interface AppStatus {
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

#### 1.3 Energy Tracker (Day 3-4)

```typescript
// src/apps/energy-tracker.ts
export class AppEnergyTracker {
  private db: Database;
  private cache: Map<string, CircularBuffer<EnergyEvent>>;
  
  constructor(db: Database) {
    this.db = db;
    this.cache = new Map();
  }
  
  record(appId: string, amount: number, conversationId?: string, operation?: string): void {
    // Implementation
  }
  
  getMetrics(appId: string): AppEnergyMetrics {
    // Implementation
  }
  
  getMetricsForTimeRange(appId: string, start: Date, end: Date): number {
    // Implementation
  }
}
```

**Tests**:
```typescript
// test/app-energy-tracker.test.ts
describe('AppEnergyTracker', () => {
  it('should record energy consumption', () => {});
  it('should calculate total energy', () => {});
  it('should calculate 24h energy', () => {});
  it('should calculate 1h energy', () => {});
  it('should calculate 1min energy', () => {});
  it('should handle multiple apps', () => {});
  it('should persist to database', () => {});
});
```

#### 1.4 App Registry (Day 4-7)

```typescript
// src/apps/registry.ts
export class AppRegistry {
  private db: Database;
  private apps: Map<string, App>;
  private energyTracker: AppEnergyTracker;
  
  constructor(db: Database) {
    this.db = db;
    this.apps = new Map();
    this.energyTracker = new AppEnergyTracker(db);
  }
  
  async install(config: AppConfig): Promise<void> {
    // Implementation
  }
  
  async uninstall(appId: string): Promise<void> {
    // Implementation
  }
  
  async start(appId: string): Promise<void> {
    // Implementation
  }
  
  async stop(appId: string): Promise<void> {
    // Implementation
  }
  
  async routeMessage(message: AppMessage): Promise<void> {
    // Implementation
  }
  
  recordEnergy(appId: string, amount: number, conversationId?: string, operation?: string): void {
    this.energyTracker.record(appId, amount, conversationId, operation);
  }
  
  getEnergyMetrics(appId: string): AppEnergyMetrics {
    return this.energyTracker.getMetrics(appId);
  }
  
  getApp(appId: string): App | undefined {
    return this.apps.get(appId);
  }
  
  getAllApps(): App[] {
    return Array.from(this.apps.values());
  }
}
```

**Tests**:
```typescript
// test/app-registry.test.ts
describe('AppRegistry', () => {
  it('should install app', () => {});
  it('should uninstall app', () => {});
  it('should start app', () => {});
  it('should stop app', () => {});
  it('should route messages', () => {});
  it('should record energy', () => {});
  it('should get energy metrics', () => {});
  it('should list all apps', () => {});
});
```

#### 1.5 Integration with Loop (Day 7-10)

```typescript
// src/loop.ts - Add app registry
export class SensitiveLoop {
  private appRegistry: AppRegistry;
  
  constructor(debugMode: boolean = false, replenishRate: number = 1) {
    // ... existing code ...
    this.appRegistry = new AppRegistry(this.inbox.getDatabase());
  }
  
  // Expose registry for server endpoints
  getAppRegistry(): AppRegistry {
    return this.appRegistry;
  }
}
```

#### 1.6 API Endpoints (Day 10-14)

```typescript
// src/server.ts - Add app management endpoints

// List all apps
app.get('/apps', (req, res) => {
  const registry = global.sensitiveLoop?.getAppRegistry();
  if (!registry) {
    return res.status(500).json({ error: 'App registry not available' });
  }
  
  const apps = registry.getAllApps();
  const statuses = await Promise.all(apps.map(app => app.getStatus()));
  
  res.json({ apps: statuses });
});

// Get app details
app.get('/apps/:appId', async (req, res) => {
  const { appId } = req.params;
  const registry = global.sensitiveLoop?.getAppRegistry();
  
  const app = registry?.getApp(appId);
  if (!app) {
    return res.status(404).json({ error: 'App not found' });
  }
  
  const status = await app.getStatus();
  res.json(status);
});

// Get app energy metrics
app.get('/apps/:appId/energy', (req, res) => {
  const { appId } = req.params;
  const registry = global.sensitiveLoop?.getAppRegistry();
  
  const metrics = registry?.getEnergyMetrics(appId);
  if (!metrics) {
    return res.status(404).json({ error: 'App not found' });
  }
  
  res.json(metrics);
});

// Install app
app.post('/apps/install', async (req, res) => {
  const config: AppConfig = req.body;
  const registry = global.sensitiveLoop?.getAppRegistry();
  
  try {
    await registry?.install(config);
    res.json({ status: 'installed', appId: config.id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Uninstall app
app.delete('/apps/:appId', async (req, res) => {
  const { appId } = req.params;
  const registry = global.sensitiveLoop?.getAppRegistry();
  
  try {
    await registry?.uninstall(appId);
    res.json({ status: 'uninstalled' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

**Tests**:
```typescript
// test/app-api-endpoints.test.ts
describe('App API Endpoints', () => {
  it('GET /apps should list all apps', () => {});
  it('GET /apps/:appId should return app details', () => {});
  it('GET /apps/:appId/energy should return energy metrics', () => {});
  it('POST /apps/install should install app', () => {});
  it('DELETE /apps/:appId should uninstall app', () => {});
});
```

### Phase 1 Deliverables
- ✅ Database schema created and tested
- ✅ TypeScript interfaces defined
- ✅ Energy tracker implemented and tested
- ✅ App registry implemented and tested
- ✅ API endpoints implemented and tested
- ✅ All existing tests still pass

## Phase 2: Chat App (Weeks 3-4)

### Goals
- Implement in-process chat app
- Migrate existing conversation handling to chat app
- Maintain backward compatibility

### Tasks

#### 2.1 Base App Class (Day 1-2)

```typescript
// src/apps/base-app.ts
export abstract class BaseApp implements App {
  constructor(
    public id: string,
    public name: string,
    protected registry: AppRegistry
  ) {}
  
  abstract receiveMessage(message: AppMessage): Promise<void>;
  
  async sendMessage(message: AppMessage): Promise<void> {
    await this.registry.routeMessage(message);
  }
  
  reportEnergyConsumption(amount: number, conversationId?: string, operation?: string): void {
    this.registry.recordEnergy(this.id, amount, conversationId, operation);
  }
  
  async install(config: AppConfig): Promise<void> {
    // Default implementation
  }
  
  async start(): Promise<void> {
    // Default implementation
  }
  
  async stop(): Promise<void> {
    // Default implementation
  }
  
  async uninstall(): Promise<void> {
    // Default implementation
  }
  
  async getStatus(): Promise<AppStatus> {
    // Default implementation
  }
}
```

#### 2.2 Chat App Implementation (Day 2-7)

```typescript
// src/apps/chat-app.ts
export class ChatApp extends BaseApp {
  constructor(registry: AppRegistry, private inbox: Inbox) {
    super('chat', 'Chat App', registry);
  }
  
  async receiveMessage(message: AppMessage): Promise<void> {
    // Handle message from loop
    const { conversationId, content } = message;
    
    // Store response in inbox
    this.inbox.addResponse(
      conversationId,
      '', // User message already stored
      content.response,
      content.energyLevel,
      content.modelUsed
    );
    
    // Report energy consumption
    if (content.energyConsumed) {
      this.reportEnergyConsumption(content.energyConsumed, conversationId, 'generate_response');
    }
  }
  
  async handleUserMessage(messageId: string, content: string, energyBudget?: number): Promise<void> {
    // Create conversation with loop
    const message: AppMessage = {
      conversationId: messageId,
      from: this.id,
      to: 'loop',
      content: {
        userMessage: content,
        energyBudget
      },
      timestamp: new Date()
    };
    
    await this.sendMessage(message);
  }
}
```

**Tests**:
```typescript
// test/chat-app.test.ts
describe('ChatApp', () => {
  it('should handle user messages', () => {});
  it('should receive loop responses', () => {});
  it('should report energy consumption', () => {});
  it('should store conversations', () => {});
  it('should respect energy budgets', () => {});
});
```

#### 2.3 Integrate Chat App with Server (Day 7-10)

```typescript
// src/server.ts - Modify /message endpoint
app.post('/message', async (req, res) => {
  const { content, id, energyBudget } = req.body;
  
  // ... validation ...
  
  const messageId = id || uuidv4();
  
  // Get chat app from registry
  const registry = global.sensitiveLoop?.getAppRegistry();
  const chatApp = registry?.getApp('chat') as ChatApp;
  
  if (!chatApp) {
    return res.status(500).json({ error: 'Chat app not available' });
  }
  
  // Route through chat app
  await chatApp.handleUserMessage(messageId, sanitizedContent, energyBudget);
  
  res.json({
    status: 'received',
    requestId: messageId,
    timestamp: new Date().toISOString()
  });
});
```

#### 2.4 Update Loop to Handle App Messages (Day 10-14)

```typescript
// src/loop.ts - Modify conversation handling
private async unifiedCognitiveAction() {
  // Get conversations from inbox AND app registry
  const inboxConversations = this.inbox.getRecentConversations(10);
  const appConversations = this.appRegistry.getActiveConversations();
  
  // Merge and prioritize
  const allConversations = this.mergeConversations(inboxConversations, appConversations);
  
  // ... rest of logic ...
}
```

### Phase 2 Deliverables
- ✅ Base app class implemented
- ✅ Chat app implemented and tested
- ✅ Server integrated with chat app
- ✅ Loop handles app messages
- ✅ All existing tests still pass
- ✅ New chat app tests pass

## Phase 3: MCP App Protocol (Weeks 5-6)

### Goals
- Implement MCP app adapter
- Create example MCP app
- Test MCP app integration

### Tasks

#### 3.1 MCP App Base Class (Day 1-3)

```typescript
// src/apps/mcp-app.ts
export class McpApp extends BaseApp {
  private mcpClient: MCPClient;
  private llm: IntelligentModel;
  
  constructor(
    id: string,
    name: string,
    registry: AppRegistry,
    mcpServerId: string,
    llmConfig: any
  ) {
    super(id, name, registry);
    this.mcpClient = new MCPClient(mcpServerId);
    this.llm = new IntelligentModel(llmConfig);
  }
  
  async receiveMessage(message: AppMessage): Promise<void> {
    // Translate message to LLM prompt
    const prompt = this.buildPrompt(message);
    
    // Get MCP tools
    const tools = await this.mcpClient.getTools();
    
    // Generate response with tools
    const response = await this.llm.generateWithTools(prompt, tools);
    
    // Execute tool calls
    const results = await this.executeMcpTools(response.toolCalls);
    
    // Send response back to loop
    await this.sendMessage({
      conversationId: message.conversationId,
      from: this.id,
      to: 'loop',
      content: {
        response: results,
        toolCalls: response.toolCalls
      },
      timestamp: new Date()
    });
    
    // Report energy
    this.reportEnergyConsumption(response.energyConsumed, message.conversationId, 'llm_with_tools');
  }
  
  private buildPrompt(message: AppMessage): string {
    // Convert app message to LLM prompt
    return `You are a specialized assistant for ${this.name}. 
    
User request: ${JSON.stringify(message.content)}

Use the available tools to fulfill this request.`;
  }
  
  private async executeMcpTools(toolCalls: any[]): Promise<any> {
    const results = [];
    for (const call of toolCalls) {
      const result = await this.mcpClient.callTool(call.name, call.arguments);
      results.push(result);
    }
    return results;
  }
}
```

**Tests**:
```typescript
// test/mcp-app.test.ts
describe('McpApp', () => {
  it('should receive messages from loop', () => {});
  it('should translate messages to prompts', () => {});
  it('should call MCP tools', () => {});
  it('should send responses to loop', () => {});
  it('should report energy consumption', () => {});
});
```

#### 3.2 Example MCP App (Day 3-7)

```typescript
// src/apps/examples/filesystem-app.ts
export class FilesystemApp extends McpApp {
  constructor(registry: AppRegistry) {
    super(
      'filesystem',
      'Filesystem App',
      registry,
      'filesystem-mcp-server',
      {
        model: 'llama3.2:3b',
        systemPrompt: 'You are a filesystem assistant. Help users manage files and directories.'
      }
    );
  }
}
```

**Tests**:
```typescript
// test/filesystem-app.test.ts
describe('FilesystemApp', () => {
  it('should list files', () => {});
  it('should read files', () => {});
  it('should write files', () => {});
  it('should handle errors gracefully', () => {});
});
```

### Phase 3 Deliverables
- ✅ MCP app base class implemented
- ✅ Example MCP app created
- ✅ MCP app tests pass
- ✅ Integration tests with loop pass
- ✅ All existing tests still pass

## Phase 4: HTTP Apps (Weeks 7-8)

### Goals
- Implement HTTP app adapter
- Create example HTTP app
- Test out-of-process communication

### Tasks

#### 4.1 HTTP App Client (Day 1-3)

```typescript
// src/apps/http-app.ts
export class HttpApp extends BaseApp {
  private endpoint: string;
  
  constructor(
    id: string,
    name: string,
    registry: AppRegistry,
    endpoint: string
  ) {
    super(id, name, registry);
    this.endpoint = endpoint;
  }
  
  async sendMessage(message: AppMessage): Promise<void> {
    // Send to HTTP endpoint
    const response = await fetch(`${this.endpoint}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP app error: ${response.statusText}`);
    }
  }
  
  async receiveMessage(message: AppMessage): Promise<void> {
    // Received via webhook - just route to loop
    await this.registry.routeMessage(message);
  }
}
```

#### 4.2 HTTP App Server Template (Day 3-5)

```typescript
// examples/http-app-template/server.ts
import express from 'express';

const app = express();
app.use(express.json());

// Receive messages from loop
app.post('/messages', async (req, res) => {
  const message = req.body as AppMessage;
  
  // Process message
  const response = await handleMessage(message);
  
  // Send response back to loop
  await fetch('http://localhost:6740/apps/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId: message.conversationId,
      from: 'my-app',
      to: 'loop',
      content: response,
      timestamp: new Date().toISOString()
    })
  });
  
  res.json({ status: 'received' });
});

async function handleMessage(message: AppMessage): Promise<any> {
  // App-specific logic
  return { result: 'processed' };
}

app.listen(8080, () => {
  console.log('HTTP app listening on port 8080');
});
```

#### 4.3 Example HTTP App (Day 5-10)

Create a simple monitoring app as HTTP service.

**Tests**:
```typescript
// test/http-app.test.ts
describe('HttpApp', () => {
  it('should send messages to HTTP endpoint', () => {});
  it('should receive messages from HTTP app', () => {});
  it('should handle HTTP errors', () => {});
  it('should timeout on slow responses', () => {});
});
```

### Phase 4 Deliverables
- ✅ HTTP app client implemented
- ✅ HTTP app server template created
- ✅ Example HTTP app created
- ✅ HTTP app tests pass
- ✅ All existing tests still pass

## Phase 5: Testing & Documentation (Weeks 9-10)

### Goals
- Comprehensive test suite
- Updated documentation
- Performance testing
- Security review

### Tasks

#### 5.1 Comprehensive Test Suite (Day 1-5)

```typescript
// test/apps-integration.test.ts
describe('Apps Integration', () => {
  describe('Multi-app scenarios', () => {
    it('should handle conversations from multiple apps', () => {});
    it('should prioritize based on energy', () => {});
    it('should enforce energy budgets per app', () => {});
    it('should isolate app failures', () => {});
  });
  
  describe('Energy tracking', () => {
    it('should track energy per app accurately', () => {});
    it('should calculate rolling windows correctly', () => {});
    it('should persist energy data', () => {});
  });
  
  describe('App lifecycle', () => {
    it('should install app', () => {});
    it('should start app', () => {});
    it('should stop app', () => {});
    it('should uninstall app', () => {});
    it('should handle app crashes', () => {});
  });
});
```

#### 5.2 Performance Testing (Day 5-7)

```typescript
// test/apps-performance.test.ts
describe('Apps Performance', () => {
  it('should handle 10 concurrent apps', () => {});
  it('should route messages in <100ms', () => {});
  it('should track energy with <10ms overhead', () => {});
  it('should handle 100+ conversations', () => {});
});
```

#### 5.3 Update Documentation (Day 7-10)

- Update USER-GUIDE.md with apps section
- Create APPS-GUIDE.md for app developers
- Update API documentation
- Create migration guide
- Update DOCUMENTATION-INDEX.md

### Phase 5 Deliverables
- ✅ Comprehensive test suite (100+ tests)
- ✅ Performance tests pass
- ✅ Documentation updated
- ✅ Migration guide created
- ✅ All tests pass

## Testing Strategy

### Test Categories

1. **Unit Tests**: Individual components (registry, energy tracker, apps)
2. **Integration Tests**: Component interactions (loop + apps, apps + database)
3. **End-to-End Tests**: Full scenarios (user message → app → loop → response)
4. **Performance Tests**: Scalability and latency
5. **Regression Tests**: Existing functionality unchanged

### Test Coverage Goals

- Unit tests: >90% coverage
- Integration tests: All major flows
- E2E tests: All user-facing scenarios
- Performance tests: All scalability requirements
- Regression tests: All existing tests pass

### Continuous Testing

After each phase:
1. Run all existing tests
2. Run new tests for that phase
3. Fix any failures before proceeding
4. Update test documentation

## Risk Mitigation

### Risk: Breaking Existing Functionality

**Mitigation**:
- Run full test suite after each change
- Feature flags for gradual rollout
- Backward compatibility layer
- Comprehensive regression testing

### Risk: Performance Degradation

**Mitigation**:
- Performance benchmarks before/after
- Profiling of critical paths
- Database query optimization
- Caching where appropriate

### Risk: Database Migration Issues

**Mitigation**:
- Test migrations on copy of production data
- Rollback plan for each migration
- Incremental schema changes
- Database backups before migration

### Risk: App Isolation Failures

**Mitigation**:
- Process isolation for HTTP apps
- Error boundaries for in-process apps
- Resource limits enforcement
- Health monitoring

## Rollout Plan

### Development Environment

1. Implement all phases
2. Run full test suite
3. Manual testing of all scenarios
4. Performance testing

### Staging Environment

1. Deploy with feature flag disabled
2. Enable for internal testing
3. Monitor performance and errors
4. Gather feedback

### Production Environment

1. Deploy with feature flag disabled
2. Enable for beta users (10%)
3. Monitor metrics closely
4. Gradual rollout (25%, 50%, 100%)
5. Full rollout after 1 week stable

## Success Criteria

### Technical

- ✅ All existing tests pass
- ✅ 100+ new tests pass
- ✅ <100ms message routing latency
- ✅ <10ms energy tracking overhead
- ✅ Support 10+ concurrent apps
- ✅ 99.9% uptime

### Functional

- ✅ Chat app handles all existing conversations
- ✅ MCP apps integrate successfully
- ✅ HTTP apps communicate reliably
- ✅ Energy tracking accurate within 5%
- ✅ API endpoints work as specified

### Documentation

- ✅ User guide updated
- ✅ Developer guide created
- ✅ API docs complete
- ✅ Migration guide available
- ✅ Examples provided

## Timeline Summary

- **Week 0**: Pre-implementation (baseline, documentation)
- **Weeks 1-2**: Foundation (database, registry, energy tracking)
- **Weeks 3-4**: Chat app (in-process app, backward compatibility)
- **Weeks 5-6**: MCP apps (MCP integration, example app)
- **Weeks 7-8**: HTTP apps (out-of-process, example app)
- **Weeks 9-10**: Testing & documentation

**Total**: 10 weeks

## Conclusion

This implementation plan provides a structured, responsible approach to building the apps feature. By following this plan, we ensure:

- Backward compatibility maintained
- Comprehensive testing at each phase
- No regressions in existing functionality
- Clear deliverables and success criteria
- Risk mitigation strategies

The phased approach allows for course correction and ensures each component is solid before building on top of it.

---

**Status**: Ready to begin implementation  
**Next**: Execute Phase 0 - Pre-Implementation
