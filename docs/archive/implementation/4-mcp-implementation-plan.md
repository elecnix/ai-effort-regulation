# MCP Integration Implementation Plan

## Executive Summary

This document provides a differential analysis between the current AI Effort Regulation codebase and the proposed MCP Integration Specification (3-mcp-integration-spec.md). It outlines a phased implementation strategy that builds upon existing architectural patterns while minimizing disruption to the working system.

## Current State Analysis

### Existing Architecture Strengths

The current codebase provides an excellent foundation for MCP integration:

1. **Energy-Based Regulation** (`src/energy.ts`)
   - ✅ Mature leaky bucket algorithm
   - ✅ Energy consumption tracking
   - ✅ Await/sleep mechanisms
   - ✅ Energy status reporting

2. **Sensitive Loop** (`src/loop.ts`)
   - ✅ Unified cognitive action loop
   - ✅ Tool execution framework (6 existing tools)
   - ✅ Message-based architecture
   - ✅ Non-blocking async operations
   - ✅ Thought management system

3. **Intelligent Model** (`src/intelligent-model.ts`)
   - ✅ OpenAI-compatible client integration
   - ✅ Tool calling support (OpenAI tool format)
   - ✅ Dynamic tool registration
   - ✅ Energy consumption tracking per request
   - ✅ Provider abstraction (Ollama, OpenRouter)

4. **Database Layer** (`src/inbox.ts`)
   - ✅ SQLite-based persistence
   - ✅ Conversation tracking
   - ✅ Response history
   - ✅ Energy consumption logging
   - ✅ Prepared statements for performance

5. **HTTP Server** (`src/server.ts`)
   - ✅ Express-based API
   - ✅ Message ingestion
   - ✅ Conversation retrieval
   - ✅ Stats endpoints
   - ✅ Rate limiting

### Architectural Patterns to Leverage

1. **Tool System Pattern**: The current system already has a sophisticated tool execution framework in `intelligent-model.ts` (lines 174-291) that defines tools with JSON schema parameters and routes calls appropriately. MCP tools can integrate directly into this system.

2. **Message Queue Pattern**: The system uses message queues (`messageQueue` in `server.ts`) for HTTP request handling. This same pattern can be used for sub-agent communication.

3. **Async Loop Pattern**: The `SensitiveLoop.runLoop()` method (lines 59-69) provides a non-blocking async loop that can easily integrate sub-agent polling without blocking.

4. **Energy Tracking Pattern**: The `IntelligentModel.generateResponse()` method (lines 59-100) demonstrates clear energy consumption tracking that can be extended to MCP operations.

5. **Thought Management**: The `ThoughtManager` class provides a circular buffer for thoughts that can be used for sub-agent internal reasoning.

## Gap Analysis

### What's Missing for MCP Integration

| Component | Current State | Required for MCP | Gap |
|-----------|--------------|------------------|-----|
| **MCP Client** | ❌ None | MCP SDK client, server connection management | **HIGH** - Core requirement |
| **Tool Discovery** | ✅ Hardcoded 6 tools | Dynamic tool discovery from MCP servers | **MEDIUM** - Extend existing |
| **Tool Routing** | ✅ Built-in tools only | Route to MCP servers | **MEDIUM** - Extend existing |
| **Sub-Agent** | ❌ None | Autonomous background agent | **HIGH** - New component |
| **Inter-Agent Communication** | ❌ None | Message queue for agents | **MEDIUM** - Reuse pattern |
| **MCP Configuration** | ❌ None | JSON config file, parser, validator | **LOW** - Standard Node.js |
| **Server Process Management** | ❌ None | Spawn/manage MCP server processes | **MEDIUM** - Node.js child_process |
| **Tool Analytics** | ❌ None | MCP tool usage tracking | **LOW** - Database extension |

### Compatibility Assessment

**Excellent News**: The existing architecture is **highly compatible** with MCP integration:

1. ✅ The tool system already uses OpenAI function calling format (compatible with MCP SDK)
2. ✅ The async loop architecture supports non-blocking sub-agent operations
3. ✅ The energy regulator can easily track sub-agent energy consumption
4. ✅ The database schema can be extended without breaking changes
5. ✅ The provider abstraction supports multiple backends (can add MCP)

**Challenges**:

1. ⚠️ Current tool execution is synchronous within `executeToolCall()` - MCP tools may take longer
2. ⚠️ No existing subprocess management - need to handle MCP server lifecycles
3. ⚠️ Sub-agent requires separate execution context - need careful coordination
4. ⚠️ Configuration management is currently environment-variable based, need file-based config

