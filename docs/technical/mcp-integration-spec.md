# MCP (Model Context Protocol) Integration Specification

## Overview

This specification extends the AI Effort Regulation system to support Model Context Protocol (MCP), enabling the top-level sensitive agent to dynamically discover, manage, and utilize external tools through MCP servers. The system introduces a specialized sub-agent architecture for autonomous MCP server management while preserving the energy-based effort regulation framework.

## Goals

1. **Dynamic Tool Discovery**: Enable the top-level agent to access and invoke MCP tools from configured servers
2. **Autonomous Tool Management**: Implement a sub-agent that can configure, test, and manage MCP servers independently
3. **Energy-Aware Integration**: Ensure MCP operations (both tool calls and sub-agent work) consume energy appropriately
4. **Non-Blocking Architecture**: Keep the top-level sensitive loop responsive while the MCP sub-agent works in the background
5. **User Configuration**: Allow users to specify initial MCP servers and authorize tool usage

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────┐
│              Sensitive Loop (Top-Level Agent)            │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Energy Regulator                                   │ │
│  │  Conversation Manager                               │ │
│  │  MCP Tool Orchestrator ← NEW                        │ │
│  │  Sub-Agent Communication Interface ← NEW            │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                           ↓
            ┌──────────────┴──────────────┐
            ↓                              ↓
┌─────────────────────────┐    ┌──────────────────────────┐
│  MCP Client Manager     │    │  MCP Sub-Agent           │
│  - Server connections   │    │  - Server discovery      │
│  - Tool discovery       │    │  - Configuration mgmt    │
│  - Tool invocation      │    │  - Server testing        │
│  - Session management   │    │  - Background operation  │
└─────────────────────────┘    │  - Energy consumption    │
            ↓                   │  - Message queue         │
   ┌────────────────┐          └──────────────────────────┘
   │  MCP Servers   │
   │  (External)    │
   └────────────────┘
```

## Core Components

### 1. MCP Client Manager

**Purpose**: Manages connections to MCP servers and provides tool invocation capabilities to the top-level agent.

**Responsibilities**:
- Initialize and maintain connections to configured MCP servers
- Discover available tools from connected servers
- Invoke tools on behalf of the top-level agent
- Handle tool responses and errors
- Track energy consumption for tool invocations
- Manage server lifecycle (connect, disconnect, reconnect)

**Key Operations**:
- `initialize(serverConfigs: MCPServerConfig[]): Promise<void>` - Connect to initial servers
- `discoverTools(): Promise<MCPTool[]>` - Get all available tools from all servers
- `invokeTool(toolName: string, params: any): Promise<any>` - Execute a tool
- `addServer(config: MCPServerConfig): Promise<void>` - Add a new server dynamically
- `removeServer(serverId: string): Promise<void>` - Remove a server
- `getServerStatus(): ServerStatus[]` - Get health status of all servers

**Data Structures**:
```typescript
interface MCPServerConfig {
  id: string;
  name: string;
  command: string;      // e.g., "node"
  args: string[];       // e.g., ["path/to/server.js"]
  env?: Record<string, string>;
  enabled: boolean;
}

interface MCPTool {
  name: string;
  description: string;
  serverId: string;
  serverName: string;
  parameters: JSONSchema;
  estimatedEnergyCost?: number;
}

