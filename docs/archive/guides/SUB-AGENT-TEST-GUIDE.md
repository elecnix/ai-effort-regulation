# Sub-Agent Isolated Testing Guide

## Overview

This directory contains an **isolated test suite** for the MCP Sub-Agent component. These tests verify the sub-agent works correctly **before** integrating it with the main sensitive loop.

## What We're Testing

The sub-agent is a background worker that:
1. **Runs independently** in its own async loop
2. **Accepts requests** via a queue-based interface
3. **Processes requests** asynchronously (one at a time)
4. **Reports progress** through status updates
5. **Sends messages** back to the caller (completion, errors, status)
6. **Tracks metrics** (requests processed, timing, success rate)

## Test Suite

### Test 1: Basic Operation
Verifies the sub-agent can:
- Start up
- Queue a single request
- Process it asynchronously
- Report progress
- Complete successfully
- Send completion message

### Test 2: Multiple Concurrent Requests
Verifies:
- Multiple requests can be queued
- They're processed sequentially
- All complete successfully
- Metrics are tracked correctly

### Test 3: Priority Ordering
Verifies:
- High priority requests are processed first
- Medium priority comes next
- Low priority processed last
- Queue sorting works correctly

### Test 4: Request Cancellation
Verifies:
- Queued requests can be cancelled
- Status updates to 'cancelled'
- Cancelled requests don't execute

### Test 5: Message Polling
Verifies:
- Messages are queued for the caller
- `pollMessages()` returns pending messages
- Polling clears the queue
- All message types are received

### Test 6: Metrics Tracking
Verifies:
- Total requests counted
- Completed requests tracked
- Failed requests tracked
- Average processing time calculated

## Running the Tests

### Quick Run
```bash
./run-subagent-test.sh
```

### Manual Run
```bash
npm run build
node dist/test-subagent-isolated.js
```

### Expected Output

You should see output like:
```
🧪 Starting Sub-Agent Isolated Tests

=== Test 1: Basic Operation ===
🤖 Sub-agent started
📝 Queued request: abc-123-def
   Status: in_progress (25%) - Validating server config
   Status: in_progress (50%) - Testing connection
   📨 Message: status_update - {...}
   Status: completed (100%) - Request completed
✅ Test 1 PASSED

[... more tests ...]

==================================================
Test Results: 6/6 passed
==================================================
✅ All tests passed! Sub-agent is ready for integration.
```

## Interface Design

The sub-agent exposes this interface (designed for future integration with main loop):

### Starting/Stopping
```typescript
const agent = new MCPSubAgent(debugMode);
agent.start();  // Starts background loop
agent.stop();   // Graceful shutdown
```

### Queueing Requests
```typescript
const requestId = agent.queueRequest(
  'test_server',           // Request type
  { serverId: 'test-1' },  // Parameters
  'medium'                 // Priority: 'low' | 'medium' | 'high'
);
```

### Checking Status
```typescript
const status = agent.getStatus(requestId);
console.log(status.state);      // 'queued' | 'in_progress' | 'completed' | 'failed'
console.log(status.progress);   // 0-100
console.log(status.message);    // Human-readable status
console.log(status.result);     // Result data (if completed)
```

### Polling Messages
```typescript
const messages = agent.pollMessages();
for (const msg of messages) {
  console.log(msg.type);       // 'status_update' | 'completion' | 'error'
  console.log(msg.requestId);  // Which request this relates to
  console.log(msg.data);       // Message payload
}
```

### Checking for Work
```typescript
if (agent.hasActiveWork()) {
  console.log('Sub-agent is working on something');
}
```

### Getting Metrics
```typescript
const metrics = agent.getMetrics();
console.log(metrics.totalRequests);
console.log(metrics.completedRequests);
console.log(metrics.averageProcessingTime);
```

## Current Request Types

The sub-agent currently supports these request types (with mock implementations):

1. **`test_server`** - Test an MCP server connection
   - Params: `{ serverId, serverConfig }`
   - Duration: ~2 seconds
   - Returns: `{ status, toolCount, message }`

2. **`add_server`** - Add a new MCP server
   - Params: `{ serverConfig }`
   - Duration: ~2.5 seconds
   - Returns: `{ serverId, serverName, status, toolsDiscovered }`

3. **`remove_server`** - Remove an MCP server
   - Params: `{ serverId }`
   - Duration: ~0.5 seconds
   - Returns: `{ serverId, status, message }`

4. **`list_servers`** - List all configured servers
   - Params: `{}`
   - Duration: ~0.2 seconds
   - Returns: `{ servers, count, message }`

5. **`search_servers`** - Search for MCP servers
   - Params: `{ query }`
   - Duration: ~1.8 seconds
   - Returns: `{ query, results, count, message }`

## Key Design Decisions

### Non-Blocking by Design
- Sub-agent runs in its own async loop
- Main loop only needs to call `pollMessages()` periodically
- No blocking waits required

### Message-Based Communication
- All communication through message queues
- Main loop pulls messages when convenient
- No callbacks or complex synchronization

### Simple State Machine
Each request flows through states:
```
queued → in_progress → completed/failed/cancelled
```

### Priority Queue
- High priority requests jump to front of queue
- Ensures urgent work is handled first
- Low priority work can be deferred

### Progress Reporting
- Each handler reports progress at multiple stages
- Progress percentage (0-100)
- Human-readable status messages
- Helps with debugging and user feedback

## Next Steps

Once these tests pass, we can:

1. ✅ **Integrate with main loop** - Add sub-agent instance to `SensitiveLoop`
2. ⏭️ **Add energy tracking** - Track time and deduct from main energy pool
3. ⏭️ **Expose LLM tools** - Add tools for main agent to delegate to sub-agent
4. ⏭️ **Real implementations** - Replace mock handlers with actual MCP operations
5. ⏭️ **Configuration** - Connect to actual `mcp-servers.json` file

## Troubleshooting

### Tests timeout or hang
- Check if `agent.stop()` is being called
- Verify the sub-agent loop is starting
- Look for uncaught exceptions in handlers

### Messages not received
- Verify you're calling `pollMessages()` regularly
- Check if messages are being sent in handlers
- Enable debug mode for verbose logging

### Priority ordering fails
- Check if queue is being sorted correctly
- Verify priority values are correct
- Look at timing - very fast operations may overlap

## Files

- **`src/mcp-subagent-types.ts`** - Type definitions (interface contract)
- **`src/mcp-subagent.ts`** - Sub-agent implementation
- **`test-subagent-isolated.ts`** - Test suite
- **`run-subagent-test.sh`** - Test runner script

## Success Criteria

All 6 tests should pass before proceeding with integration:
- ✅ Basic operation works
- ✅ Multiple requests handled correctly
- ✅ Priority ordering respected
- ✅ Cancellation works
- ✅ Message polling reliable
- ✅ Metrics tracked accurately

When you see "All tests passed! Sub-agent is ready for integration.", you can proceed to the next phase.