## Implementation Strategy

### Phased Approach

We recommend a **4-phase incremental approach** that allows testing and validation at each stage:

#### **Phase 1: MCP Client Foundation** (Week 1)
Focus: Basic MCP connectivity without sub-agent

**Goals**:
- Connect to pre-configured MCP servers
- Discover and expose MCP tools to the LLM
- Enable basic tool invocation
- Track energy consumption

**Deliverables**:
1. New file: `src/mcp-client.ts` - MCP Client Manager
2. New file: `src/mcp-config.ts` - Configuration loader
3. New file: `mcp-servers.json` - Sample configuration
4. Modified: `src/loop.ts` - Integrate MCP tool discovery
5. Modified: `src/intelligent-model.ts` - Route MCP tool calls
6. Modified: `src/inbox.ts` - Add MCP analytics tables
7. Tests: Basic MCP tool invocation

**Success Criteria**:
- ✅ System can connect to filesystem MCP server
- ✅ Tools appear in LLM tool list
- ✅ LLM can invoke MCP tool (e.g., read file)
- ✅ Energy is consumed for MCP tool calls
- ✅ System remains stable

#### **Phase 2: Sub-Agent Core** (Week 2)
Focus: Background sub-agent execution without autonomy

**Goals**:
- Implement sub-agent execution loop
- Build message-based communication
- Enable top-level agent to delegate tasks
- Track sub-agent energy consumption

**Deliverables**:
1. New file: `src/mcp-subagent.ts` - Sub-agent implementation
2. New file: `src/subagent-interface.ts` - Communication interface
3. Modified: `src/loop.ts` - Poll sub-agent, deduct energy
4. Modified: `src/intelligent-model.ts` - Add sub-agent tools
5. Tests: Sub-agent request/response cycle

**Success Criteria**:
- ✅ Sub-agent runs in background without blocking
- ✅ Top-level agent can send requests to sub-agent
- ✅ Sub-agent reports progress and completion
- ✅ Energy is deducted from main pool for sub-agent work
- ✅ Top-level agent remains responsive

#### **Phase 3: Sub-Agent Intelligence** (Week 3)
Focus: Autonomous MCP server management

**Goals**:
- Implement server addition workflow
- Add server testing capabilities
- Enable configuration modification
- Implement server search/discovery

**Deliverables**:
1. Enhanced: `src/mcp-subagent.ts` - Add server management logic
2. New file: `src/mcp-registry.ts` - Server discovery/search
3. Modified: `mcp-servers.json` - Dynamic updates
4. Tests: End-to-end server addition workflow

**Success Criteria**:
- ✅ Top-level agent requests "add weather server"
- ✅ Sub-agent searches for appropriate server
- ✅ Sub-agent adds to configuration
- ✅ Sub-agent tests server connection
- ✅ New tools become available to LLM
- ✅ Configuration persists

#### **Phase 4: Production Hardening** (Week 4)
Focus: Reliability, security, user experience

**Goals**:
- Add error handling and recovery
- Implement tool approval system
- Add monitoring and diagnostics
- Optimize performance
- Documentation and examples

**Deliverables**:
1. Enhanced: All components - Error handling
2. New file: `src/mcp-security.ts` - Tool approval system
3. Modified: `src/server.ts` - MCP management endpoints
4. Documentation: User guide, API docs
5. Examples: Sample MCP configurations
6. Tests: Comprehensive test suite

**Success Criteria**:
- ✅ System handles MCP server crashes gracefully
- ✅ Tool approval UI works (if enabled)
- ✅ Performance meets existing standards
- ✅ Documentation is complete
- ✅ All tests pass

### Detailed Phase 1 Implementation

Since Phase 1 is most critical, here's a detailed breakdown:

#### Step 1.1: Install Dependencies

```bash
npm install @modelcontextprotocol/sdk@^1.18.0
npm install --save-dev @types/node
```

Update `package.json` dependencies section.

#### Step 1.2: Create MCP Configuration System