interface ServerStatus {
  id: string;
  name: string;
  connected: boolean;
  toolCount: number;
  lastPing: Date;
  errors: string[];
}
```

### 2. MCP Sub-Agent

**Purpose**: Autonomous agent responsible for managing MCP server configurations without blocking the main sensitive loop.

**Responsibilities**:
- Receive requests from top-level agent to modify MCP servers
- Search for and discover new MCP servers
- Install, configure, and test MCP servers
- Modify existing server configurations
- Report progress and status back to top-level agent
- Consume energy during operations (tracked by top-level regulator)

**Communication Model**:
- **Asynchronous**: Sub-agent runs in a separate execution context
- **Message-Based**: Top-level agent sends requests via message queue
- **Status Updates**: Sub-agent sends progress notifications
- **Completion Notification**: Reports when work is complete

**Key Operations**:
- `start(): void` - Start the sub-agent background loop
- `stop(): void` - Gracefully stop the sub-agent
- `queueRequest(request: SubAgentRequest): string` - Add work to queue, returns request ID
- `getStatus(requestId: string): SubAgentStatus` - Check request status
- `cancelRequest(requestId: string): void` - Cancel pending work

**Data Structures**:
```typescript
interface SubAgentRequest {
  id: string;
  type: 'add_server' | 'remove_server' | 'test_server' | 'search_servers' | 'modify_server';
  params: any;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high';
}

interface SubAgentStatus {
  requestId: string;
  state: 'queued' | 'in_progress' | 'completed' | 'failed';
  progress: number;  // 0-100
  message: string;
  energyConsumed: number;
  result?: any;
  error?: string;
}

interface SubAgentMessage {
  type: 'status_update' | 'completion' | 'error' | 'tool_available';
  requestId: string;
  data: any;
}
```

**Energy Consumption**:
- The sub-agent does NOT have direct access to the energy regulator
- Instead, it tracks its own energy consumption internally
- The top-level agent periodically polls sub-agent energy consumption and deducts from main energy pool
- This creates a "background drain" that the sensitive loop must manage

### 3. Sub-Agent Communication Interface

**Purpose**: Bridge between the sensitive loop and the MCP sub-agent for bidirectional communication.

**Responsibilities**:
- Queue outbound requests from top-level agent to sub-agent
- Deliver inbound status updates from sub-agent to top-level agent
- Provide non-blocking API for the sensitive loop
- Track pending requests and their status

**Key Operations**:
- `sendRequest(request: SubAgentRequest): Promise<string>` - Queue a request, returns request ID
- `pollMessages(): SubAgentMessage[]` - Get pending messages from sub-agent
- `getSubAgentEnergyConsumption(): number` - Get energy consumed since last poll
- `hasActiveWork(): boolean` - Check if sub-agent is working

### 4. MCP Tool Orchestrator

**Purpose**: Integrates MCP tools into the existing intelligent model's tool system.

**Responsibilities**:
- Present MCP tools to the LLM alongside existing tools
- Route tool calls to either built-in tools or MCP tools
- Track energy consumption for MCP tool invocations
- Handle MCP tool errors gracefully
- Provide tool usage analytics

**Integration with Existing Tools**:
The current system has these built-in tools:
- `respond` - Send response to conversation
- `await_energy` - Wait for energy level
- `select_conversation` - Focus on a conversation
- `think` - Record internal thoughts
- `end_conversation` - End a conversation
- `snooze_conversation` - Snooze a conversation

MCP tools will be added dynamically:
- Tool names prefixed with server name: `{server_name}_{tool_name}`
- Tool descriptions enhanced with server context
- Energy cost estimated based on tool complexity

## Configuration

### User-Provided MCP Server Configuration

Users specify initial MCP servers in a configuration file: `mcp-servers.json`

```json
{
  "servers": [
    {
      "id": "filesystem",
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/directory"],
      "enabled": true
    },
    {
      "id": "github",
      "name": "github",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      },
      "enabled": true
    },
    {
      "id": "web-search",
      "name": "brave-search",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "${BRAVE_API_KEY}"
      },
      "enabled": false
    }
  ],
  "subAgentEnabled": true,
  "autoDiscoveryEnabled": false,
  "toolApprovalRequired": true
}
```

Configuration can also be provided via environment variables:
- `MCP_CONFIG_PATH` - Path to configuration file (default: `./mcp-servers.json`)
- `MCP_AUTO_DISCOVERY` - Enable auto-discovery (default: false)
- `MCP_TOOL_APPROVAL` - Require user approval for tool calls (default: true)

## Protocol Integration

### MCP Client Implementation

The system uses the official TypeScript MCP SDK:
```bash
npm install @modelcontextprotocol/sdk
```

**Connection Methods**:
- **STDIO**: Primary method for local MCP servers (spawns process)
- **HTTP**: For remote MCP servers (future enhancement)

**Connection Lifecycle**:
1. Parse server configuration
2. Spawn server process with stdio transport
3. Initialize MCP session (handshake)
4. Discover available tools
5. Monitor server health (ping)
6. Handle disconnections and reconnections

### Tool Discovery Flow

```
1. SensitiveLoop starts
2. MCP Client Manager initializes
3. For each enabled server in config:
   a. Spawn server process
   b. Establish stdio connection
   c. Send initialize request
   d. Receive tool list
   e. Register tools with orchestrator
