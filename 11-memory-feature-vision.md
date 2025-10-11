# Memory Feature - Vision Document

**Version:** 1.0  
**Date:** October 11, 2025  
**Status:** Proposed

## Overview

The Memory Feature introduces a persistent, intelligent memory system that enables the central LLM to maintain context across conversations and learn from past interactions. This feature addresses the current limitation where the working memory of the central LLM is very tight and not well organized, with conversations popping up into context without structured historical awareness.

## Problem Statement

### Current Limitations

1. **Tight Working Memory**: The central LLM has limited context window, making it difficult to maintain awareness of past interactions
2. **Poor Organization**: Conversations appear in context without structured historical information
3. **No Learning**: The system doesn't retain insights from completed conversations
4. **Context Loss**: When conversations end, valuable context and outcomes are lost
5. **Repetitive Patterns**: The LLM may repeat mistakes or miss opportunities to apply lessons learned

### User Impact

- Users must re-explain context in new conversations
- The system cannot reference or build upon previous interactions
- Valuable insights from past conversations are lost
- The system appears to have no "memory" of past interactions
- Users experience frustration from repetitive explanations

## Solution: Intelligent Memory System

### Core Concept

Introduce a **Memory Sub-Agent** that automatically creates, manages, and compacts memory records from conversations. These memories are:

- **Persistent**: Stored in the database and survive system restarts
- **App-Scoped**: Each app has its own memory space
- **Contextual**: Automatically included when relevant conversations occur
- **Managed**: Automatically compacted to maintain a fixed limit per app
- **Retained**: Preserved even when apps are uninstalled (until admin purges)

### Key Benefits

#### For Users

1. **Continuity**: The system remembers past interactions and can reference them
2. **Efficiency**: No need to re-explain context in every conversation
3. **Intelligence**: The system learns from past mistakes and successes
4. **Personalization**: Memories capture user preferences and patterns
5. **Trust**: Users feel the system "knows" them and their history

#### For the System

1. **Better Context**: The central LLM has structured historical information
2. **Improved Decisions**: Can reference past outcomes when making decisions
3. **Resource Efficiency**: Memories are more compact than full conversation history
4. **Scalability**: Fixed memory limit per app prevents unbounded growth
5. **Modularity**: Each app's memories are isolated and manageable

## How It Works

### Memory Creation

When a conversation ends (via the `end_conversation` tool), the Memory Sub-Agent:

1. Reviews the conversation content and outcomes
2. Extracts key facts, decisions, and learnings
3. Creates a concise memory record
4. Stores it in the database, associated with the app

### Memory Retrieval

When a conversation starts or continues:

1. The system identifies which app owns the conversation
2. Retrieves the app's memory records (up to 10 most recent)
3. Includes them in the context provided to the central LLM
4. The LLM can reference these memories when responding

### Memory Compaction

When an app reaches its memory limit (10 records):

1. The Memory Sub-Agent enters "compaction mode"
2. Reviews all existing memories plus the new one
3. Decides which memory to edit (merge information) or delete
4. Ensures the most valuable information is retained
5. Maintains the 10-record limit

### Memory Lifecycle

```
Conversation Ends
      ↓
Memory Sub-Agent Creates Memory
      ↓
Memory Stored in Database (app_memories table)
      ↓
Memory Count < 10? → Yes → Done
      ↓ No
Compaction Mode Activated
      ↓
Sub-Agent Decides: Edit or Delete
      ↓
Memory Space Maintained at 10 Records
```

## Use Cases

### Use Case 1: Personal Assistant App

**Scenario**: User has a chat app that helps with daily tasks

**Without Memories**:
- User: "I prefer meetings after 2pm"
- System: "Noted" (but forgets after conversation ends)
- Later: User: "Schedule a meeting" 
- System: "What time?" (has to ask again)

**With Memories**:
- User: "I prefer meetings after 2pm"
- System: "Noted" (creates memory: "User prefers meetings after 2pm")
- Later: User: "Schedule a meeting"
- System: "I'll schedule it after 2pm as you prefer" (references memory)

### Use Case 2: Technical Support App

**Scenario**: User reports issues and gets help

**Without Memories**:
- User reports bug, system helps, conversation ends
- Later: Similar bug occurs
- System has no context of previous issue or solution

**With Memories**:
- User reports bug, system helps, creates memory: "User experienced X, solved with Y"
- Later: Similar bug occurs
- System: "This looks similar to the issue we resolved with Y. Should we try that?"

### Use Case 3: Learning App

**Scenario**: User learns a new skill over multiple sessions

**Without Memories**:
- Each session starts from scratch
- System doesn't know what was covered before
- User must recap previous lessons