**File: `src/mcp-config.ts`**
```typescript
import * as fs from 'fs';
import * as path from 'path';

export interface MCPServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

export interface MCPConfiguration {
  servers: MCPServerConfig[];
  subAgentEnabled: boolean;
  autoDiscoveryEnabled: boolean;
  toolApprovalRequired: boolean;
}

export class MCPConfigManager {
  private configPath: string;
  private config: MCPConfiguration | null = null;

  constructor(configPath?: string) {
    this.configPath = configPath || 
      process.env.MCP_CONFIG_PATH || 
      path.join(process.cwd(), 'mcp-servers.json');
  }

  loadConfig(): MCPConfiguration {
    // Implementation: Load and validate JSON
  }

  saveConfig(config: MCPConfiguration): void {
    // Implementation: Atomic write with validation
  }

  addServer(server: MCPServerConfig): void {
    // Implementation: Add server to config
  }

  removeServer(serverId: string): void {
    // Implementation: Remove server from config
  }
}
```

**File: `mcp-servers.json`** (root directory)
```json
{
  "servers": [
    {
      "id": "filesystem",
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./allowed-files"],
      "enabled": true
    }
  ],
  "subAgentEnabled": false,
  "autoDiscoveryEnabled": false,
  "toolApprovalRequired": false
}
```

#### Step 1.3: Implement MCP Client Manager

**File: `src/mcp-client.ts`**
```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, ChildProcess } from 'child_process';
import { MCPServerConfig } from './mcp-config';

export interface MCPTool {
  name: string;
  description: string;
  serverId: string;
  serverName: string;
  inputSchema: any;
}

export interface ServerConnection {
  config: MCPServerConfig;
  client: Client;
  transport: StdioClientTransport;
  process: ChildProcess;
  tools: MCPTool[];
  connected: boolean;
}

export class MCPClientManager {
  private connections: Map<string, ServerConnection> = new Map();

  async initialize(configs: MCPServerConfig[]): Promise<void> {
    // For each enabled server:
    //   1. Spawn process
    //   2. Create stdio transport
    //   3. Create MCP client
    //   4. Connect and initialize
    //   5. List tools
    //   6. Store connection
  }

  async discoverTools(): Promise<MCPTool[]> {
    // Aggregate tools from all connected servers
    // Prefix with server name to avoid conflicts
  }

  async invokeTool(
    toolName: string, 
    params: any
  ): Promise<{ content: any; energyConsumed: number }> {
    // 1. Parse tool name to extract server ID
    // 2. Find connection
    // 3. Send tool call request via MCP protocol
    // 4. Measure time for energy calculation
    // 5. Return result
  }

  async shutdown(): Promise<void> {
    // Gracefully close all connections
  }

  getServerStatus(): Array<{
    id: string;
    name: string;
    connected: boolean;
    toolCount: number;
  }> {
    // Return status of all servers
  }
}
```

Key implementation details:
- Use MCP SDK's `StdioClientTransport` for local servers
- Handle process lifecycle (spawn, monitor, restart on crash)
- Implement exponential backoff for reconnections
- Prefix tool names with server name: `{serverId}_{toolName}`
- Calculate energy based on invocation time (similar to LLM calls)

#### Step 1.4: Integrate into Sensitive Loop

**Modifications to `src/loop.ts`**:

1. **Add MCP Client Manager instance**:
```typescript
export class SensitiveLoop {
  private mcpClientManager: MCPClientManager; // NEW
  
  constructor(debugMode: boolean = false, replenishRate: number = 1) {
    // ... existing code ...
    this.mcpClientManager = new MCPClientManager(); // NEW
  }
}
```

2. **Initialize MCP on start**:
```typescript
async start(durationSeconds?: number) {
  // ... existing code ...
  
  // NEW: Initialize MCP client
  const mcpConfig = new MCPConfigManager().loadConfig();
  if (mcpConfig.servers.length > 0) {
    await this.mcpClientManager.initialize(
      mcpConfig.servers.filter(s => s.enabled)
    );
    console.log('✅ MCP client initialized');
  }
  
  return this.runLoop();
}
```

3. **Get MCP tools for LLM context**:
```typescript
private async unifiedCognitiveAction() {
  // ... existing code ...
  
  // NEW: Determine which tools to allow (built-in + MCP)
  const mcpTools = await this.mcpClientManager.discoverTools();
  const allAllowedTools = [...allowedTools, ...mcpTools.map(t => t.name)];
  
  const modelResponse = await this.intelligentModel.generateResponse(
    messages, 
    this.energyRegulator, 
    false, 
    allAllowedTools,
    mcpTools // NEW: Pass MCP tools for registration
  );
}
```