4. Top-level agent receives augmented tool list
5. Tools available for LLM to use
```

### Tool Invocation Flow

```
1. LLM decides to use MCP tool (e.g., "filesystem_read_file")
2. Tool orchestrator routes call to MCP Client Manager
3. MCP Client Manager:
   a. Identifies target server
   b. Sends tool invocation request via MCP protocol
   c. Awaits response
   d. Tracks energy consumption (time-based)
4. Response returned to LLM
5. Energy deducted from regulator
6. Continue conversation
```

## Sub-Agent Operation

### Sub-Agent Execution Model

The sub-agent runs in a **separate async loop** independent of the sensitive loop:

```typescript
// Pseudo-code
async function subAgentLoop() {
  while (subAgentRunning) {
    // Check for new requests
    const request = await requestQueue.dequeue();
    
    if (request) {
      // Process request
      const energyStart = performance.now();
      const result = await processRequest(request);
      const energyConsumed = (performance.now() - energyStart) / 1000 * 2;
      
      // Track energy internally
      subAgentEnergyConsumed += energyConsumed;
      
      // Send completion message
      messageQueue.enqueue({
        type: 'completion',
        requestId: request.id,
        data: result
      });
    }
    
    // Small sleep to avoid CPU spinning
    await sleep(100);
  }
}
```

### Energy Accounting

**Energy Flow**:
1. Sub-agent performs work (e.g., testing a new MCP server)
2. Sub-agent tracks internal energy counter
3. Sensitive loop polls sub-agent for energy consumption
4. Sensitive loop deducts energy from main regulator
5. Sub-agent resets internal counter

**Energy Costs**:
- **Adding a server**: ~5-10 energy units (connection + discovery)
- **Testing a server**: ~10-20 energy units (validation + sample invocations)
- **Searching for servers**: ~20-50 energy units (web search + evaluation)
- **Modifying configuration**: ~2-5 energy units (file I/O + validation)

### Top-Level Agent Interaction

The top-level agent can interact with the sub-agent through new tools:

**New Tools for LLM**:
```typescript
{
  name: 'mcp_request_server_addition',
  description: 'Request the sub-agent to add a new MCP server',
  parameters: {
    serverName: 'string',
    purpose: 'string',  // What the server should do
    priority: 'low' | 'medium' | 'high'
  }
}

{
  name: 'mcp_check_subagent_status',
  description: 'Check the status of a sub-agent request',
  parameters: {
    requestId: 'string'
  }
}

{
  name: 'mcp_cancel_subagent_work',
  description: 'Cancel pending sub-agent work',
  parameters: {
    requestId: 'string',
    reason: 'string'
  }
}

