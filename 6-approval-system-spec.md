# Approval System Specification

## Overview

This specification defines an approval system that allows the AI to request user approval before executing certain actions or responses. The system integrates with the existing energy budget mechanism to track approval-related energy consumption.

## Goals

- Enable AI to mark responses as requiring user approval
- Allow users to approve or reject AI responses
- Support budget constraints in approval requests and responses
- Track approval status in conversation history
- Provide clear API for approval workflow

## Core Concepts

### Approval Request

An **approval request** is a response from the AI that requires explicit user confirmation before being considered final. The AI marks a response as requiring approval using a tool call.

**Properties:**
- `requestId`: The conversation ID
- `content`: The proposed response content
- `requiresApproval`: Boolean flag (true)
- `approvalStatus`: One of `pending`, `approved`, `rejected`
- `energyBudget`: Optional energy budget for the approval workflow

### Approval Response

An **approval response** is a user message that approves or rejects a pending approval request. Users can also modify the energy budget in their approval response.

**Properties:**
- `requestId`: The conversation ID being responded to
- `approved`: Boolean indicating approval/rejection
- `newBudget`: Optional new energy budget value
- `budgetChange`: Optional delta to add/subtract from current budget
- `feedback`: Optional user feedback/comments

## Database Schema Changes

### Responses Table

Add columns to track approval status:

```sql
ALTER TABLE responses ADD COLUMN requires_approval BOOLEAN DEFAULT FALSE;
ALTER TABLE responses ADD COLUMN approval_status TEXT DEFAULT NULL; -- 'pending', 'approved', 'rejected'
ALTER TABLE responses ADD COLUMN approval_timestamp DATETIME DEFAULT NULL;
ALTER TABLE responses ADD COLUMN approval_feedback TEXT DEFAULT NULL;
```

### Conversations Table

No changes needed - existing `energy_budget` column supports budget updates.

## Tool Definitions

### 1. respond_with_approval

Request user approval for a response before finalizing it.

```typescript
{
  name: 'respond_with_approval',
  description: 'Send a response that requires user approval before being finalized. Use this when you want to propose an action or response that should be reviewed by the user first.',
  parameters: {
    requestId: string,      // Conversation UUID
    content: string,        // Proposed response content
    energyBudget?: number   // Optional: suggested energy budget for approval workflow
  }
}
```

### 2. set_budget

Set or update the energy budget for a conversation.

```typescript
{
  name: 'set_budget',
  description: 'Set or update the energy budget for a conversation. This can be used to allocate more/less energy based on task complexity.',
  parameters: {
    requestId: string,      // Conversation UUID
    budget: number          // New budget value (must be >= 0)
  }
}
```

### 3. adjust_budget

Adjust the energy budget by a delta amount.

```typescript
{
  name: 'adjust_budget',
  description: 'Adjust the energy budget for a conversation by adding or subtracting energy units.',
  parameters: {
    requestId: string,      // Conversation UUID
    delta: number           // Amount to add (positive) or subtract (negative)
  }
}
```

## API Endpoints

### POST /message

**Extended Request Body:**
```json
{
  "content": "string",
  "id": "optional-uuid",
  "energyBudget": "optional-number",
  "approvalResponse": {
    "approved": "boolean",
    "newBudget": "optional-number",
    "budgetChange": "optional-number",
    "feedback": "optional-string"
  }
}
```

**Behavior:**
- If `approvalResponse` is present, the system treats this as an approval response
- The system finds the most recent pending approval request for this conversation
- Updates the approval status based on `approved` flag
- Applies budget changes if specified
- Continues conversation based on approval outcome

### GET /conversations/:requestId/approvals

Get all approval requests and their status for a conversation.

**Response:**
```json
{
  "requestId": "uuid",
  "approvals": [
    {
      "id": "response-id",
      "content": "proposed response",
      "timestamp": "ISO-8601",
      "status": "pending|approved|rejected",
      "approvalTimestamp": "ISO-8601 or null",
      "feedback": "user feedback or null"
    }
  ]
}
```

### POST /conversations/:requestId/approve

Approve a pending approval request.

**Request Body:**
```json
{
  "responseId": "optional-specific-response-id",  // If omitted, approves latest pending
  "feedback": "optional-feedback-string",
  "newBudget": "optional-number",
  "budgetChange": "optional-number"
}
```

**Response:**
```json
{
  "status": "approved",
  "responseId": "uuid",
  "budgetUpdated": "boolean",
  "newBudget": "number or null"
}
```

### POST /conversations/:requestId/reject

Reject a pending approval request.

**Request Body:**
```json
{
  "responseId": "optional-specific-response-id",
  "feedback": "optional-feedback-string"
}
```

**Response:**
```json
{
  "status": "rejected",
  "responseId": "uuid"
}
```

## Workflow Examples

### Example 1: Simple Approval Request

1. User sends message: "Should I delete the old logs?"
2. AI responds with approval request:
   ```typescript
   respond_with_approval({
     requestId: "abc-123",
     content: "Yes, I'll delete logs older than 30 days. This will free up approximately 2GB of space."
   })
   ```
