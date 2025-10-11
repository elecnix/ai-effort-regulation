# Memory Feature - Technical Specification

**Version:** 1.0  
**Date:** October 11, 2025  
**Status:** Proposed

## Overview

This specification defines the technical implementation of the Memory Feature, which enables the AI system to create, manage, and utilize persistent memory records from conversations. The feature introduces a Memory Sub-Agent that automatically creates memories when conversations end and compacts them when limits are reached.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Central Sensitive Loop                    │
│  - Conversation management                                   │
│  - Memory context injection                                  │
│  - End conversation hook → Memory creation                   │
└────────────┬────────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────────┐
│                    Memory Sub-Agent                          │
│  - Memory creation from conversations                        │
│  - Memory compaction when limit reached                      │
│  - Memory retrieval and formatting                           │
└────────────┬────────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────────┐
│                    Memory Storage (SQLite)                   │
│  - app_memories table                                        │
│  - 10 records per app limit                                  │
│  - Indexed by app_id                                         │
└─────────────────────────────────────────────────────────────┘
```

### Component Interactions

1. **Conversation End**: Loop calls `end_conversation` → triggers Memory Sub-Agent
2. **Memory Creation**: Sub-Agent analyzes conversation → creates memory record
3. **Memory Compaction**: If count > 10 → Sub-Agent enters compaction mode
4. **Memory Retrieval**: Loop starts conversation → retrieves app memories → injects into context
5. **Memory Context**: Central LLM receives memories → uses for decision making

## Data Model

### Database Schema

#### app_memories table

```sql
CREATE TABLE app_memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  source_conversation_id TEXT,
  metadata TEXT, -- JSON: { importance: number, tags: string[], ... }
  
  FOREIGN KEY (app_id) REFERENCES apps(app_id) ON DELETE CASCADE
);

CREATE INDEX idx_app_memories_app_id ON app_memories(app_id);
CREATE INDEX idx_app_memories_created_at ON app_memories(created_at);
CREATE INDEX idx_app_memories_updated_at ON app_memories(updated_at);
```

### TypeScript Interfaces

```typescript
interface AppMemory {
  id: number;
  appId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  sourceConversationId?: string;
  metadata?: {
    importance?: number; // 0-10 scale
    tags?: string[];
    relatedConversations?: string[];
  };
}

interface MemoryCreationRequest {
  appId: string;
  conversationId: string;
  conversationSummary: string;
  userMessages: string[];
  assistantMessages: string[];
}

interface MemoryCompactionRequest {
  appId: string;
  existingMemories: AppMemory[];
  newMemory: AppMemory;
}

interface MemoryCompactionDecision {
  action: 'delete' | 'edit';
  targetMemoryId: number;
  newContent?: string; // If action is 'edit'
  reason: string;
}
```

## Memory Sub-Agent

### Responsibilities

1. **Memory Creation**: Extract key facts from ended conversations
2. **Memory Compaction**: Decide which memories to keep/merge/delete
3. **Memory Formatting**: Structure memories for LLM context
4. **Energy Tracking**: Report energy consumption to main loop

### Implementation

```typescript
class MemorySubAgent {
  private db: Database.Database;
  private intelligentModel: IntelligentModel;
  private energyConsumed: number = 0;
  
  constructor(db: Database.Database, debugMode: boolean = false);
  
  // Create memory from ended conversation
  async createMemory(request: MemoryCreationRequest): Promise<AppMemory | null>;
  
  // Compact memories when limit reached
  async compactMemories(request: MemoryCompactionRequest): Promise<void>;
  
  // Get memories for an app
  getMemories(appId: string, limit: number = 10): AppMemory[];
  
  // Get memory count for an app
  getMemoryCount(appId: string): number;
  
  // Delete all memories for an app
  deleteAppMemories(appId: string): void;
  
  // Get energy consumed since last poll
  getEnergyConsumedSinceLastPoll(): number;
}
```

### Memory Creation Process

1. **Trigger**: `end_conversation` tool is called
2. **Input**: Conversation ID, app ID
3. **Analysis**: 
   - Retrieve full conversation from database
   - Extract user messages and assistant responses
   - Identify key facts, decisions, preferences, outcomes
4. **LLM Prompt**:
   ```
   You are a memory creation assistant. Analyze this conversation and create a concise memory record.
   
   Focus on:
   - Key facts and information
   - User preferences or patterns
   - Important decisions or outcomes
   - Lessons learned or insights
   
   Format: Single paragraph, 2-4 sentences, factual and concise.
   
   Conversation:
   [conversation content]
   
   Create memory:
   ```
5. **Storage**: Insert memory into `app_memories` table
6. **Compaction Check**: If count > 10, trigger compaction

### Memory Compaction Process

1. **Trigger**: Memory count exceeds 10 for an app
2. **Input**: All existing memories + new memory
3. **Analysis**:
   - Review all 11 memories
   - Identify redundant, outdated, or low-value memories
   - Consider merging related memories
4. **LLM Prompt**:
   ```
   You are a memory management assistant. You have 11 memories but can only keep 10.
   
   Analyze these memories and decide which ONE to either:
   1. DELETE (remove entirely)
   2. EDIT (merge with another or update content)
   
   Existing memories:
   [list of 10 memories with IDs]
   
   New memory:
   [new memory content]
   
   Decision format:
   {
     "action": "delete" | "edit",
     "targetMemoryId": <id>,
     "newContent": "<merged content if editing>",
     "reason": "<explanation>"
   }
   ```
5. **Execution**: Apply the decision (delete or update)
6. **Verification**: Ensure count is now 10

## Context Integration

### Memory Context Format

Memories are injected into the central LLM's context as a system message:

```
(memories for app: <app_name>)
The following are memories from previous conversations with this app:

