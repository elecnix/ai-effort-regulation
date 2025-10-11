# Memory Feature - Implementation Plan

**Version:** 1.0  
**Date:** October 11, 2025  
**Status:** Proposed

## Overview

This document outlines the step-by-step implementation plan for the Memory Feature. The plan is designed to minimize risk, enable incremental testing, and ensure no regressions in existing functionality.

## Implementation Phases

### Phase 1: Database Schema and Foundation
### Phase 2: Memory Sub-Agent Core
### Phase 3: Memory Creation
### Phase 4: Memory Retrieval and Context Injection
### Phase 5: Memory Compaction
### Phase 6: API Endpoints and Admin Tools
### Phase 7: Integration Testing and Refinement

---

## Phase 1: Database Schema and Foundation

### Objectives
- Add `app_memories` table to database
- Create TypeScript interfaces
- Set up database access layer

### Tasks

#### 1.1 Create Memory Types File
**File**: `src/memory-types.ts`

```typescript
export interface AppMemory {
  id: number;
  appId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  sourceConversationId?: string;
  metadata?: {
    importance?: number;
    tags?: string[];
    relatedConversations?: string[];
  };
}

export interface MemoryCreationRequest {
  appId: string;
  conversationId: string;
  conversationSummary: string;
  userMessages: string[];
  assistantMessages: string[];
}

export interface MemoryCompactionRequest {
  appId: string;
  existingMemories: AppMemory[];
  newMemory: AppMemory;
}

export interface MemoryCompactionDecision {
  action: 'delete' | 'edit';
  targetMemoryId: number;
  newContent?: string;
  reason: string;
}
```

#### 1.2 Add Database Schema
**File**: `src/memory-storage.ts`

Create a new class to manage memory storage:

```typescript
import Database from 'better-sqlite3';
import { AppMemory } from './memory-types';

export class MemoryStorage {
  private db: Database.Database;
  private insertMemoryStmt!: Database.Statement;
  private getMemoriesStmt!: Database.Statement;
  private getMemoryCountStmt!: Database.Statement;
  private updateMemoryStmt!: Database.Statement;
  private deleteMemoryStmt!: Database.Statement;
  private deleteAppMemoriesStmt!: Database.Statement;

  constructor(db: Database.Database) {
    this.db = db;
    this.initializeSchema();
    this.prepareStatements();
  }

  private initializeSchema(): void {
    this.db.exec(`
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
    `);
  }

  private prepareStatements(): void {
    // Implementation details
  }

  insertMemory(memory: Omit<AppMemory, 'id' | 'createdAt' | 'updatedAt'>): AppMemory {
    // Implementation
  }

  getMemories(appId: string, limit: number = 10): AppMemory[] {
    // Implementation
  }

  getMemoryCount(appId: string): number {
    // Implementation
  }

  updateMemory(id: number, content: string): void {
    // Implementation
  }

  deleteMemory(id: number): void {
    // Implementation
  }

  deleteAppMemories(appId: string): number {
    // Implementation
  }
}
```

#### 1.3 Testing
- **Unit Test**: `test/memory-storage.test.ts`
  - Test schema creation
  - Test CRUD operations
  - Test memory count limits
  - Test app isolation

**Success Criteria**:
- ✅ Database schema created successfully
- ✅ All CRUD operations work correctly
- ✅ Tests pass
- ✅ No impact on existing functionality

---

## Phase 2: Memory Sub-Agent Core

### Objectives
- Create Memory Sub-Agent class
- Integrate with main loop
- Set up energy tracking

### Tasks

#### 2.1 Create Memory Sub-Agent Skeleton
**File**: `src/memory-subagent.ts`