{
  name: 'mcp_list_available_tools',
  description: 'List all MCP tools currently available',
  parameters: {}
}
```

### Sub-Agent Autonomy & Limitations

**What Sub-Agent CAN Do**:
- Search for appropriate MCP servers (via web search or registry)
- Install npm packages for MCP servers
- Modify `mcp-servers.json` configuration
- Test server connections
- Validate tool functionality
- Report findings to top-level agent

**What Sub-Agent CANNOT Do**:
- Access energy regulator directly
- Communicate with users via conversations
- Make decisions about conversation priorities
- Override top-level agent decisions
- Operate when top-level agent is stopped

**Sub-Agent is Energy-Unaware**:
- The sub-agent doesn't know about energy levels
- It works on assigned tasks regardless of system energy
- It tracks work duration for energy accounting purposes
- The top-level agent decides when to let sub-agent work based on energy availability

## Non-Blocking Architecture

### Problem Statement

The sensitive loop must remain responsive to:
- User messages arriving via HTTP
- Energy status updates
- Conversation management decisions

If the sub-agent blocks the main loop, the system becomes unresponsive.

### Solution: Async Message-Based Communication

**Message Queue Pattern**:
```
┌──────────────────┐         ┌──────────────────┐
│ Sensitive Loop   │         │  MCP Sub-Agent   │
│                  │         │                  │
│  [Main Thread]   │         │  [Async Loop]    │
└──────────────────┘         └──────────────────┘
         │                            │
         │  Queue Request             │
         │──────────────────────────→ │
         │                            │
         │  Continue Processing       │
         │  (Non-blocking)            │
         │                            │
         │                      Work in Progress
         │                            │
         │  Poll for Updates          │
         │ ←──────────────────────────│
         │  (Status message)          │
         │                            │
         │  Deduct Energy             │
         │                            │
         │  Poll for Completion       │
         │ ←──────────────────────────│
         │  (Result message)          │
         │                            │
```

**Polling Strategy**:
- Sensitive loop checks for sub-agent messages during each cognitive cycle
- Polling is fast (just checking a queue)
- No blocking waits
- Energy consumption reported incrementally

### Energy Drain Detection

The top-level agent periodically:
1. Checks if sub-agent has active work: `hasActiveWork()`
2. Polls energy consumption: `getSubAgentEnergyConsumption()`
3. Deducts from main energy pool: `energyRegulator.consumeEnergy(amount)`
4. Observes energy draining during thinking cycles
5. Can decide to pause sub-agent if energy is critical

**Control Flow**:
```typescript
// In sensitive loop
if (subAgentInterface.hasActiveWork()) {
  const energyConsumed = subAgentInterface.getSubAgentEnergyConsumption();
  if (energyConsumed > 0) {
    energyRegulator.consumeEnergy(energyConsumed);
    console.log(`⚡ Sub-agent consumed ${energyConsumed} energy`);
  }
  
  // Check if energy is too low
  if (energyRegulator.getEnergy() < 10) {
    // Option 1: Let sub-agent finish current task
    // Option 2: Pause sub-agent
    // Option 3: Cancel sub-agent work
    // Decision is context-dependent
  }
}
```

## Security & Safety

### Tool Approval

**User Consent Model**:
- All MCP tool invocations require explicit user approval (default)
- Can be disabled in configuration for trusted tools
- Approval UI shows: tool name, server, parameters, estimated energy cost

**Tool Whitelisting**:
- Users can mark specific tools as "auto-approved"
- Stored in configuration file
- Per-server or per-tool granularity

### Sandboxing

**Server Isolation**:
- Each MCP server runs in separate process
- Limited file system access (configured per server)
- No direct access to main application state
- Communication only via stdio protocol

**Sub-Agent Restrictions**:
- Cannot execute arbitrary code
- npm installs limited to verified MCP servers
- File system writes restricted to configuration directory
- Web access limited to MCP registry and documentation

### Error Handling

**Server Failures**:
- Connection failures logged, don't crash main loop
- Automatic reconnection attempts (exponential backoff)
- Degraded mode: system continues without failed server
- User notification of server issues

**Tool Invocation Errors**:
- Errors returned to LLM as tool result
- LLM can reason about error and retry or adapt
- Energy still consumed for failed invocations
- Error patterns tracked for diagnostics

## Data Persistence

### MCP Server Configuration

**Storage**: `mcp-servers.json` in project root

**Schema**: See Configuration section above

**Modifications**:
- Sub-agent can append new servers
- Sub-agent can enable/disable servers
- Manual user edits supported (validated on load)
- Configuration changes trigger hot-reload

### Tool Usage Analytics

**Database Schema Extension**:
```sql
CREATE TABLE mcp_tool_invocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER,
  tool_name TEXT NOT NULL,
  server_id TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  parameters TEXT,  -- JSON
  result TEXT,      -- JSON
  energy_consumed REAL,
  success BOOLEAN,
  error TEXT,
  FOREIGN KEY (conversation_id) REFERENCES conversations (id)
);