1. [Created: 2025-10-10] User prefers meetings after 2pm on weekdays.
2. [Created: 2025-10-09] User is working on a project called "Phoenix" with deadline Nov 1.
3. [Created: 2025-10-08] User experienced database connection issues, resolved by restarting service.
...

Use these memories to provide context-aware responses.
```

### Context Injection Points

1. **Unanswered Conversations**: When focusing on an unanswered conversation
2. **Conversation Review**: When reviewing completed conversations
3. **Conversation Selection**: When selecting a conversation to improve

### Context Size Management

- Maximum 10 memories per app
- Each memory limited to ~200 characters
- Total memory context: ~2000 characters
- Fits comfortably in LLM context window

## API Changes

### New Internal Methods

#### SensitiveLoop

```typescript
// Hook called when conversation ends
private async onConversationEnd(conversationId: string, reason: string): Promise<void>;

// Get memories for context
private getMemoriesForApp(appId: string): AppMemory[];

// Format memories for LLM context
private formatMemoriesForContext(memories: AppMemory[]): string;
```

#### AppRegistry

```typescript
// Get app ID for a conversation
getAppIdForConversation(conversationId: string): string | null;

// Delete memories when app is uninstalled (optional, can be retained)
async uninstallApp(appId: string, purgeMemories: boolean = false): Promise<void>;
```

### New Admin API Endpoints

```typescript
// GET /apps/:appId/memories
// List memories for an app
{
  "memories": [
    {
      "id": 1,
      "content": "...",
      "createdAt": "2025-10-10T14:30:00Z",
      "updatedAt": "2025-10-10T14:30:00Z"
    }
  ]
}

// DELETE /apps/:appId/memories
// Purge all memories for an app
{
  "success": true,
  "deletedCount": 8
}

// DELETE /apps/:appId/memories/:memoryId
// Delete a specific memory
{
  "success": true
}
```

## Energy Consumption

### Memory Creation

- **Cost**: ~10-15 energy units per memory creation
- **Timing**: Async, after conversation ends (doesn't block)
- **Tracking**: Reported to main loop via `getEnergyConsumedSinceLastPoll()`

### Memory Compaction

- **Cost**: ~20-30 energy units per compaction cycle
- **Timing**: Async, triggered when limit reached
- **Frequency**: Approximately once per 10 conversations per app

### Energy Budget Impact

- Memory operations consume from the global energy budget
- Low priority: Only runs when energy > 20%
- Can be deferred if energy is critically low

## Error Handling

### Memory Creation Failures

- **LLM Error**: Log error, skip memory creation, conversation still ends
- **Database Error**: Log error, retry once, then skip
- **Timeout**: 30-second timeout, then skip

### Memory Compaction Failures

- **LLM Error**: Log error, fall back to FIFO (delete oldest)
- **Database Error**: Log error, retry once, then fall back to FIFO
- **Invalid Decision**: Log error, fall back to FIFO

### Graceful Degradation

- System continues to function without memories if sub-agent fails
- Memories are a quality-of-life feature, not critical for operation
- Errors are logged but don't crash the system

## Testing Strategy

### Unit Tests

1. **Memory Creation**: Test memory extraction from conversations
2. **Memory Compaction**: Test decision-making logic
3. **Memory Retrieval**: Test database queries
4. **Context Formatting**: Test memory injection into prompts

### Integration Tests

1. **End-to-End**: Create conversation → end → verify memory created
2. **Compaction**: Create 11 memories → verify compaction to 10
3. **Context Injection**: Verify memories appear in LLM context
4. **App Isolation**: Verify app A's memories don't appear in app B's context

### LLM Testing Challenges

**Challenge**: LLM behavior is non-deterministic

**Solutions**:
1. **Mock LLM**: Use deterministic mock for unit tests
2. **Pattern Matching**: Test for patterns, not exact content
3. **Multiple Runs**: Run tests multiple times, accept majority result
4. **Controlled Inputs**: Use simple, predictable conversations
5. **Fast Models**: Use small, fast models (llama3.2:1b) for tests

### Test Scenarios

```typescript
describe('Memory Feature', () => {
  it('creates memory when conversation ends', async () => {
    // Send message, get response, end conversation
    // Verify memory exists in database
  });
  
  it('includes memories in context for same app', async () => {
    // Create memory for app A
    // Start new conversation in app A
    // Verify memory is in LLM context
  });
  
  it('isolates memories between apps', async () => {
    // Create memory for app A
    // Start conversation in app B
    // Verify app A's memory is NOT in context
  });
  
  it('compacts memories when limit reached', async () => {
    // Create 10 memories for app
    // Create 11th memory
    // Verify count is back to 10
  });
  
  it('retains memories after app uninstall', async () => {
    // Create memories for app
    // Uninstall app
    // Verify memories still exist
  });
  
  it('purges memories on admin request', async () => {
    // Create memories for app
    // Call purge API
    // Verify memories are deleted
  });
});
```

## Performance Considerations

### Database Indexes

- `app_id`: Fast retrieval of app memories
- `created_at`: Efficient sorting by age
- `updated_at`: Track recent modifications

### Query Optimization

```sql
-- Efficient memory retrieval (indexed on app_id, limited to 10)
SELECT * FROM app_memories 
WHERE app_id = ? 
ORDER BY updated_at DESC 
LIMIT 10;