3. System saves response with `requires_approval: true`, `approval_status: 'pending'`
4. User approves via API or new message:
   ```json
   POST /message
   {
     "content": "approved",
     "id": "abc-123",
     "approvalResponse": { "approved": true }
   }
   ```
5. System updates approval status to `approved`
6. AI can proceed with the action

### Example 2: Approval with Budget Adjustment

1. User sends message: "Analyze this large dataset" (budget: 50 units)
2. AI responds:
   ```typescript
   respond_with_approval({
     requestId: "def-456",
     content: "This analysis will require approximately 100 energy units. Should I proceed?",
     energyBudget: 100
   })
   ```
3. User approves with budget increase:
   ```json
   POST /message
   {
     "content": "yes, go ahead",
     "id": "def-456",
     "approvalResponse": {
       "approved": true,
       "newBudget": 100
     }
   }
   ```
4. System updates budget to 100 and approval status to `approved`

### Example 3: User-Initiated Budget Change

1. User sends message with budget change:
   ```json
   POST /message
   {
     "content": "I need more detailed analysis",
     "id": "ghi-789",
     "approvalResponse": {
       "budgetChange": 50  // Add 50 units to current budget
     }
   }
   ```
2. System increases budget by 50 units
3. AI receives notification of budget increase and can provide more detailed response

## System Message Updates

The system message to the AI should include information about approval capabilities:

```
Approval System:
- Use respond_with_approval when proposing actions that need user confirmation
- Use set_budget to establish or update energy budgets for conversations
- Use adjust_budget to incrementally modify budgets
- When a user approves/rejects, you'll receive feedback in the conversation context
- Approval requests consume energy but are reversible if rejected
```

## Energy Tracking

### Approval Request Energy

- Creating an approval request consumes energy like a normal response
- Energy is tracked against the conversation's budget
- If rejected, the energy is still consumed (represents thinking/planning cost)

### Budget Updates

- Users can set new budgets at any time via `newBudget` parameter
- Users can adjust budgets incrementally via `budgetChange` parameter
- Budget changes take effect immediately
- Negative budgets are not allowed (minimum: 0)

## Inbox and Loop Integration

### Inbox Changes

Add methods:
- `addApprovalRequest(requestId, content, energyLevel, modelUsed, energyBudget?)`
- `updateApprovalStatus(requestId, responseId, status, feedback?)`
- `getPendingApprovals(requestId)` - Get all pending approvals for a conversation
- `getLatestPendingApproval(requestId)` - Get most recent pending approval

### Loop Changes

1. **Approval Request Handling:**
   - When AI calls `respond_with_approval`, create response with approval flag
   - Mark conversation as awaiting approval
   - Don't remove from pending until approval received

2. **Approval Response Detection:**
   - Check incoming messages for approval indicators
   - Parse approval response data
   - Update approval status in database
   - Apply budget changes if specified
   - Continue conversation based on approval outcome

3. **Context Inclusion:**
   - Include pending approval status in ephemeral system message
   - Show approval history in conversation context
   - Indicate when waiting for approval

## Testing Requirements

### Unit Tests

1. **Database Operations:**
   - Add approval request
   - Update approval status
   - Query pending approvals
   - Budget updates via approval

2. **Tool Execution:**
   - `respond_with_approval` creates proper database entry
   - `set_budget` updates conversation budget
   - `adjust_budget` modifies budget correctly

3. **API Endpoints:**
   - POST /message with approval response
   - GET /conversations/:id/approvals
   - POST /conversations/:id/approve
   - POST /conversations/:id/reject

### Integration Tests

1. **Approval Workflow:**
   - AI requests approval
   - User approves
   - Conversation continues

2. **Rejection Workflow:**
   - AI requests approval
   - User rejects
   - AI handles rejection appropriately

3. **Budget Management:**
   - User sets initial budget
   - AI requests more budget via approval
   - User approves with budget increase
   - AI completes task within new budget

4. **Multiple Approvals:**
   - Multiple approval requests in same conversation
   - Approve some, reject others
   - Track status correctly

## Implementation Notes

### Backward Compatibility

- Existing conversations without approval features continue to work
- `requires_approval` defaults to `false` for all existing responses
- Budget management works independently of approval system

### Error Handling

- Invalid approval responses (no pending approval) return clear error
- Budget values must be non-negative
- Approval status transitions are validated (pending → approved/rejected only)

### Performance Considerations

- Index on `approval_status` for efficient pending approval queries
- Limit approval history queries to recent items
- Cache pending approval status to avoid repeated queries

## Future Enhancements

1. **Approval Timeouts:** Auto-reject approvals after specified time
2. **Approval Templates:** Pre-defined approval workflows for common tasks
3. **Multi-step Approvals:** Chain of approvals for complex operations
4. **Approval Delegation:** Allow AI to auto-approve certain low-risk actions
5. **Approval Analytics:** Track approval rates, common rejections, etc.