```typescript
import Database from 'better-sqlite3';
import { IntelligentModel } from './intelligent-model';
import { MemoryStorage } from './memory-storage';
import { AppMemory, MemoryCreationRequest, MemoryCompactionRequest } from './memory-types';

export class MemorySubAgent {
  private storage: MemoryStorage;
  private intelligentModel: IntelligentModel;
  private energyConsumed: number = 0;
  private debugMode: boolean;

  constructor(db: Database.Database, debugMode: boolean = false) {
    this.storage = new MemoryStorage(db);
    this.intelligentModel = new IntelligentModel();
    this.debugMode = debugMode;
  }

  async createMemory(request: MemoryCreationRequest): Promise<AppMemory | null> {
    // To be implemented in Phase 3
    return null;
  }

  async compactMemories(request: MemoryCompactionRequest): Promise<void> {
    // To be implemented in Phase 5
  }

  getMemories(appId: string, limit: number = 10): AppMemory[] {
    return this.storage.getMemories(appId, limit);
  }

  getMemoryCount(appId: string): number {
    return this.storage.getMemoryCount(appId);
  }

  deleteAppMemories(appId: string): number {
    return this.storage.deleteAppMemories(appId);
  }

  getEnergyConsumedSinceLastPoll(): number {
    const energy = this.energyConsumed;
    this.energyConsumed = 0;
    return energy;
  }

  private trackEnergy(amount: number): void {
    this.energyConsumed += amount;
  }
}
```

#### 2.2 Integrate with SensitiveLoop
**File**: `src/loop.ts`

Add Memory Sub-Agent to the loop:

```typescript
// Add import
import { MemorySubAgent } from './memory-subagent';

// Add to class properties
private memorySubAgent: MemorySubAgent;

// Initialize in constructor
this.memorySubAgent = new MemorySubAgent(this.inbox.getDatabase(), debugMode);

// Poll for energy in unifiedCognitiveAction
const memoryEnergy = this.memorySubAgent.getEnergyConsumedSinceLastPoll();
if (memoryEnergy > 0) {
  this.energyRegulator.consumeEnergy(memoryEnergy);
  if (this.debugMode) {
    console.log(`⚡ Memory Sub-Agent consumed ${memoryEnergy.toFixed(1)} energy`);
  }
}
```

#### 2.3 Testing
- **Unit Test**: `test/memory-subagent-core.test.ts`
  - Test sub-agent initialization
  - Test energy tracking
  - Test memory retrieval methods

**Success Criteria**:
- ✅ Memory Sub-Agent initializes correctly
- ✅ Energy tracking works
- ✅ Integration with loop doesn't break existing tests
- ✅ All existing tests still pass

---

## Phase 3: Memory Creation

### Objectives
- Implement memory creation from conversations
- Hook into conversation end event
- Test memory extraction quality

### Tasks

#### 3.1 Implement Memory Creation Logic
**File**: `src/memory-subagent.ts`

```typescript
async createMemory(request: MemoryCreationRequest): Promise<AppMemory | null> {
  try {
    const startEnergy = this.intelligentModel.getEstimatedEnergyCost();
    
    // Build prompt for memory creation
    const prompt = this.buildMemoryCreationPrompt(request);
    
    // Call LLM to create memory
    const response = await this.intelligentModel.generateResponse(
      [{ role: 'user', content: prompt }],
      null, // No energy regulator for sub-agent
      false, // Not streaming
      [], // No tools
      [] // No MCP tools
    );
    
    const memoryContent = response.content.trim();
    
    // Validate memory content
    if (!memoryContent || memoryContent.length < 10) {
      console.error('❌ Memory creation failed: content too short');
      return null;
    }
    
    // Store memory
    const memory = this.storage.insertMemory({
      appId: request.appId,
      content: memoryContent,
      sourceConversationId: request.conversationId,
      metadata: {}
    });
    
    // Track energy
    const energyUsed = this.intelligentModel.getEstimatedEnergyCost();
    this.trackEnergy(energyUsed);
    
    if (this.debugMode) {
      console.log(`📝 Created memory for app ${request.appId}: ${memoryContent.substring(0, 100)}...`);
    }
    
    return memory;
  } catch (error: any) {
    console.error(`❌ Memory creation error: ${error.message}`);
    return null;
  }
}

private buildMemoryCreationPrompt(request: MemoryCreationRequest): string {
  return `You are a memory creation assistant. Analyze this conversation and create a concise memory record.

Focus on:
- Key facts and information shared
- User preferences or patterns observed
- Important decisions or outcomes
- Lessons learned or insights gained

Format: Single paragraph, 2-4 sentences, factual and concise. Do not include meta-commentary.

Conversation Summary:
${request.conversationSummary}

User Messages:
${request.userMessages.join('\n')}

Assistant Messages:
${request.assistantMessages.join('\n')}

Create a memory record (2-4 sentences):`;
}
```

#### 3.2 Hook into Conversation End
**File**: `src/loop.ts`

Modify the `endConversation` tool handler:

```typescript
private async endConversation(requestId: string, reason: string) {
  // Existing end conversation logic...
  
  // Trigger memory creation (async, don't wait)
  this.createMemoryForConversation(requestId, reason).catch(error => {
    console.error(`❌ Memory creation failed for ${requestId}: ${error.message}`);
  });
}

private async createMemoryForConversation(conversationId: string, reason: string): Promise<void> {
  try {
    // Get conversation from database
    const conversation = this.inbox.getConversation(conversationId);
    if (!conversation) {
      return;
    }
    
    // Get app ID for this conversation
    const appId = this.appRegistry.getAppIdForConversation(conversationId) || 'chat';
    
    // Extract messages
    const userMessages = [conversation.inputMessage];
    const assistantMessages = conversation.responses.map(r => r.content);
    
    // Create memory request
    const request: MemoryCreationRequest = {
      appId,
      conversationId,
      conversationSummary: `Ended: ${reason}`,
      userMessages,
      assistantMessages
    };
    
    // Create memory
    const memory = await this.memorySubAgent.createMemory(request);
    
    if (memory && this.debugMode) {
      console.log(`📝 Memory created for conversation ${conversationId}`);
    }
  } catch (error: any) {
    console.error(`❌ Error creating memory: ${error.message}`);
  }
}
```

#### 3.3 Testing
- **Integration Test**: `test/memory-creation.test.ts`
  - Test memory creation from simple conversation
  - Test memory content quality
  - Test memory is associated with correct app
  - Test failure handling (LLM error, DB error)

**Test Strategy**:
- Use mock LLM for deterministic tests
- Use real LLM for quality tests (with small model)
- Verify memory content contains key information

**Success Criteria**:
- ✅ Memory is created when conversation ends
- ✅ Memory content is relevant and concise
- ✅ Memory is associated with correct app
- ✅ Errors are handled gracefully
- ✅ Existing tests still pass

---

## Phase 4: Memory Retrieval and Context Injection

### Objectives
- Retrieve memories for active conversations
- Inject memories into LLM context
- Test context formatting

### Tasks

#### 4.1 Add Memory Retrieval to Loop
**File**: `src/loop.ts`

Modify `getSystemMessage` to include memories:

```typescript
private getSystemMessage(targetConversation: { id: string; requestMessage: string; responseMessages: string[]; timestamp: Date } | null | undefined) {
  let message = !targetConversation ? this.systemMessage : this.systemMessage + '\n\n' + this.systemInboxMessage;
  
  // Add memory context if we have a target conversation
  if (targetConversation) {
    const appId = this.appRegistry.getAppIdForConversation(targetConversation.id) || 'chat';
    const memories = this.memorySubAgent.getMemories(appId, 10);
    
    if (memories.length > 0) {
      const memoryContext = this.formatMemoriesForContext(memories, appId);
      message = message + '\n\n' + memoryContext;
    }
  }
  
  return { role: 'system', content: message };
}

private formatMemoriesForContext(memories: AppMemory[], appId: string): string {
  const app = this.appRegistry.getApp(appId);
  const appName = app?.name || appId;
  
  let context = `(memories for app: ${appName})\n`;
  context += 'The following are memories from previous conversations with this app:\n\n';
  
  memories.forEach((memory, index) => {
    const date = new Date(memory.createdAt).toISOString().split('T')[0];
    context += `${index + 1}. [${date}] ${memory.content}\n`;
  });
  
  context += '\nUse these memories to provide context-aware responses.';
  
  return context;
}
```

#### 4.2 Testing
- **Integration Test**: `test/memory-context.test.ts`
  - Create memory for app A
  - Start new conversation in app A
  - Verify memory appears in LLM context
  - Verify LLM can reference memory in response
  - Test app isolation (app B doesn't see app A's memories)

**Test Strategy**:
- Capture LLM context in debug mode
- Verify memory text is present
- Use simple conversations to test memory usage

**Success Criteria**:
- ✅ Memories appear in LLM context
- ✅ LLM can reference memories in responses
- ✅ App isolation is maintained
- ✅ Context formatting is clean and readable
- ✅ Existing tests still pass

---

## Phase 5: Memory Compaction

### Objectives
- Implement intelligent memory compaction
- Trigger compaction when limit reached
- Test compaction decisions

### Tasks

#### 5.1 Implement Compaction Logic
**File**: `src/memory-subagent.ts`

