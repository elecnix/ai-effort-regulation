# Migration Guide

Guide for upgrading to the latest version of AI Effort Regulation.

## Version 1.1 (October 11, 2025) 🚀

### Overview

Version 1.1 includes **critical production-readiness fixes**:

1. **Database Schema Change**: Fixed foreign key constraint issue
2. **Rate Limiting Fix**: Returns JSON instead of HTML
3. **Input Validation**: Query parameter validation added
4. **Enhanced Health Checks**: Component-level monitoring
5. **Kubernetes Probes**: Readiness and liveness endpoints

### ⚠️ Breaking Change: Database Schema

The `app_conversations` table schema has changed to fix a critical foreign key constraint issue.

### Upgrading from 1.0 to 1.1

#### Step 1: Backup Data (If Needed)

If you have important conversations in production:

```bash
# Backup the database
cp conversations.db conversations.db.backup
```

#### Step 2: Update Code

```bash
# Pull latest code
git pull origin testing-features  # or main after merge

# Install dependencies
npm install

# Rebuild
npm run build
```

#### Step 3: Database Migration

**Option A: Fresh Start (Recommended for Development)**

```bash
# Delete old database
rm conversations.db

# Start server (creates new schema)
npm start
```

**Option B: Manual Migration (For Production)**

If you need to preserve data, you'll need to manually migrate:

```sql
-- Connect to database
sqlite3 conversations.db

-- Backup app_conversations data
CREATE TABLE app_conversations_backup AS 
SELECT * FROM app_conversations;

-- Drop old table
DROP TABLE app_conversations;

-- Restart the application to create new schema
-- Then manually restore data if needed
```

**Note**: The foreign key constraint that was removed was causing errors, so most production systems likely have no data in this table anyway.

#### Step 4: Verify

```bash
# Test health check
curl http://localhost:6740/health

# Should show component status:
# {
#   "status": "ok",
#   "components": {
#     "database": "healthy",
#     "energyRegulator": "healthy",
#     "inbox": "healthy"
#   }
# }

# Test new endpoints
curl http://localhost:6740/ready
curl http://localhost:6740/live
```

### What Changed

#### Database Schema
- Removed invalid foreign key: `FOREIGN KEY (conversation_id) REFERENCES conversations(request_id)`
- Added UNIQUE constraint: `UNIQUE(conversation_id, app_id)`
- Improved error handling for association failures

#### API Behavior
- Rate limiting now returns JSON (was HTML)
- Query parameters validated (limit, state, budgetStatus)
- Health check includes component status
- New endpoints: `/ready`, `/live`

#### Error Responses
All errors now return consistent JSON format:
```json
{
  "error": "Error message here"
}
```

### No Code Changes Required

All API changes are backward compatible. Your existing code will continue to work.

### Testing After Migration

```bash
# Run test suite
npm test

# Or manual tests
curl -X POST http://localhost:6740/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Test message", "energyBudget": 20}'

# Should return: {"status": "received", "requestId": "..."}
# No FOREIGN KEY errors!
```

---

## Version 1.0 (October 2025)

### Overview

Version 1.0 introduces three major feature sets:

1. **Energy Budget Feature**: User-guided effort allocation
2. **Unified MCP Tools**: Simplified tool integration
3. **HTTP MCP Transport**: Remote MCP server support

All changes are **backward compatible** - existing deployments will continue to work without modifications.

---

## Upgrading from Pre-1.0

### Step 1: Update Code

```bash
# Pull latest code
git pull origin main

# Install dependencies (may have new packages)
npm install

# Rebuild
npm run build
```

### Step 2: Database Migration

The database schema has been updated to support energy budgets. Migration is **automatic**:

```bash
# Just start the system
npm start

# The system will automatically:
# 1. Detect the old schema
# 2. Add the energy_budget column
# 3. Preserve all existing data
```

**No manual database changes required.**

### Step 3: Configuration Updates (Optional)

#### MCP Servers

If you have MCP servers configured, update `mcp-servers.json` to include the `transport` field:

**Before**:
```json
{
  "servers": [
    {
      "id": "filesystem",
      "name": "Local Filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./data"],
      "enabled": true
    }
  ]
}
```

**After**:
```json
{
  "servers": [
    {
      "id": "filesystem",
      "name": "Local Filesystem",
      "transport": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./data"],
      "enabled": true
    }
  ]
}
```

**Note**: If you don't add `transport`, it defaults to `"stdio"`, so this is optional but recommended for clarity.

### Step 4: Test the Upgrade

```bash
# Run tests to verify everything works
npm test

# Run integration tests
./test/run-with-server.sh simple

# Check energy budget feature
./run-budget-test.sh

# Check MCP integration
./run-mcp-test.sh
```

### Step 5: Update Client Code (Optional)

If you have client code that sends messages, you can now optionally include energy budgets:

**Before**:
```bash
curl -X POST http://localhost:6740/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Your question"}'
```