-- Efficient memory count (indexed on app_id)
SELECT COUNT(*) FROM app_memories 
WHERE app_id = ?;
```

### Caching Strategy

- **No caching initially**: Database is fast enough for 10 records
- **Future**: Cache in memory if performance issues arise

## Migration Plan

### Database Migration

```sql
-- Run on system startup
CREATE TABLE IF NOT EXISTS app_memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  source_conversation_id TEXT,
  metadata TEXT,
  
  FOREIGN KEY (app_id) REFERENCES apps(app_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_app_memories_app_id ON app_memories(app_id);
CREATE INDEX IF NOT EXISTS idx_app_memories_created_at ON app_memories(created_at);
CREATE INDEX IF NOT EXISTS idx_app_memories_updated_at ON app_memories(updated_at);
```

### Backward Compatibility

- Existing conversations continue to work without memories
- Memories are additive, don't break existing functionality
- Old conversations don't retroactively create memories

## Security Considerations

### Data Privacy

- Memories contain user data, must be protected
- No encryption initially (SQLite file is local)
- Future: Encryption at rest for sensitive deployments

### Access Control

- Memories are app-scoped, not user-scoped (initially)
- Admin API requires authentication (future)
- No public access to memory endpoints

### Data Retention

- Memories persist until explicitly purged
- Admin can purge per-app or per-memory
- Future: Automatic expiration policies

## Monitoring and Observability

### Metrics to Track

1. **Memory Creation Rate**: Memories created per hour
2. **Compaction Frequency**: Compactions per app per day
3. **Memory Utilization**: Apps with >0 memories / total apps
4. **Context Injection Rate**: % of conversations with memories
5. **Energy Consumption**: Energy spent on memory operations

### Logging

```typescript
// Memory creation
console.log(`📝 Created memory for app ${appId} from conversation ${conversationId}`);

// Memory compaction
console.log(`🗜️  Compacted memories for app ${appId}: ${decision.action} memory ${decision.targetMemoryId}`);

// Memory retrieval
console.log(`🧠 Retrieved ${count} memories for app ${appId}`);

// Errors
console.error(`❌ Memory creation failed for ${conversationId}: ${error.message}`);
```

## Future Enhancements

### Phase 2

1. **Memory Importance Scoring**: Automatic priority assignment
2. **Memory Search**: Query memories by keyword
3. **Memory Export**: Download memories as JSON
4. **Memory Statistics**: Dashboard for memory usage

### Phase 3

1. **Vector Embeddings**: Semantic memory search
2. **Cross-App Memories**: Shared memories between apps
3. **User-Level Memories**: Per-user memory spaces
4. **Memory Validation**: Fact-checking and conflict resolution

## Success Criteria

### Functional Requirements

- ✅ Memories are created when conversations end
- ✅ Memories are limited to 10 per app
- ✅ Memories are compacted intelligently when limit reached
- ✅ Memories are included in LLM context for same app
- ✅ Memories are isolated between apps
- ✅ Memories persist across system restarts
- ✅ Admin can purge memories

### Non-Functional Requirements

- ✅ Memory creation completes in <5 seconds
- ✅ Memory retrieval completes in <100ms
- ✅ Memory operations consume <5% of total energy
- ✅ No regression in existing test suites
- ✅ System remains stable with 100+ memories across apps

## Conclusion

This specification provides a complete technical blueprint for implementing the Memory Feature. The design is:

- **Simple**: Clear responsibilities, minimal new components
- **Scalable**: Fixed limits, efficient queries
- **Robust**: Graceful error handling, fallback strategies
- **Testable**: Clear test scenarios, deterministic where possible
- **Extensible**: Foundation for future enhancements

The implementation will proceed in phases as detailed in the Implementation Plan document.
