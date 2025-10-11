# Energy Budget Feature Specification

## Overview

This specification extends the AI Effort Regulation system to allow users to submit messages with an **energy budget** - a soft target that guides the LLM's energy management for that specific conversation.

## Background

The system currently tracks energy consumption per conversation (stored in `conversations.total_energy_consumed`), but users have no way to provide guidance on how much energy they want the AI to spend on their request.

## Goals

1. Allow users to specify an energy budget when submitting messages
2. Provide the LLM with budget information to guide its response strategy
3. Handle edge cases (zero budget, exceeded budget, etc.)
4. Maintain backward compatibility with existing API

## Use Cases

### Use Case 1: Quick Question (Low Budget)
```json
POST /message
{
  "content": "What's the capital of France?",
  "energyBudget": 5
}
```
**Expected behavior**: AI provides a concise, direct answer without elaboration.

### Use Case 2: Complex Analysis (High Budget)
```json
POST /message
{
  "content": "Analyze the pros and cons of microservices architecture",
  "energyBudget": 50
}
```
**Expected behavior**: AI provides detailed analysis, potentially multiple responses with thorough coverage.

### Use Case 3: Zero Budget (Last Chance)
```json
POST /message
{
  "content": "Emergency: server is down, what should I check?",
  "energyBudget": 0
}
```
**Expected behavior**: AI is told this is its last chance to respond. Should provide critical information immediately.

### Use Case 4: No Budget Specified (Default)
```json
POST /message
{
  "content": "Tell me about quantum computing"
}
```
**Expected behavior**: AI uses default behavior (no budget constraint).

## Technical Design

### 1. Database Schema Changes

Add new columns to the `conversations` table:

```sql
ALTER TABLE conversations ADD COLUMN energy_budget INTEGER DEFAULT NULL;
ALTER TABLE conversations ADD COLUMN energy_budget_remaining REAL DEFAULT NULL;
```

- `energy_budget`: The initial budget specified by the user (NULL if not specified)
- `energy_budget_remaining`: Calculated field showing remaining budget (updated as energy is consumed)

### 2. API Changes

#### POST /message Endpoint

**Request Schema**:
```typescript
interface MessageRequest {
  content: string;           // Required: user message
  id?: string;              // Optional: conversation ID
  energyBudget?: number;    // Optional: energy budget (soft target)
}
```

**Validation Rules**:
- `energyBudget` must be a number >= 0 if provided
- `energyBudget` can be omitted (null/undefined) for default behavior
- `energyBudget` of 0 is valid and has special meaning

**Response Schema** (unchanged):
```typescript
interface MessageResponse {
  status: 'received';
  requestId: string;
  timestamp: string;
}
```

#### GET /conversations/:requestId

**Enhanced Response**:
```typescript
interface ConversationData {
  requestId: string;
  inputMessage: string;
  responses: Array<{
    timestamp: string;
    content: string;
    energyLevel: number;
    modelUsed: string;
  }>;
  metadata: {
    totalEnergyConsumed: number;
    sleepCycles: number;
    energyBudget?: number;           // NEW: initial budget
    energyBudgetRemaining?: number;  // NEW: remaining budget
    budgetStatus?: 'within' | 'exceeded' | 'depleted';  // NEW
  };
  ended?: boolean;
  endedReason?: string;
}
```

### 3. Server Changes (`src/server.ts`)

**Modifications**:
1. Accept `energyBudget` in POST /message request body
2. Validate `energyBudget` is a valid number >= 0
3. Store budget in database when creating conversation
4. Pass budget information to inbox

**Validation Logic**:
```typescript
// Validate energyBudget if provided
if (energyBudget !== undefined && energyBudget !== null) {
  if (typeof energyBudget !== 'number' || isNaN(energyBudget) || energyBudget < 0) {
    res.status(400).json({
      error: 'energyBudget must be a non-negative number'
    });
    return;
  }
}
```

### 4. Inbox Changes (`src/inbox.ts`)

**New Methods**:
```typescript
// Set energy budget for a conversation
setEnergyBudget(requestId: string, budget: number): void

// Get remaining budget for a conversation
getRemainingBudget(requestId: string): number | null

// Update budget remaining after energy consumption
updateBudgetRemaining(requestId: string): void
```

**Modified Methods**:
- `addResponse()`: Update budget remaining after adding response
- `getConversation()`: Include budget information in returned data