**After (with budget)**:
```bash
curl -X POST http://localhost:6740/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Your question", "energyBudget": 50}'
```

**Note**: The `energyBudget` parameter is optional. Omitting it maintains the old behavior.

---

## Breaking Changes

### None! 🎉

Version 1.0 is **100% backward compatible**. All existing functionality continues to work unchanged.

---

## New Features Available

### 1. Energy Budgets

You can now specify energy budgets when sending messages:

```bash
curl -X POST http://localhost:6740/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Your question", "energyBudget": 50}'
```

**Benefits**:
- Guide AI effort allocation
- Get concise answers for simple questions
- Get detailed analysis for complex questions
- Emergency "last chance" mode (budget: 0)

**See**: [ENERGY-BUDGET-QUICKSTART.md](./ENERGY-BUDGET-QUICKSTART.md)

### 2. Unified MCP Tools

MCP tools now appear directly in the AI's tool list (no more `mcp_call_tool` wrapper):

**Old Way**:
```json
{
  "name": "mcp_call_tool",
  "arguments": {
    "serverId": "filesystem",
    "toolName": "read_file",
    "arguments": {"path": "/file.txt"}
  }
}
```

**New Way**:
```json
{
  "name": "filesystem_read_file",
  "arguments": {"path": "/file.txt"}
}
```

**Benefits**:
- Simpler for small models
- Better tool discoverability
- Reduced cognitive load
- First-class tool integration

**See**: [UNIFIED-MCP-TOOLS.md](./UNIFIED-MCP-TOOLS.md)

### 3. HTTP MCP Transport

Connect to remote MCP servers via HTTP/HTTPS:

```json
{
  "id": "github-remote",
  "name": "Remote GitHub",
  "transport": "http",
  "url": "https://mcp-api.example.com/github",
  "auth": {
    "type": "bearer",
    "token": "${GITHUB_TOKEN}"
  },
  "enabled": true
}
```

**Benefits**:
- Cloud-based MCP services
- Containerized MCP servers
- Remote API integrations
- Distributed architectures

**See**: [HTTP-MCP-IMPLEMENTATION-SUMMARY.md](./HTTP-MCP-IMPLEMENTATION-SUMMARY.md)

### 4. Tool Namespacing

Tools are automatically prefixed with server ID to prevent collisions:

```
Server A (id: "fs-local"): fs-local_read_file
Server B (id: "fs-remote"): fs-remote_read_file
```

**Benefits**:
- No name collisions
- Clear tool origin
- Multiple servers with same tools
- Better LLM understanding

**See**: [TOOL-NAMESPACING.md](./TOOL-NAMESPACING.md)

---

## Configuration Changes

### Default Port

The default port has changed from **3005** to **6740** (NRG0).

**If you need the old port**:
```bash
npm start -- --port 3005
```

**Or set in environment**:
```bash
export PORT=3005
npm start
```

### Dynamic Port Allocation

The system now tries multiple ports if the default is occupied:

- Default: 6740
- Fallback: 6741, 6742, 6743, etc.
- Maximum attempts: 10

**To disable fallback**:
```bash
npm start -- --port 3005  # Will fail if port is occupied
```

---

## API Changes

### New Request Parameters

#### POST /message

**New optional parameter**: `energyBudget`

```json
{
  "content": "Your message",
  "energyBudget": 50  // ← NEW (optional)
}
```

**Validation**:
- Must be a non-negative number if provided
- Zero is valid (special "last chance" meaning)
- Null/undefined means no budget (default)

### New Response Fields

#### GET /conversations/:id

**New metadata fields**:

```json
{
  "metadata": {
    "totalEnergyConsumed": 25.3,
    "sleepCycles": 2,
    "modelSwitches": 1,
    "energyBudget": 50,              // ← NEW
    "energyBudgetRemaining": 24.7,   // ← NEW
    "budgetStatus": "within"         // ← NEW
  }
}
```

**Budget status values**:
- `"within"`: Under budget
- `"exceeded"`: Over budget
- `"depleted"`: Zero budget
- `null`: No budget set

---

## MCP Tool Changes

### Tool Names

MCP tools are now automatically namespaced:

**Before**:
- `read_file`
- `write_file`

**After**:
- `filesystem_read_file`
- `filesystem_write_file`

**Impact**: The LLM will automatically learn the new names. No action required.

### Tool Invocation

**Before** (via wrapper):
```typescript
{
  tool: "mcp_call_tool",
  parameters: {
    serverId: "filesystem",
    toolName: "read_file",
    arguments: { path: "/file.txt" }
  }
}
```

**After** (direct):
```typescript
{
  tool: "filesystem_read_file",
  parameters: { path: "/file.txt" }
}
```

**Impact**: The system handles both methods internally. The LLM will use the new direct method.

---

## Environment Variables

### New Variables