CREATE TABLE mcp_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  config TEXT NOT NULL,  -- JSON
  enabled BOOLEAN DEFAULT TRUE,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used DATETIME,
  total_invocations INTEGER DEFAULT 0,
  total_failures INTEGER DEFAULT 0
);
```

## Implementation Dependencies

### Required npm Packages

```json
{
  "@modelcontextprotocol/sdk": "^1.18.0",
  "ajv": "^8.12.0",  // JSON schema validation
  "zod": "^3.22.0"   // Runtime type validation
}
```

### Optional Enhancements

- `@modelcontextprotocol/server-filesystem`: Example filesystem server
- `@modelcontextprotocol/server-github`: Example GitHub server
- `@modelcontextprotocol/server-fetch`: Web fetch server

## Testing Strategy

### Unit Tests

1. **MCP Client Manager**:
   - Server connection/disconnection
   - Tool discovery
   - Tool invocation
   - Error handling

2. **Sub-Agent**:
   - Request queueing
   - Message passing
   - Energy tracking
   - Request cancellation

3. **Tool Orchestrator**:
   - Tool registration
   - Tool routing
   - Energy accounting

### Integration Tests

1. **End-to-End Tool Usage**:
   - Configure MCP server
   - Discover tools
   - Invoke tool from LLM
   - Verify result
   - Verify energy consumption

2. **Sub-Agent Workflow**:
   - Request server addition
   - Monitor progress
   - Verify configuration updated
   - Verify tools available
   - Verify energy deduction

3. **Energy Management**:
   - Tool invocation consumes energy
   - Sub-agent work drains energy
   - Low energy pauses sub-agent
   - Energy recovery enables work

### Manual Testing

1. Start system with sample MCP server configuration
2. Send conversation requiring tool use
3. Verify LLM can invoke MCP tools
4. Request sub-agent to add new server
5. Monitor energy levels during sub-agent work
6. Verify non-blocking behavior
7. Test server failure scenarios

## Success Criteria

1. ✅ Top-level agent can invoke MCP tools from configured servers
2. ✅ MCP tool invocations consume energy proportionally
3. ✅ Sub-agent can add/remove/test MCP servers autonomously
4. ✅ Sub-agent work consumes energy tracked by top-level agent
5. ✅ Sensitive loop remains responsive during sub-agent work
6. ✅ Top-level agent can communicate with sub-agent via messages
7. ✅ Top-level agent can cancel/pause sub-agent work
8. ✅ Configuration persists across restarts
9. ✅ System degrades gracefully on MCP server failures
10. ✅ User can configure initial MCP servers

## Future Enhancements

1. **MCP Server Registry Integration**: Auto-discover servers from central registry
2. **Remote MCP Servers**: Support HTTP-based MCP servers
3. **Tool Composition**: Combine multiple MCP tools into workflows
4. **Learning-Based Tool Selection**: Train model to select optimal tools
5. **Distributed Sub-Agents**: Multiple specialized sub-agents for different tasks
6. **Tool Result Caching**: Cache expensive tool invocations
7. **Advanced Energy Prediction**: ML-based energy cost estimation
8. **Tool Performance Monitoring**: Track and optimize slow tools

## References

- [Model Context Protocol Official Documentation](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Example MCP Servers](https://github.com/modelcontextprotocol/servers)
