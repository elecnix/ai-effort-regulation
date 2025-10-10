# AI Effort Regulation Testing Guide

## Overview

This testing framework validates the AI's energy regulation behavior and conversation management patterns. It uses automated scenarios to test whether the system converges to stable energy patterns and manages conversations appropriately.

## Prerequisites

1. **Ollama**: Ensure Ollama is installed and running
2. **Models**: Install required models:
   ```bash
   ollama pull gemma:2b
   ollama pull gemma:7b
   ```
3. **Server**: Start the AI regulation server:
   ```bash
   npm start
   ```

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Suites
```bash
npm run test:simple        # Basic conversation tests
npm run test:brainstorm    # Long-running conversation tests
npm run test:snooze        # Future action/snooze tests
npm run test:priorities    # Multiple priority balancing tests
```

### Analyzing Results
After running tests, analyze the results for patterns and get prompt improvement suggestions:
```bash
npm run test:analyze
```

## Test Scenarios

### 1. Simple Conversations
- **Purpose**: Test basic greeting and response patterns
- **Expected Behavior**: 
  - AI responds appropriately to greetings
  - Energy remains stable (not constantly at 0%)
  - Conversation snoozes with exponential backoff if user doesn't respond

### 2. Brainstorming Sessions
- **Purpose**: Test sustained engagement with explicit continuation requests
- **Expected Behavior**:
  - AI provides multiple responses over time
  - Recognizes one-sided conversations
  - Eventually snoozes or terminates when user engagement drops

### 3. Snooze Feature
- **Purpose**: Test future action scheduling
- **Expected Behavior**:
  - AI acknowledges future action requests
  - Snoozes conversation for specified time
  - Reactivates at the right time to perform action

### 4. Priority Balancing
- **Purpose**: Test handling of multiple simultaneous requests
- **Expected Behavior**:
  - System prioritizes based on urgency
  - Energy distributed appropriately across tasks
  - Conversations managed based on importance

## Configuration

Edit `test/config.json` to customize:

```json
{
  "models": ["gemma:2b", "gemma:7b"],  // Models to use
  "energyTargets": {
    "convergence": 50,      // Target energy level
    "tolerance": 20         // Acceptable variance
  },
  "timeouts": {
    "conversation": 1800,   // Max conversation duration (seconds)
    "snooze": 300          // Snooze test duration
  }
}
```

## Understanding Test Results

### Success Criteria

✅ **Good Results**:
- Average energy: 50-80%
- Energy convergence: Yes
- Conversation handling: Good
- Low error rate

❌ **Poor Results**:
- Average energy: <30% or constantly at 0%
- Energy convergence: No
- Conversation handling: Poor (not ending/snoozing)
- High error rate

### Test Reports

Reports are saved in `test-reports/` directory:
- Individual test reports: `{scenario-name}_{timestamp}.json`
- Summary report: `summary_{timestamp}.json`
- Markdown summary: `summary_{timestamp}.md`
- Prompt suggestions: `prompt-suggestions.md`

## Troubleshooting

### Common Issues

1. **Server not running**
   - Error: "Server is not running or not healthy!"
   - Solution: Start the server with `npm start`

2. **Models not installed**
   - Error: Model errors from Ollama
   - Solution: Install required models with `ollama pull gemma:2b`

3. **Energy constantly at 0%**
   - Issue: Model consuming too much energy
   - Solution: Adjust replenishment rate or review prompt suggestions

4. **Conversations never ending**
   - Issue: Poor conversation management
   - Solution: Review snooze/end conversation logic in prompts

## Interpreting Analysis Results

The `npm run test:analyze` command provides:

1. **Pattern Analysis**: Overall system behavior patterns
2. **Prompt Suggestions**: Specific improvements to system prompts
3. **Stability Scores**: How consistent the energy levels are
4. **Convergence Rates**: How well the system maintains target energy

## Best Practices

1. **Run tests regularly** after prompt or logic changes
2. **Start with simple tests** before running complex scenarios
3. **Review prompt suggestions** from analysis to improve behavior
4. **Monitor energy patterns** to ensure sustainable operation
5. **Check conversation endings** to prevent resource waste

## Example Workflow

1. Start the server:
   ```bash
   npm start
   ```

2. Run simple tests first:
   ```bash
   npm run test:simple
   ```

3. If successful, run all tests:
   ```bash
   npm test
   ```

4. Analyze results:
   ```bash
   npm run test:analyze
   ```

5. Apply suggested prompt improvements if needed

6. Re-run tests to verify improvements

## Contributing

When adding new test scenarios:

1. Create a new scenario file in `test/scenarios/`
2. Define clear expected behaviors
3. Add appropriate energy checkpoints
4. Update this guide with the new scenario

## Notes

- Tests use small models (gemma:2b) by default for speed
- Each test suite takes 5-30 minutes depending on scenarios
- Energy convergence is key - the system should find balance
- Snooze functionality is critical for resource management