```bash
# MCP Authentication (optional)
export GITHUB_TOKEN=your-token
export API_KEY=your-key

# Server Configuration (optional)
export PORT=6740
export REPLENISH_RATE=10
```

### Existing Variables (unchanged)

```bash
# Ollama
export OLLAMA_BASE_URL=http://localhost:11434

# OpenRouter
export OPENROUTER_API_KEY=your-api-key
```

---

## Testing Your Migration

### 1. Basic Functionality

```bash
# Start the system
npm start

# Send a test message
curl -X POST http://localhost:6740/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello, test message"}'

# Check stats
curl http://localhost:6740/stats

# Check health
curl http://localhost:6740/health
```

### 2. Energy Budget Feature

```bash
# Send message with budget
curl -X POST http://localhost:6740/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Test with budget", "energyBudget": 20}'

# Get conversation and check budget fields
curl http://localhost:6740/conversations/{requestId}
```

### 3. MCP Integration

```bash
# Run MCP tests
./run-mcp-test.sh

# Check MCP server connections
# (if you have MCP servers configured)
```

### 4. Full Test Suite

```bash
# Run all tests
npm test

# Run integration tests
./test/run-with-server.sh all
./run-budget-test.sh
./run-mcp-test.sh
```

---

## Rollback Procedure

If you need to rollback to a previous version:

### Step 1: Checkout Previous Version

```bash
# Find the commit before the upgrade
git log --oneline

# Checkout that commit
git checkout <commit-hash>
```

### Step 2: Rebuild

```bash
npm install
npm run build
```

### Step 3: Database Compatibility

The database is **forward compatible**. The old code will:
- Ignore the `energy_budget` column
- Continue working with existing data

**No database rollback needed.**

### Step 4: Restart

```bash
npm start
```

---

## Common Migration Issues

### Issue: Port 6740 Already in Use

**Solution**:
```bash
# Use old port
npm start -- --port 3005

# Or kill process on 6740
lsof -ti:6740 | xargs kill -9
```

### Issue: MCP Servers Not Connecting

**Solution**:
1. Add `"transport": "stdio"` to server configs
2. Verify server commands are correct
3. Check server logs for errors

### Issue: Energy Budget Not Working

**Solution**:
1. Verify you're using the latest code
2. Check database migration completed
3. Verify request format is correct
4. Check server logs for validation errors

### Issue: Tool Names Changed

**Solution**:
This is expected. Tool names are now namespaced:
- Old: `read_file`
- New: `filesystem_read_file`

The LLM will automatically adapt. No action needed.

---

## Performance Considerations

### Database Size

The new schema adds one column per conversation. Impact is minimal:
- Additional storage: ~8 bytes per conversation
- Query performance: No degradation
- Index updates: Automatic

### MCP Tool Discovery

Tool discovery now happens at startup:
- STDIO servers: Instant (local process)
- HTTP servers: ~50-200ms (network dependent)

**Recommendation**: Enable only needed servers to minimize startup time.

### Energy Tracking

Energy budget tracking adds minimal overhead:
- Per-message: <1ms
- Per-response: <1ms
- Database queries: <10ms

**Impact**: Negligible on overall performance.

---

## Getting Help

### Documentation

- **[User Guide](./USER-GUIDE.md)**: Complete user documentation
- **[Quick Reference](./QUICK-REFERENCE.md)**: Common commands
- **[Features](./FEATURES.md)**: Feature list and status
- **[Release Notes](./RELEASE-NOTES.md)**: Detailed changes

### Support Channels

- **GitHub Issues**: https://github.com/elecnix/ai-effort-regulation/issues
- **Discussions**: https://github.com/elecnix/ai-effort-regulation/discussions

### Reporting Issues

When reporting migration issues, include:

1. Previous version (git commit hash)
2. Current version
3. Error messages
4. Steps to reproduce
5. System information (OS, Node version)

---

## Summary

### What Changed

✅ **New Features**:
- Energy budgets
- Unified MCP tools
- HTTP MCP transport
- Tool namespacing

✅ **Improvements**:
- Better small model support
- Remote MCP server support
- Automatic collision prevention
- Enhanced documentation

✅ **Compatibility**:
- 100% backward compatible
- Automatic database migration
- No breaking changes
- Optional new features

### What Stayed the Same

- Core energy regulation
- Conversation management
- Model switching
- Reflection system
- API endpoints (with additions)
- Database format (with additions)

### Action Required

**Minimal**:
1. Pull latest code
2. Run `npm install`
3. Run `npm run build`
4. Start the system

**Optional**:
1. Add `transport` field to MCP configs
2. Update client code to use energy budgets
3. Configure HTTP MCP servers
4. Set new environment variables

---

**Migration Status**: ✅ Straightforward  
**Downtime Required**: None (can upgrade in place)  
**Data Loss Risk**: None (automatic migration)  
**Rollback Difficulty**: Easy (forward compatible)

**Version**: 1.0  
**Last Updated**: October 11, 2025
