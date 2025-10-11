# Energy Budget - Quick Start Guide

## What is Energy Budget?

Energy budget is a **soft target** that guides how much computational effort the AI should spend on your request. Think of it as telling the AI whether you want a quick answer or a detailed analysis.

## When to Use Energy Budgets

### Zero Budget (0) - Emergency/Last Chance
Use when you need critical information immediately:
```bash
curl -X POST http://localhost:3005/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Server is down! What should I check?", "energyBudget": 0}'
```
**Result:** AI provides the most critical information in a single response.

### Low Budget (1-10) - Quick Questions
Use for simple factual questions:
```bash
curl -X POST http://localhost:3005/message \
  -H "Content-Type: application/json" \
  -d '{"content": "What is the capital of France?", "energyBudget": 5}'
```
**Result:** Concise, direct answer without elaboration.

### Medium Budget (11-30) - Standard Questions
Use for questions that need some detail:
```bash
curl -X POST http://localhost:3005/message \
  -H "Content-Type: application/json" \
  -d '{"content": "How does HTTPS work?", "energyBudget": 20}'
```
**Result:** Balanced response with key points covered.

### High Budget (31+) - Complex Analysis
Use for detailed explanations or analysis:
```bash
curl -X POST http://localhost:3005/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Compare microservices vs monolithic architecture", "energyBudget": 50}'
```
**Result:** Comprehensive, detailed response with multiple aspects covered.

### No Budget - Default Behavior
Omit the parameter for normal operation:
```bash
curl -X POST http://localhost:3005/message \
  -H "Content-Type: application/json" \
  -d '{"content": "Tell me about quantum computing"}'
```
**Result:** AI uses its default energy management strategy.

## Checking Budget Status

Get conversation details including budget info:
```bash
curl http://localhost:3005/conversations/{requestId}
```

Response includes:
```json
{
  "metadata": {
    "energyBudget": 50,
    "energyBudgetRemaining": 24.7,
    "budgetStatus": "within",
    "totalEnergyConsumed": 25.3
  }
}
```

## Budget Status Values

- **within** - Still under budget, can continue
- **exceeded** - Over budget, AI will try to wrap up
- **depleted** - Zero budget (last chance response)
- **null** - No budget was set

## Important Notes

### Soft Limit
The budget is a **soft target**, not a hard limit:
- AI can exceed budget if needed for quality
- Warnings shown when budget is low/exceeded
- Quality prioritized over strict adherence

### Zero Budget Special Case
Budget of 0 means "last chance":
- AI provides critical information immediately
- No follow-up responses expected
- Use for emergencies only

### Backward Compatible
- Existing code without `energyBudget` works unchanged
- No budget = default behavior
- All features work with or without budgets

## Examples by Use Case

### Quick Fact Check
```json
{"content": "What year did WWII end?", "energyBudget": 3}
```

### Troubleshooting Help
```json
{"content": "My Docker container won't start", "energyBudget": 25}
```

### Learning/Tutorial
```json
{"content": "Explain async/await in JavaScript", "energyBudget": 40}
```

### Emergency
```json
{"content": "Database is locked, what do I do?", "energyBudget": 0}
```

### Brainstorming
```json
{"content": "Ideas for improving our API performance", "energyBudget": 60}
```

## Testing the Feature

Run integration tests:
```bash
./run-budget-test.sh
```

This will test all budget scenarios automatically.

## Tips

1. **Start with no budget** to see default behavior
2. **Use low budgets** (5-10) for quick questions
3. **Use high budgets** (40-60) for complex topics
4. **Reserve zero budget** for true emergencies
5. **Monitor budget status** to understand consumption patterns

## Common Questions

**Q: What happens if I set the budget too low?**
A: The AI will do its best within the budget but can exceed it if necessary to provide a quality response.

**Q: Can I change the budget mid-conversation?**
A: No, budget is set when the conversation is created. Each new message creates a new conversation.

**Q: What's a good default budget?**
A: For most questions, 20-30 units provides good balance. Adjust based on complexity.

**Q: Does budget affect response quality?**
A: Budget guides effort level, but quality is always prioritized. Low budget = concise, high budget = detailed.

**Q: What if I don't specify a budget?**
A: The system uses default energy management with no constraints.