**Budget Calculation**:
```typescript
energyBudgetRemaining = energyBudget - totalEnergyConsumed
```

### 5. Loop Changes (`src/loop.ts`)

**System Message Enhancement**:

Add budget awareness to the system message:

```typescript
Energy Budget Management:
- Some conversations may have an energy budget (soft target)
- Budget of 0 means this is your LAST CHANCE to respond - make it count
- Budget > 0 means aim to stay within that energy allocation
- No budget means use your normal energy management strategy
- Budget is a SOFT target - you can exceed it if necessary, but try to be efficient
```

**Ephemeral Message Enhancement**:

Include budget information in the ephemeral system message:

```typescript
private getEphemeralSystemMessage(...) {
  // ... existing code ...
  
  // Add budget information if conversation has a budget
  if (targetConversation && conversation.energyBudget !== null) {
    const remaining = conversation.energyBudget - conversation.totalEnergyConsumed;
    
    if (conversation.energyBudget === 0) {
      message += `\n⚠️ CRITICAL: This conversation has ZERO energy budget. This is your LAST CHANCE to respond. Make it count!`;
    } else if (remaining <= 0) {
      message += `\n⚠️ Budget exceeded: Started with ${conversation.energyBudget} units, consumed ${conversation.totalEnergyConsumed} units. Try to wrap up efficiently.`;
    } else if (remaining < conversation.energyBudget * 0.2) {
      message += `\n⚡ Budget running low: ${remaining.toFixed(1)} of ${conversation.energyBudget} units remaining (${((remaining/conversation.energyBudget)*100).toFixed(0)}%)`;
    } else {
      message += `\n💰 Energy budget: ${remaining.toFixed(1)} of ${conversation.energyBudget} units remaining`;
    }
  }
  
  return { role: 'user', content: message };
}
```

**Budget Tracking**:
- Update budget remaining after each response
- Log budget status in console output
- Consider budget when selecting conversations to work on

### 6. Conversation Selection Logic

**Priority Adjustment**:

Conversations with budgets should be prioritized based on:
1. Zero budget conversations (highest priority - last chance)
2. Conversations with remaining budget > 0
3. Conversations with exceeded budget (lower priority)
4. Conversations without budget (normal priority)

**Implementation**:
```typescript
private prioritizeConversations(conversations: ConversationData[]): ConversationData[] {
  return conversations.sort((a, b) => {
    // Zero budget = highest priority
    if (a.metadata.energyBudget === 0) return -1;
    if (b.metadata.energyBudget === 0) return 1;
    
    // Has budget and within budget = high priority
    const aRemaining = a.metadata.energyBudgetRemaining ?? Infinity;
    const bRemaining = b.metadata.energyBudgetRemaining ?? Infinity;
    
    if (aRemaining > 0 && bRemaining <= 0) return -1;
    if (bRemaining > 0 && aRemaining <= 0) return 1;
    
    // Both have budget - prioritize by remaining budget
    if (aRemaining !== Infinity && bRemaining !== Infinity) {
      return bRemaining - aRemaining; // More remaining = higher priority
    }
    
    // Default: chronological order
    return 0;
  });
}
```

## Behavioral Specifications

### Budget Interpretation

**Zero Budget (energyBudget: 0)**:
- Treated as "last chance to respond"
- AI should provide the most critical/important information immediately
- No follow-up responses expected
- Should end conversation after responding

**Low Budget (1-10 units)**:
- Concise, focused responses
- Avoid elaboration
- Single response preferred
- Use smaller model if available

**Medium Budget (11-30 units)**:
- Balanced responses
- Can provide some detail
- 1-2 responses acceptable

**High Budget (31+ units)**:
- Detailed, comprehensive responses
- Multiple responses acceptable
- Can use larger model
- Can add follow-up thoughts

**No Budget (null/undefined)**:
- Default behavior
- No special constraints
- Normal energy management

### Budget Exceeded Behavior

When `totalEnergyConsumed > energyBudget`:
- Continue responding if necessary (soft limit)
- Inform LLM that budget is exceeded
- Suggest wrapping up the conversation
- Don't automatically end conversation

### Budget Tracking

- Budget is tracked per conversation (not globally)
- Budget remaining = `energyBudget - totalEnergyConsumed`
- Budget includes all energy: thinking, responding, tool calls
- Budget persists across conversation lifecycle

