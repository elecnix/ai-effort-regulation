# Unified MCP Tool System

## Overview

This document describes the unified tool system implementation that eliminates the two-tier architecture for MCP tools, making them directly accessible to the LLM alongside core tools.

## Problem Statement

### Previous Architecture (Two-Tier)

```
Core Tools → mcp_call_tool → MCP Tools
```

**Issues:**
1. **Indirection**: LLM had to use `mcp_call_tool` wrapper with nested arguments
2. **Discovery Gap**: MCP tools weren't visible in the LLM's tool list
3. **Complexity**: Small models struggled with nested JSON and server ID management
4. **Cognitive Overhead**: LLM needed to remember which server provides which tool

**Example (Old):**
```json
{
  "name": "mcp_call_tool",
  "arguments": {
    "serverId": "filesystem",
    "toolName": "read_file",
    "arguments": {"path": "/etc/hosts"}
  }
}
```

### New Architecture (Unified)

```
All Tools (Core + MCP) → Direct Execution
```

**Benefits:**
1. **Direct Access**: MCP tools appear directly in the tool list
2. **Flat Structure**: No nested arguments
3. **Clear Naming**: Tools prefixed with `[MCP:server_id]` in descriptions
4. **Small Model Friendly**: Simple, consistent tool calling pattern

**Example (New):**
```json
{
  "name": "read_file",
  "arguments": {"path": "/etc/hosts"}
}
```

## Implementation Details

### 1. Tool Definition Interface

Added `MCPToolDefinition` interface in `intelligent-model.ts`:

```typescript
export interface MCPToolDefinition {
  name: string;
  description: string;
  serverId: string;
  inputSchema: any;
}
```

### 2. Dynamic Tool Injection

Modified `IntelligentModel.generateResponse()` to accept MCP tools:

```typescript
async generateResponse(
  messages: Array<{ role: string; content: string }>,
  energyRegulator: EnergyRegulator,
  urgent: boolean = false,
  allowedTools: string[] = ['respond', 'await_energy', 'select_conversation'],
  mcpTools: MCPToolDefinition[] = []
): Promise<ModelResponse>
```

### 3. Tool List Generation

In `generateLLMResponse()`, MCP tools are converted to OpenAI tool format and combined with core tools:

```typescript
// Filter core tools based on allowed tools
const coreTools = allTools.filter(tool => allowedTools.includes(tool.function.name));

// Convert MCP tools to OpenAI tool format
const mcpToolsFormatted = mcpTools.map(mcpTool => ({
  type: 'function' as const,
  function: {
    name: mcpTool.name,
    description: `[MCP:${mcpTool.serverId}] ${mcpTool.description}`,
    parameters: mcpTool.inputSchema
  }
}));

// Combine core tools and MCP tools
const tools = [...coreTools, ...mcpToolsFormatted];
```

### 4. Tool Routing

In `SensitiveLoop.executeToolCall()`, MCP tool calls are detected and routed to the MCP client:

```typescript
} else {
  // Check if this is an MCP tool call
  const mcpTools = this.getMCPTools();
  const mcpTool = mcpTools.find(t => t.name === name);
  
  if (mcpTool) {
    // This is an MCP tool - route to MCP client
    const toolArgs = JSON.parse(args);
    await this.handleMcpToolCall(mcpTool.serverId, name, toolArgs);
  } else {
    console.error(`Unknown tool: ${name}`);
  }
}
```

### 5. MCP Tool Discovery

Added `getMCPTools()` method in `SensitiveLoop`:

```typescript
private getMCPTools(): MCPToolDefinition[] {
  const mcpTools: MCPToolDefinition[] = [];
  const connections = this.mcpClient.getAllConnections();
  
  for (const connection of connections) {
    if (connection.connected) {
      for (const tool of connection.tools) {
        mcpTools.push({
          name: tool.name,
          description: tool.description,
          serverId: tool.serverId,
          inputSchema: tool.inputSchema
        });
      }
    }
  }
  
  return mcpTools;
}
```

### 6. Removed Tools

- **Removed**: `mcp_call_tool` from core tools list
- **Kept**: `mcp_add_server` and `mcp_list_servers` for server management

## Changes Summary

### Files Modified

1. **src/intelligent-model.ts**
   - Added `MCPToolDefinition` interface
   - Updated `generateResponse()` signature to accept `mcpTools`
   - Updated `generateLLMResponse()` to inject MCP tools into tool list
   - Removed `mcp_call_tool` from core tools

2. **src/loop.ts**
   - Added `getMCPTools()` method
   - Updated all `generateResponse()` calls to pass MCP tools
   - Modified `executeToolCall()` to route MCP tool calls
   - Renamed `handleMcpCallTool()` to `handleMcpToolCall()`
   - Updated system message to reflect unified tools

3. **src/server.ts**
   - Changed default port from 3005 to 6740
   - Added `findAvailablePort()` function for dynamic port selection
   - Updated `startServer()` to be async and return port number

4. **src/index.ts**
   - Updated to await `startServer()`

5. **test/config.json**
   - Updated `serverUrl` to use port 6740

## Testing

### Verification Test

Created `test/verify-unified-tools.ts` to verify the unified tool system:

```bash
npx ts-node test/verify-unified-tools.ts
```

**Results:**
- ✅ Mock MCP tools successfully created
- ✅ Tool list generation works correctly
- ✅ Core tools and MCP tools combined properly
- ✅ Total tools available: 4 (2 core + 2 MCP)

### Integration Tests

Running full test suite:

```bash
npm test
```

Tests are running successfully with the new unified tool system.

## Benefits for Small Models

### Before (Nested Structure)
```json
{
  "name": "mcp_call_tool",
  "arguments": "{\"serverId\":\"filesystem\",\"toolName\":\"read_file\",\"arguments\":{\"path\":\"/etc/hosts\"}}"
}
```

**Challenges:**
- 3 levels of nesting
- String escaping required
- Server ID lookup needed
- Easy to make syntax errors

### After (Flat Structure)
```json
{
  "name": "read_file",
  "arguments": "{\"path\":\"/etc/hosts\"}"
}
```

**Advantages:**
- 1 level of nesting
- No string escaping
- Direct tool name
- Simpler for small models like `llama3.2:1b`

## Migration Notes

### For Users

No changes required. The system automatically:
1. Discovers MCP tools from connected servers
2. Injects them into the LLM's tool list
3. Routes tool calls to the appropriate server

### For Developers

If you're extending the system:
- MCP tools are now first-class citizens
- No need to use `mcp_call_tool` wrapper
- Tool names should be unique across all servers
- Use `[MCP:server_id]` prefix in descriptions for clarity

## Port Configuration

The system now uses dynamic port selection starting at **6740** (NRG0):
- Default port: 6740
- If occupied, tries: 6741, 6742, etc.
- Maximum attempts: 10

This prevents conflicts with other running instances.

## Future Enhancements

1. **Tool Namespacing**: Add automatic prefixing of MCP tool names with server ID to prevent collisions
2. **Tool Caching**: Cache tool lists to reduce repeated discovery calls
3. **Tool Filtering**: Allow filtering MCP tools based on context or energy level
4. **Tool Analytics**: Track which MCP tools are most frequently used

## Conclusion

The unified MCP tool system significantly simplifies the architecture and makes MCP tools more accessible to small language models. The flat structure reduces cognitive load and improves reliability of tool calls.