4. **Route MCP tool calls**:
```typescript
private async executeToolCall(toolCall: { 
  id: string; 
  type: string; 
  function: { name: string; arguments: string } 
}) {
  const { name, arguments: args } = toolCall.function;
  
  // NEW: Check if this is an MCP tool
  if (name.includes('_')) {
    const [serverId] = name.split('_');
    if (this.mcpClientManager.hasServer(serverId)) {
      const result = await this.mcpClientManager.invokeTool(name, JSON.parse(args));
      this.energyRegulator.consumeEnergy(result.energyConsumed);
      console.log(`🔧 MCP tool ${name} executed`);
      return;
    }
  }
  
  // Existing built-in tool handling...
  if (name === 'respond') {
    // ... existing code ...
  }
  // ... etc
}
```

#### Step 1.5: Extend Intelligent Model for MCP Tools

**Modifications to `src/intelligent-model.ts`**:

1. **Accept MCP tools in generateResponse**:
```typescript
async generateResponse(
  messages: Array<{ role: string; content: string }>,
  energyRegulator: EnergyRegulator,
  urgent: boolean = false,
  allowedTools: string[] = [...],
  mcpTools: MCPTool[] = [] // NEW parameter
): Promise<ModelResponse>
```

2. **Register MCP tools**:
```typescript
// In generateLLMResponse method
private async generateLLMResponse(
  messages: Array<{ role: string; content: string }>,
  model: string,
  urgent: boolean,
  allowedTools: string[],
  energyRegulator: EnergyRegulator,
  mcpTools: MCPTool[] = [] // NEW
): Promise<{ content: string; toolCalls?: Array<...> }> {
  
  // ... existing allTools definition ...
  
  // NEW: Convert MCP tools to OpenAI format
  const mcpToolDefinitions = mcpTools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: `[${tool.serverName}] ${tool.description}`,
      parameters: tool.inputSchema
    }
  }));
  
  // Combine built-in and MCP tools
  const combinedTools = [...allTools, ...mcpToolDefinitions];
  
  // Filter based on allowedTools
  const tools = combinedTools.filter(tool => 
    allowedTools.includes(tool.function.name)
  );
  
  // ... rest of existing code uses 'tools' ...
}
```

#### Step 1.6: Database Schema Extension

**Modifications to `src/inbox.ts`**:

Add new tables in `initializeDatabase()`:

```typescript
private initializeDatabase() {
  // ... existing tables ...
  
  // NEW: MCP tool invocation tracking
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS mcp_tool_invocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER,
      tool_name TEXT NOT NULL,
      server_id TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      parameters TEXT,
      result TEXT,
      energy_consumed REAL,
      success BOOLEAN,
      error TEXT,
      FOREIGN KEY (conversation_id) REFERENCES conversations (id)
    );
    
    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      config TEXT NOT NULL,
      enabled BOOLEAN DEFAULT TRUE,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used DATETIME,
      total_invocations INTEGER DEFAULT 0,
      total_failures INTEGER DEFAULT 0
    );
    
    CREATE INDEX IF NOT EXISTS idx_mcp_tool_conversation 
      ON mcp_tool_invocations (conversation_id);
    CREATE INDEX IF NOT EXISTS idx_mcp_tool_server 
      ON mcp_tool_invocations (server_id);
  `);
}
```

Add methods for logging:
```typescript
logMCPToolInvocation(
  conversationId: string | null,
  toolName: string,
  serverId: string,
  params: any,
  result: any,
  energyConsumed: number,
  success: boolean,
  error?: string
): void {
  // Insert into mcp_tool_invocations
}
```

#### Step 1.7: Testing

**Test File: `test/mcp-basic.test.ts`**
```typescript
import { MCPClientManager } from '../src/mcp-client';
import { MCPConfigManager } from '../src/mcp-config';

describe('MCP Basic Integration', () => {
  it('should load configuration', () => {
    const config = new MCPConfigManager('./test-mcp-config.json').loadConfig();
    expect(config.servers).toHaveLength(1);
  });
  
  it('should connect to filesystem server', async () => {
    const manager = new MCPClientManager();
    await manager.initialize([/* test config */]);
    const tools = await manager.discoverTools();
    expect(tools.length).toBeGreaterThan(0);
  });
  
  it('should invoke MCP tool', async () => {
    // Setup
    const manager = new MCPClientManager();
    // ... initialize with test server ...
    
    // Execute
    const result = await manager.invokeTool('filesystem_list_directory', {
      path: './test-directory'
    });
    
    // Verify
    expect(result.content).toBeDefined();
    expect(result.energyConsumed).toBeGreaterThan(0);
  });
});
```

**Manual Testing Script: `test-mcp.sh`**
```bash
#!/bin/bash

echo "Starting system with MCP..."
npm run build
node dist/src/index.js --duration 60 &
SERVER_PID=$!