```typescript
async compactMemories(request: MemoryCompactionRequest): Promise<void> {
  try {
    const startEnergy = this.intelligentModel.getEstimatedEnergyCost();
    
    // Build prompt for compaction decision
    const prompt = this.buildCompactionPrompt(request);
    
    // Call LLM to make decision
    const response = await this.intelligentModel.generateResponse(
      [{ role: 'user', content: prompt }],
      null,
      false,
      [],
      []
    );
    
    // Parse decision
    const decision = this.parseCompactionDecision(response.content);
    
    if (!decision) {
      // Fallback: delete oldest memory
      console.warn('⚠️  Compaction decision parsing failed, using FIFO fallback');
      const oldest = request.existingMemories.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )[0];
      this.storage.deleteMemory(oldest.id);
      return;
    }
    
    // Execute decision
    if (decision.action === 'delete') {
      this.storage.deleteMemory(decision.targetMemoryId);
      if (this.debugMode) {
        console.log(`🗜️  Deleted memory ${decision.targetMemoryId}: ${decision.reason}`);
      }
    } else if (decision.action === 'edit' && decision.newContent) {
      this.storage.updateMemory(decision.targetMemoryId, decision.newContent);
      if (this.debugMode) {
        console.log(`🗜️  Updated memory ${decision.targetMemoryId}: ${decision.reason}`);
      }
    }
    
    // Track energy
    const energyUsed = this.intelligentModel.getEstimatedEnergyCost();
    this.trackEnergy(energyUsed);
    
  } catch (error: any) {
    console.error(`❌ Compaction error: ${error.message}, using FIFO fallback`);
    // Fallback: delete oldest
    const oldest = request.existingMemories.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )[0];
    this.storage.deleteMemory(oldest.id);
  }
}

private buildCompactionPrompt(request: MemoryCompactionRequest): string {
  let prompt = `You are a memory management assistant. You have 11 memories but can only keep 10.

Analyze these memories and decide which ONE to either:
1. DELETE (remove entirely if redundant or outdated)
2. EDIT (merge with another or update content if related information can be combined)

Existing memories:\n`;

  request.existingMemories.forEach((memory, index) => {
    prompt += `\nMemory ${memory.id} (created ${new Date(memory.createdAt).toISOString().split('T')[0]}):\n${memory.content}\n`;
  });

  prompt += `\nNew memory (ID ${request.newMemory.id}):\n${request.newMemory.content}\n`;

  prompt += `\nRespond with JSON only:
{
  "action": "delete" or "edit",
  "targetMemoryId": <id of memory to delete or edit>,
  "newContent": "<merged content if editing, otherwise omit>",
  "reason": "<brief explanation>"
}`;

  return prompt;
}

private parseCompactionDecision(content: string): MemoryCompactionDecision | null {
  try {
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }
    
    const decision = JSON.parse(jsonMatch[0]);
    
    // Validate decision
    if (!decision.action || !decision.targetMemoryId || !decision.reason) {
      return null;
    }
    
    if (decision.action !== 'delete' && decision.action !== 'edit') {
      return null;
    }
    
    if (decision.action === 'edit' && !decision.newContent) {
      return null;
    }
    
    return decision;
  } catch (error) {
    return null;
  }
}
```

#### 5.2 Trigger Compaction on Memory Creation
**File**: `src/memory-subagent.ts`

Modify `createMemory` to check count and trigger compaction:

```typescript
async createMemory(request: MemoryCreationRequest): Promise<AppMemory | null> {
  // ... existing creation logic ...
  
  // Store memory
  const memory = this.storage.insertMemory({
    appId: request.appId,
    content: memoryContent,
    sourceConversationId: request.conversationId,
    metadata: {}
  });
  
  // Check if compaction is needed
  const count = this.storage.getMemoryCount(request.appId);
  if (count > 10) {
    if (this.debugMode) {
      console.log(`🗜️  Memory count (${count}) exceeds limit, triggering compaction for app ${request.appId}`);
    }
    
    const existingMemories = this.storage.getMemories(request.appId, 11);
    await this.compactMemories({
      appId: request.appId,
      existingMemories: existingMemories.filter(m => m.id !== memory.id),
      newMemory: memory
    });
  }
  
  return memory;
}
```