**With Memories**:
- System remembers: "Covered topics A, B, C. User struggled with B."
- Next session: "Let's continue from where we left off. Want to review B?"
- Progressive learning with context

## Design Principles

### 1. Automatic and Transparent

Memories are created automatically without user intervention. Users benefit from continuity without managing memory explicitly.

### 2. App-Scoped Isolation

Each app has its own memory space. A chat app's memories don't interfere with a calendar app's memories. This provides:
- Clear boundaries
- Better organization
- Easier debugging
- Scalable architecture

### 3. Fixed Limits

Each app is limited to 10 memory records. This ensures:
- Predictable resource usage
- Fast retrieval
- Manageable context size
- Forced prioritization of important information

### 4. Intelligent Compaction

The Memory Sub-Agent uses LLM intelligence to decide what to keep, merge, or discard. This is superior to simple FIFO because:
- Important memories are retained
- Related memories can be merged
- Obsolete information is removed
- Quality over quantity

### 5. Persistent but Purgeable

Memories survive app uninstallation but can be purged by admins. This provides:
- Data continuity if app is reinstalled
- User privacy through admin purge capability
- Audit trail for system behavior
- Compliance with data retention policies

## Technical Architecture Preview

### New Components

1. **Memory Sub-Agent**: Manages memory creation and compaction
2. **app_memories table**: Stores memory records in database
3. **Memory Context Provider**: Injects memories into LLM context
4. **Memory Compaction Loop**: Runs when memory limit reached

### Integration Points

1. **Conversation End Hook**: Triggers memory creation
2. **Conversation Start Hook**: Retrieves relevant memories
3. **App Registry**: Associates memories with apps
4. **Central LLM Context**: Includes memory section

### Database Schema (Preview)

```sql
CREATE TABLE app_memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  conversation_id TEXT, -- Original conversation that created this memory
  FOREIGN KEY (app_id) REFERENCES apps(app_id)
);
```

## Success Metrics

### Quantitative

1. **Memory Utilization**: % of apps using memories (target: >80%)
2. **Context Relevance**: % of conversations where memories are referenced (target: >50%)
3. **Compaction Efficiency**: Average memory age before compaction (target: >7 days)
4. **System Performance**: No degradation in response time (target: <5% increase)

### Qualitative

1. **User Satisfaction**: Users report feeling the system "remembers" them
2. **Conversation Quality**: Fewer repetitive explanations needed
3. **System Intelligence**: Improved decision-making based on past context
4. **Developer Experience**: Easy to understand and debug memory behavior

## Risks and Mitigations

### Risk 1: Memory Quality

**Risk**: Sub-agent creates low-quality or irrelevant memories

**Mitigation**: 
- Careful prompt engineering for memory creation
- Test with diverse conversation types
- Monitor memory content in development
- Allow manual memory editing in future version

### Risk 2: Compaction Decisions

**Risk**: Important memories are deleted during compaction

**Mitigation**:
- Test compaction logic extensively
- Log all compaction decisions
- Provide memory recovery mechanism
- Allow apps to mark memories as "important"

### Risk 3: Privacy Concerns

**Risk**: Sensitive information stored in memories

**Mitigation**:
- Clear documentation on memory retention
- Admin purge capability
- Future: User-level memory controls
- Future: Automatic PII detection and redaction

### Risk 4: Performance Impact

**Risk**: Memory retrieval slows down conversations

**Mitigation**:
- Database indexes on app_id
- Limit to 10 memories per app
- Async memory creation (doesn't block responses)
- Monitor query performance

## Future Enhancements

### Phase 2 (Future)

1. **User-Level Memories**: Memories associated with specific users
2. **Cross-App Memories**: Shared memories across related apps
3. **Memory Search**: Query memories by content or date
4. **Memory Export**: Download memories for backup or analysis
5. **Memory Importance Scoring**: Automatic priority assignment

### Phase 3 (Future)

1. **Memory Embeddings**: Vector search for semantic memory retrieval
2. **Memory Summarization**: Hierarchical memory structure
3. **Memory Validation**: Fact-checking and conflict resolution
4. **Memory Sharing**: Opt-in memory sharing between users
5. **Memory Analytics**: Insights dashboard for memory usage

## Conclusion

The Memory Feature transforms the AI Effort Regulation system from a stateless conversation handler into an intelligent, context-aware assistant that learns and remembers. By introducing automatic memory creation, intelligent compaction, and app-scoped organization, we provide:

- **Better User Experience**: Continuity and personalization
- **Improved System Intelligence**: Context-aware decision making
- **Scalable Architecture**: Fixed limits and efficient storage
- **Foundation for Growth**: Extensible design for future enhancements

This feature is a critical step toward building a truly intelligent, adaptive AI system that users can trust and rely on over time.