sleep 5

echo "Sending test message..."
curl -X POST http://localhost:3002/message \
  -H "Content-Type: application/json" \
  -d '{"content": "List files in the current directory using the filesystem tool"}'

sleep 30

echo "Checking stats..."
curl http://localhost:3002/stats

kill $SERVER_PID
```

### Phase 2-4 Overview

#### Phase 2: Sub-Agent Core

Key files to create:
- `src/mcp-subagent.ts` - Sub-agent loop and logic
- `src/subagent-interface.ts` - Message queue and communication
- `src/subagent-types.ts` - Type definitions

Key integrations:
- Modify `loop.ts` to poll sub-agent for energy and messages
- Add sub-agent tools to `intelligent-model.ts`
- Implement request/response cycle

#### Phase 3: Sub-Agent Intelligence

Enhance `src/mcp-subagent.ts` with:
- Server search logic (web search integration)
- npm package installation
- Configuration file modification
- Server testing workflows

Create `src/mcp-registry.ts` for server discovery.

#### Phase 4: Production Hardening

Focus areas:
- Error handling everywhere
- Reconnection logic
- Server health monitoring
- Tool approval system
- Performance optimization
- Comprehensive documentation

## Risk Assessment & Mitigation

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| MCP server instability crashes system | HIGH | MEDIUM | Isolate in child process, catch all errors, restart on failure |
| Sub-agent blocks main loop | HIGH | LOW | Use async message queue, strict time limits, cancellation |
| Energy accounting errors | MEDIUM | MEDIUM | Defensive coding, NaN checks, energy bounds validation |
| Configuration corruption | MEDIUM | LOW | Atomic writes, validation, backups, version control |
| Tool invocation hangs | MEDIUM | MEDIUM | Timeouts on all MCP calls, dead letter queue |
| Memory leaks from MCP clients | MEDIUM | MEDIUM | Regular connection cycling, monitoring, limits |

### Implementation Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Scope creep into Phases 2-4 | MEDIUM | HIGH | Strict phase boundaries, incremental merges |
| Breaking existing functionality | HIGH | MEDIUM | Comprehensive test suite, feature flags |
| TypeScript type complexity | LOW | MEDIUM | Use `any` strategically, refactor incrementally |
| Merge conflicts with other agent | HIGH | HIGH | Coordinate timing, frequent communication, markdown-only initially |

## Testing Strategy

### Test Pyramid

```
         /\
        /  \     E2E Tests (5)
       /────\    - Full MCP workflow
      /      \   - Sub-agent lifecycle  
     /────────\  Integration Tests (15)
    /          \ - MCP client
   /────────────\ - Sub-agent interface
  /______________\ Unit Tests (50+)
                  - Config manager
                  - Message queue
                  - Tool routing
```

### Test Coverage Goals

- Unit tests: 80% coverage minimum
- Integration tests: All critical paths
- E2E tests: Happy path + 2-3 error scenarios

### Continuous Testing

```bash
# Run on every commit
npm run test

# Run before merge
npm run test:integration

# Run after deployment
./test/smoke-test.sh
```

## Performance Considerations

### Expected Performance Characteristics

| Metric | Target | Measurement |
|--------|--------|-------------|
| MCP tool invocation latency | < 500ms | Time from LLM decision to result |
| Sub-agent request latency | < 100ms | Time to queue request |
| Tool discovery time | < 2s | On startup |
| Energy overhead | < 5% | Extra energy for MCP management |
| Memory overhead | < 50MB | MCP client + sub-agent |

### Optimization Strategies

1. **Connection Pooling**: Reuse MCP client connections
2. **Tool Caching**: Cache tool discovery results (invalidate on server change)
3. **Lazy Initialization**: Only connect to servers when first tool is needed
4. **Batching**: Batch multiple tool calls to same server
5. **Async Everything**: Never block the main loop

## Deployment Strategy

### Development Environment

```bash
# Install MCP dependencies
npm install

# Create sample configuration
cp mcp-servers.example.json mcp-servers.json

# Install sample MCP server
npx -y @modelcontextprotocol/server-filesystem