#### 5.3 Testing
- **Unit Test**: `test/memory-compaction.test.ts`
  - Test compaction decision parsing
  - Test delete action
  - Test edit action
  - Test FIFO fallback on error
  - Test compaction is triggered at 11 memories

**Test Strategy**:
- Use mock LLM with predefined decisions
- Test both delete and edit paths
- Test error handling and fallback
- Verify memory count is always ≤ 10

**Success Criteria**:
- ✅ Compaction is triggered when count > 10
- ✅ Compaction decisions are executed correctly
- ✅ Fallback to FIFO works on error
- ✅ Memory count never exceeds 10
- ✅ Existing tests still pass

---

## Phase 6: API Endpoints and Admin Tools

### Objectives
- Add API endpoints for memory management
- Enable admin to view and purge memories
- Document API

### Tasks

#### 6.1 Add Memory API Endpoints
**File**: `src/server.ts`

```typescript
// GET /apps/:appId/memories
app.get('/apps/:appId/memories', (req, res) => {
  try {
    const appId = req.params.appId;
    const memories = sensitiveLoop.getMemorySubAgent().getMemories(appId, 10);
    
    res.json({
      appId,
      count: memories.length,
      memories: memories.map(m => ({
        id: m.id,
        content: m.content,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        sourceConversationId: m.sourceConversationId
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /apps/:appId/memories
app.delete('/apps/:appId/memories', (req, res) => {
  try {
    const appId = req.params.appId;
    const deletedCount = sensitiveLoop.getMemorySubAgent().deleteAppMemories(appId);
    
    res.json({
      success: true,
      appId,
      deletedCount
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /apps/:appId/memories/:memoryId
app.delete('/apps/:appId/memories/:memoryId', (req, res) => {
  try {
    const memoryId = parseInt(req.params.memoryId);
    sensitiveLoop.getMemorySubAgent().deleteMemory(memoryId);
    
    res.json({
      success: true,
      memoryId
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

#### 6.2 Add Getter to SensitiveLoop
**File**: `src/loop.ts`

```typescript
getMemorySubAgent(): MemorySubAgent {
  return this.memorySubAgent;
}
```

#### 6.3 Update MemoryStorage with Delete Method
**File**: `src/memory-storage.ts`

```typescript
deleteMemory(id: number): void {
  this.deleteMemoryStmt.run(id);
}
```

#### 6.4 Testing
- **API Test**: `test/memory-api.test.ts`
  - Test GET /apps/:appId/memories
  - Test DELETE /apps/:appId/memories
  - Test DELETE /apps/:appId/memories/:memoryId
  - Test error handling

**Success Criteria**:
- ✅ API endpoints work correctly
- ✅ Memories can be viewed via API
- ✅ Memories can be purged via API
- ✅ Error handling is robust
- ✅ Existing tests still pass

---

## Phase 7: Integration Testing and Refinement

### Objectives
- End-to-end testing with real LLM
- Performance testing
- Regression testing
- Documentation updates

### Tasks

#### 7.1 End-to-End Integration Tests
**File**: `test/memory-e2e.test.ts`

```typescript
describe('Memory Feature E2E', () => {
  it('complete memory lifecycle', async () => {
    // 1. Start conversation
    // 2. Send messages
    // 3. End conversation
    // 4. Verify memory created
    // 5. Start new conversation
    // 6. Verify memory in context
    // 7. Verify LLM uses memory
  });
  
  it('memory compaction with 11 conversations', async () => {
    // Create 11 conversations
    // Verify only 10 memories remain
    // Verify most important memories retained
  });
  
  it('app isolation', async () => {
    // Create memory in app A
    // Create memory in app B
    // Verify app A sees only its memories
    // Verify app B sees only its memories
  });
});
```

#### 7.2 Performance Testing
- Measure memory creation time (target: <5s)
- Measure memory retrieval time (target: <100ms)
- Measure compaction time (target: <10s)
- Measure energy consumption (target: <5% of total)

#### 7.3 Regression Testing
Run all existing test suites:
```bash
npm test
npm run test:simple
npm run test:brainstorm
npm run test:snooze
npm run test:priorities
```

Verify no regressions in:
- Energy management
- Conversation handling
- App functionality
- MCP integration
- Approval system

#### 7.4 Documentation Updates

Update the following files:
- **README.md**: Add Memory Feature to features list
- **USER-GUIDE.md**: Add section on how memories work
- **FEATURES.md**: Add memory feature details
- **QUICK-REFERENCE.md**: Add memory API endpoints

#### 7.5 Testing with Different LLM Models
- Test with llama3.2:1b (fast, for CI)
- Test with llama3.2:3b (quality check)
- Test with OpenRouter models (optional)

**Success Criteria**:
- ✅ All E2E tests pass
- ✅ Performance targets met
- ✅ No regressions in existing tests
- ✅ Documentation is complete
- ✅ Works with multiple LLM models

---

## Testing Strategy Summary

### Unit Tests
- **memory-storage.test.ts**: Database operations
- **memory-subagent-core.test.ts**: Sub-agent initialization
- **memory-compaction.test.ts**: Compaction logic

### Integration Tests
- **memory-creation.test.ts**: Memory creation from conversations
- **memory-context.test.ts**: Memory injection into context
- **memory-api.test.ts**: API endpoints

### E2E Tests
- **memory-e2e.test.ts**: Complete lifecycle with real LLM

### Regression Tests
- Run all existing test suites
- Verify no functionality breaks

### Test Execution Order
1. Unit tests (fast, no LLM)
2. Integration tests (with mock LLM)
3. Integration tests (with real LLM, small model)
4. E2E tests (with real LLM)
5. Regression tests (full suite)

---

## Risk Mitigation

### Risk: Breaking Existing Functionality
**Mitigation**: 
- Run full test suite after each phase
- Keep changes isolated to new files where possible
- Use feature flags if needed

### Risk: LLM Quality Issues
**Mitigation**:
- Extensive prompt engineering
- Test with multiple models
- Fallback strategies (FIFO for compaction)
- Manual review of memory quality

### Risk: Performance Degradation
**Mitigation**:
- Async memory creation (doesn't block)
- Database indexes
- Fixed memory limits
- Performance benchmarks

### Risk: Database Migration Issues
**Mitigation**:
- Use IF NOT EXISTS for schema changes
- Test migration on empty and populated databases
- Backup database before migration

---

## Rollout Plan

### Development
1. Implement phases 1-7 sequentially
2. Test after each phase
3. Fix issues before moving to next phase

### Testing
1. Run unit tests continuously during development
2. Run integration tests after each phase
3. Run full regression suite before final commit

### Deployment
1. Merge to main branch
2. Tag release (e.g., v2.0.0-memory)
3. Update documentation
4. Announce feature in release notes

### Monitoring
1. Monitor memory creation rate
2. Monitor compaction frequency
3. Monitor energy consumption
4. Monitor error rates

---

## Success Criteria

### Functional
- ✅ Memories are created automatically when conversations end
- ✅ Memories are limited to 10 per app
- ✅ Memories are compacted intelligently
- ✅ Memories appear in LLM context for same app
- ✅ Memories are isolated between apps
- ✅ Admin can view and purge memories via API

### Non-Functional
- ✅ Memory creation: <5 seconds
- ✅ Memory retrieval: <100ms
- ✅ Memory operations: <5% of total energy
- ✅ No regressions in existing tests
- ✅ System remains stable with 100+ memories

### Quality
- ✅ Code is well-tested (>80% coverage for new code)
- ✅ Code follows existing patterns and style
- ✅ Documentation is complete and clear
- ✅ Error handling is robust

---

## Timeline Estimate

- **Phase 1**: 2-3 hours (Database schema and foundation)
- **Phase 2**: 1-2 hours (Memory Sub-Agent core)
- **Phase 3**: 3-4 hours (Memory creation)
- **Phase 4**: 2-3 hours (Memory retrieval and context)
- **Phase 5**: 3-4 hours (Memory compaction)
- **Phase 6**: 1-2 hours (API endpoints)
- **Phase 7**: 3-4 hours (Integration testing and refinement)

**Total**: 15-22 hours

---

## Conclusion

This implementation plan provides a structured, incremental approach to building the Memory Feature. By following these phases, testing thoroughly at each step, and monitoring for regressions, we can deliver a high-quality feature that enhances the system's intelligence without compromising stability.

The plan prioritizes:
- **Safety**: No breaking changes, extensive testing
- **Quality**: Robust error handling, fallback strategies
- **Maintainability**: Clean code, good documentation
- **Performance**: Efficient queries, async operations

Let's build this feature step by step, ensuring quality at every stage.