## Edge Cases

### Edge Case 1: Budget Exhausted Mid-Response
**Scenario**: Budget runs out while generating a response
**Behavior**: Complete the current response, then inform LLM budget is exhausted

### Edge Case 2: Negative Budget
**Scenario**: User submits `energyBudget: -5`
**Behavior**: Reject with 400 error: "energyBudget must be a non-negative number"

### Edge Case 3: Very Large Budget
**Scenario**: User submits `energyBudget: 1000000`
**Behavior**: Accept and process normally (no upper limit)

### Edge Case 4: Budget on Existing Conversation
**Scenario**: User sends new message to existing conversation with different budget
**Behavior**: Budget is set once when conversation is created, subsequent messages don't change it

### Edge Case 5: Zero Budget with Complex Question
**Scenario**: User asks complex question with zero budget
**Behavior**: AI provides best possible answer in single response, acknowledging limitation

## Testing Requirements

### Unit Tests

1. **Database Tests** (`test/energy-budget-db.test.ts`):
   - Add conversation with budget
   - Update budget remaining
   - Retrieve budget information
   - Handle null budgets

2. **API Tests** (`test/energy-budget-api.test.ts`):
   - POST /message with valid budget
   - POST /message with zero budget
   - POST /message with negative budget (should fail)
   - POST /message with non-numeric budget (should fail)
   - GET /conversations/:id returns budget info

3. **Inbox Tests** (`test/energy-budget-inbox.test.ts`):
   - setEnergyBudget()
   - getRemainingBudget()
   - updateBudgetRemaining()
   - Budget calculation accuracy

### Integration Tests

1. **Zero Budget Test** (`test/scenarios/zero-budget.ts`):
   - Send message with energyBudget: 0
   - Verify AI responds immediately
   - Verify conversation ends after response
   - Verify response is concise but useful

2. **Low Budget Test** (`test/scenarios/low-budget.ts`):
   - Send message with energyBudget: 5
   - Verify AI stays within budget
   - Verify response is concise
   - Verify budget tracking is accurate

3. **High Budget Test** (`test/scenarios/high-budget.ts`):
   - Send message with energyBudget: 50
   - Verify AI can use full budget
   - Verify detailed responses
   - Verify budget tracking

4. **Budget Exceeded Test** (`test/scenarios/budget-exceeded.ts`):
   - Send message with energyBudget: 3
   - Ask complex question requiring more energy
   - Verify AI can exceed budget if needed
   - Verify AI is informed of budget status

5. **No Budget Test** (`test/scenarios/no-budget.ts`):
   - Send message without energyBudget
   - Verify default behavior
   - Verify no budget constraints applied

### Success Criteria

- All unit tests pass
- All integration tests pass
- API correctly validates budget parameter
- Database correctly stores and retrieves budget
- LLM receives accurate budget information
- Budget tracking is accurate (±1 energy unit)
- Zero budget conversations are handled appropriately
- Backward compatibility maintained (no budget = default behavior)

## Implementation Checklist

- [ ] Database migration for new columns
- [ ] Update `Message` interface in server.ts
- [ ] Add budget validation in POST /message
- [ ] Implement `setEnergyBudget()` in Inbox
- [ ] Implement `getRemainingBudget()` in Inbox
- [ ] Implement `updateBudgetRemaining()` in Inbox
- [ ] Update `addResponse()` to track budget
- [ ] Update `getConversation()` to return budget info
- [ ] Enhance system message with budget guidance
- [ ] Enhance ephemeral message with budget status
- [ ] Implement conversation prioritization by budget
- [ ] Add console logging for budget status
- [ ] Write unit tests for database
- [ ] Write unit tests for API
- [ ] Write unit tests for Inbox
- [ ] Write integration test: zero budget
- [ ] Write integration test: low budget
- [ ] Write integration test: high budget
- [ ] Write integration test: budget exceeded
- [ ] Write integration test: no budget
- [ ] Update API documentation
- [ ] Update README with budget examples

## Future Enhancements (Out of Scope)

- Budget pooling across multiple conversations
- Dynamic budget adjustment based on conversation complexity
- Budget recommendations based on question type
- Budget analytics and reporting
- User-specific budget limits
- Budget presets (quick, normal, detailed)