# Start in debug mode
npm run debug
```

### Production Checklist

- [ ] All tests passing
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Configuration validated
- [ ] Error handling verified
- [ ] Energy accounting audited
- [ ] Security review complete
- [ ] Backup/restore tested

## Rollback Plan

### If Integration Fails

1. **Feature Flag**: Disable MCP via environment variable
   ```bash
   MCP_ENABLED=false npm start
   ```

2. **Code Revert**: All MCP code is additive (new files)
   - Remove imports from existing files
   - System reverts to pre-MCP behavior

3. **Configuration**: Empty `mcp-servers.json`
   ```json
   {"servers": [], "subAgentEnabled": false}
   ```

4. **Database**: MCP tables are separate, can be dropped without affecting core tables

## Success Metrics

### Phase 1 Success Criteria

- [ ] System starts with MCP configuration
- [ ] At least 1 MCP server connects successfully
- [ ] Tools are discovered and registered
- [ ] LLM can invoke MCP tool
- [ ] Tool result is returned correctly
- [ ] Energy is consumed and tracked
- [ ] Database logs tool invocation
- [ ] System remains stable for 1 hour
- [ ] No performance degradation vs baseline

### Overall Success Criteria

After all phases:
- [ ] All Phase 1 criteria met
- [ ] Sub-agent can add server autonomously
- [ ] Sub-agent energy is tracked by main loop
- [ ] Main loop remains responsive during sub-agent work
- [ ] Configuration persists correctly
- [ ] Tool approval system works (if enabled)
- [ ] Error handling is robust
- [ ] Documentation is complete
- [ ] All tests pass
- [ ] Performance targets met

## Timeline

### Estimated Duration

- **Phase 1**: 5-7 days (MCP Client Foundation)
- **Phase 2**: 5-7 days (Sub-Agent Core)
- **Phase 3**: 5-7 days (Sub-Agent Intelligence)
- **Phase 4**: 5-7 days (Production Hardening)

**Total**: 3-4 weeks for full implementation

### Critical Path

1. MCP SDK integration → Tool discovery → Tool invocation
2. Sub-agent loop → Message queue → Energy tracking
3. Server management → Configuration → Testing
4. Error handling → Security → Documentation

## Coordination with Other Agent

### Recommended Collaboration Protocol

Since another agent is working simultaneously:

1. **Phase 1 Development**:
   - Create all new files in isolation
   - Minimize changes to existing files
   - Use feature branches
   - Coordinate merge timing

2. **Integration Points** (requires coordination):
   - `src/loop.ts` - Lines to add: ~50
   - `src/intelligent-model.ts` - Lines to add: ~100
   - `src/inbox.ts` - Lines to add: ~50
   - `package.json` - Add dependencies

3. **Safe Modifications**:
   - All new `.ts` files in `src/`
   - New test files
   - Configuration files (`.json`)
   - Documentation (`.md`)

4. **Communication**:
   - Announce when starting work on shared file
   - Use comments to mark MCP-related code
   - Create PR for review before merging
   - Test in isolated branch first

## Open Questions for User

Before implementation begins, please clarify:

1. **MCP Server Priorities**: Which MCP servers are most important for your use case?
   - Filesystem access?
   - Web search/browsing?
   - Database access?
   - GitHub/Git operations?
   - Custom business logic?

2. **Sub-Agent Autonomy**: How autonomous should the sub-agent be?
   - Fully autonomous (can install packages, modify config)?
   - Semi-autonomous (requires approval for installations)?
   - Supervised (requires approval for all actions)?

3. **Security Posture**: What's the security model?
   - Development/testing (trust all tools)?
   - Production (strict approval required)?
   - Hybrid (whitelist approach)?

4. **Performance vs. Capability**: What's more important?
   - Fast, responsive system (fewer MCP servers)?
   - Maximum capabilities (many MCP servers, higher overhead)?
   - Balanced approach?

5. **Implementation Timeline**: What's the urgency?
   - Full 4-phase approach over 3-4 weeks?
   - Fast-track Phase 1 only (1 week)?
   - Focus on specific use case?

## Conclusion

The existing AI Effort Regulation codebase provides an excellent foundation for MCP integration. The proposed phased approach builds incrementally on existing patterns while introducing powerful new capabilities. Phase 1 alone delivers significant value (dynamic tool usage) with minimal risk, while subsequent phases unlock advanced features like autonomous tool management.

The architecture is designed to be:
- ✅ **Non-disruptive**: New functionality doesn't break existing features
- ✅ **Incremental**: Each phase delivers value independently
- ✅ **Testable**: Clear success criteria at each stage
- ✅ **Maintainable**: Clean separation of concerns
- ✅ **Energy-Aware**: Consistent with existing design philosophy

The implementation can begin immediately with Phase 1, focusing on markdown documentation and new TypeScript files to avoid conflicts with the other agent working in the codebase.
