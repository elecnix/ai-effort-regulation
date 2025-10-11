# Tool Namespacing

## Overview

Tool namespacing prevents name collisions when multiple MCP servers provide tools with the same name. Each tool is automatically prefixed with its server ID to ensure uniqueness.

## Problem

Without namespacing, if two MCP servers both provide a tool called `read_file`, the system wouldn't know which server to route the call to:

```
Server A: read_file, write_file
Server B: read_file, delete_file

❌ Collision: Which read_file should be called?
```

## Solution

Tools are automatically prefixed with their server ID:

```
Server A (id: "filesystem-local"):
  - filesystem-local_read_file
  - filesystem-local_write_file

Server B (id: "filesystem-remote"):
  - filesystem-remote_read_file
  - filesystem-remote_delete_file

✅ No collision: Each tool has a unique name
```

## Implementation

### Automatic Prefixing

When tools are discovered from an MCP server, they are automatically prefixed:

```typescript
// Original tool from server
{
  name: "read_file",
  description: "Read a file"
}

// After namespacing (server ID: "filesystem")
{
  name: "filesystem_read_file",
  originalName: "read_file",
  description: "Read a file",
  serverId: "filesystem"
}
```

### Tool Invocation

When a tool is called, the system:
1. Receives the namespaced name (e.g., `filesystem_read_file`)
2. Looks up the tool to find its server and original name
3. Routes the call to the correct server
4. Invokes the tool using its original name

```typescript
// LLM calls: filesystem_read_file
// System routes to: server "filesystem"
// Server receives: read_file
```

## Benefits

### 1. Collision Prevention

Multiple servers can provide tools with the same name without conflicts:

```json
{
  "servers": [
    {
      "id": "github",
      "transport": "http",
      "url": "https://api.github.com/mcp"
    },
    {
      "id": "gitlab",
      "transport": "http",
      "url": "https://api.gitlab.com/mcp"
    }
  ]
}
```

Both servers can provide `create_issue` without collision:
- `github_create_issue`
- `gitlab_create_issue`

### 2. Clear Tool Origin

The tool name immediately shows which server provides it:

```
filesystem-local_read_file  → Local filesystem server
filesystem-remote_read_file → Remote filesystem server
github_create_issue         → GitHub server
slack_send_message          → Slack server
```

### 3. LLM Clarity

The LLM can see which server each tool belongs to, helping it make better decisions:

```
Available tools:
- github_create_issue: Create an issue on GitHub
- gitlab_create_issue: Create an issue on GitLab
- jira_create_issue: Create an issue on Jira
```

## Configuration

No configuration needed - namespacing is automatic!

Just ensure each server has a unique ID:

```json
{
  "servers": [
    {
      "id": "server-1",  // ← Must be unique
      "name": "My Server",
      "transport": "http",
      "url": "http://localhost:8080/mcp"
    },
    {
      "id": "server-2",  // ← Must be unique
      "name": "Another Server",
      "transport": "http",
      "url": "http://localhost:8081/mcp"
    }
  ]
}
```

## Examples

### Example 1: Multiple Filesystem Servers

```json
{
  "servers": [
    {
      "id": "fs-local",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user"]
    },
    {
      "id": "fs-remote",
      "transport": "http",
      "url": "https://files.example.com/mcp"
    }
  ]
}
```

Tools available:
- `fs-local_read_file` - Read from local filesystem
- `fs-local_write_file` - Write to local filesystem
- `fs-remote_read_file` - Read from remote filesystem
- `fs-remote_write_file` - Write to remote filesystem

### Example 2: Multiple API Servers

```json
{
  "servers": [
    {
      "id": "github",
      "transport": "http",
      "url": "https://mcp.github.com/api"
    },
    {
      "id": "gitlab",
      "transport": "http",
      "url": "https://mcp.gitlab.com/api"
    }
  ]
}
```

Tools available:
- `github_create_issue`
- `github_list_repos`
- `gitlab_create_issue`
- `gitlab_list_projects`

## Testing

The namespacing system includes comprehensive tests:

```bash
node dist/test/test-tool-namespacing.js
```

Test coverage:
- ✅ Tool names are prefixed with server ID
- ✅ No collisions between servers with same tool names
- ✅ Tools correctly routed to their respective servers
- ✅ Original tool names preserved for actual invocation
- ✅ Error handling works for cross-server tool calls

## Technical Details

### Data Structure

```typescript
interface MCPTool {
  name: string;           // Namespaced: "serverId_toolName"
  originalName?: string;  // Original: "toolName"
  description: string;
  serverId: string;
  serverName: string;
  inputSchema: any;
}
```

### Name Format

```
{serverId}_{originalToolName}
```

Examples:
- `filesystem_read_file`
- `github_create_issue`
- `weather-api_get_forecast`

### Routing Logic

```typescript
// 1. LLM calls tool with namespaced name
const toolName = "filesystem_read_file";

// 2. Find tool to get server ID and original name
const tool = mcpTools.find(t => t.name === toolName);
// tool.serverId = "filesystem"
// tool.originalName = "read_file"

// 3. Route to correct server with original name
await mcpClient.callTool(
  tool.serverId,      // "filesystem"
  tool.name,          // "filesystem_read_file" (for lookup)
  args
);

// 4. Client manager extracts original name and calls server
// Server receives: "read_file"
```

## Best Practices

### 1. Use Descriptive Server IDs

```json
// ✅ Good
{
  "id": "github-production",
  "id": "filesystem-home",
  "id": "weather-openweather"
}

// ❌ Avoid
{
  "id": "server1",
  "id": "s2",
  "id": "temp"
}
```

### 2. Keep Server IDs Short

Shorter IDs = shorter tool names:

```
// ✅ Good
github_create_issue

// ❌ Too long
github-production-api-v2_create_issue
```

### 3. Use Consistent Naming

```json
{
  "id": "fs-local",    // filesystem-local
  "id": "fs-remote",   // filesystem-remote
  "id": "db-primary",  // database-primary
  "id": "db-replica"   // database-replica
}
```

## Migration

### From Non-Namespaced Systems

If you're migrating from a system without namespacing:

**Before:**
```
read_file → Which server?
```

**After:**
```
filesystem-local_read_file → Clear!
```

The LLM will need to learn the new tool names, but this happens automatically through the tool list.

### Backward Compatibility

This feature is **not backward compatible** with systems expecting non-namespaced tool names. However:

1. The original tool names are preserved in `originalName`
2. Servers receive the original names (not namespaced)
3. Only the LLM-facing names are namespaced

## Future Enhancements

### 1. Custom Namespace Separators

Allow configuration of the separator:

```json
{
  "namespaceSeparator": "::"  // github::create_issue
}
```

### 2. Namespace Aliases

Allow shorter aliases:

```json
{
  "id": "filesystem-production-primary",
  "alias": "fs"  // fs_read_file instead of filesystem-production-primary_read_file
}
```

### 3. Namespace Groups

Group related servers:

```json
{
  "namespace": "github",
  "servers": [
    {"id": "prod"},  // github.prod_create_issue
    {"id": "dev"}    // github.dev_create_issue
  ]
}
```

## Conclusion

Tool namespacing is a critical feature that:
- ✅ Prevents name collisions
- ✅ Clarifies tool origins
- ✅ Enables multiple servers with similar tools
- ✅ Works automatically without configuration
- ✅ Maintains compatibility with MCP servers

The system handles all the complexity internally, providing a seamless experience for both developers and LLMs.
