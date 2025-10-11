import { Inbox } from '../src/inbox';
import * as fs from 'fs';
import * as path from 'path';

describe('Energy Budget Database Tests', () => {
  let inbox: Inbox;
  const testDbPath = path.join(process.cwd(), 'test-conversations.db');

  beforeEach(() => {
    // Remove test database if it exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    // Temporarily change DB path for testing
    process.env.TEST_DB = 'true';
    inbox = new Inbox();
  });

  afterEach(() => {
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test('should create conversation with energy budget', () => {
    const requestId = 'test-budget-1';
    const budget = 50;

    inbox.addResponse(requestId, 'Test message', 'Test response', 100, 'test-model', budget);

    const conversation = inbox.getConversation(requestId);
    expect(conversation).not.toBeNull();
    expect(conversation?.metadata.energyBudget).toBe(budget);
  });

  test('should create conversation without energy budget', () => {
    const requestId = 'test-no-budget';

    inbox.addResponse(requestId, 'Test message', 'Test response', 100, 'test-model');

    const conversation = inbox.getConversation(requestId);
    expect(conversation).not.toBeNull();
    expect(conversation?.metadata.energyBudget).toBeUndefined();
  });

  test('should calculate remaining budget correctly', () => {
    const requestId = 'test-remaining';
    const budget = 100;

    // Create conversation with budget
    inbox.addResponse(requestId, 'Test message', 'Response 1', 100, 'test-model', budget);
    
    // Add more responses to consume energy
    inbox.addResponse(requestId, '', 'Response 2', 80, 'test-model');
    inbox.addResponse(requestId, '', 'Response 3', 60, 'test-model');

    const conversation = inbox.getConversation(requestId);
    expect(conversation).not.toBeNull();
    expect(conversation?.metadata.energyBudget).toBe(budget);
    
    // Total consumed should be sum of energy levels passed to updateConversationStmt
    // which gets the energyLevel parameter from each addResponse call
    const totalConsumed = conversation?.metadata.totalEnergyConsumed || 0;
    const remaining = conversation?.metadata.energyBudgetRemaining || 0;
    
    expect(remaining).toBe(budget - totalConsumed);
  });

  test('should handle zero budget correctly', () => {
    const requestId = 'test-zero-budget';
    const budget = 0;

    inbox.addResponse(requestId, 'Urgent message', 'Urgent response', 95, 'test-model', budget);

    const conversation = inbox.getConversation(requestId);
    expect(conversation).not.toBeNull();
    expect(conversation?.metadata.energyBudget).toBe(0);
    expect(conversation?.metadata.budgetStatus).toBe('depleted');
  });

  test('should set budget status to "within" when under budget', () => {
    const requestId = 'test-within-budget';
    const budget = 100;

    inbox.addResponse(requestId, 'Test message', 'Test response', 90, 'test-model', budget);

    const conversation = inbox.getConversation(requestId);
    expect(conversation?.metadata.budgetStatus).toBe('within');
  });

  test('should set budget status to "exceeded" when over budget', () => {
    const requestId = 'test-exceeded-budget';
    const budget = 10;

    // Create conversation
    inbox.addResponse(requestId, 'Test message', 'Response 1', 80, 'test-model', budget);
    
    // Add more responses to exceed budget
    inbox.addResponse(requestId, '', 'Response 2', 70, 'test-model');
    inbox.addResponse(requestId, '', 'Response 3', 60, 'test-model');

    const conversation = inbox.getConversation(requestId);
    const remaining = conversation?.metadata.energyBudgetRemaining || 0;
    
    if (remaining <= 0) {
      expect(conversation?.metadata.budgetStatus).toBe('exceeded');
    }
  });

  test('should update budget via setEnergyBudget', () => {
    const requestId = 'test-set-budget';

    // Create conversation without budget
    inbox.addResponse(requestId, 'Test message', 'Test response', 100, 'test-model');

    // Set budget
    inbox.setEnergyBudget(requestId, 75);

    const conversation = inbox.getConversation(requestId);
    expect(conversation?.metadata.energyBudget).toBe(75);
  });

  test('should get remaining budget via getRemainingBudget', () => {
    const requestId = 'test-get-remaining';
    const budget = 50;

    inbox.addResponse(requestId, 'Test message', 'Test response', 90, 'test-model', budget);

    const remaining = inbox.getRemainingBudget(requestId);
    expect(remaining).not.toBeNull();
    expect(typeof remaining).toBe('number');
  });

  test('should return null for remaining budget when no budget set', () => {
    const requestId = 'test-no-budget-remaining';

    inbox.addResponse(requestId, 'Test message', 'Test response', 100, 'test-model');

    const remaining = inbox.getRemainingBudget(requestId);
    expect(remaining).toBeNull();
  });

  test('should get correct budget status via getBudgetStatus', () => {
    const requestId = 'test-budget-status';
    const budget = 50;

    inbox.addResponse(requestId, 'Test message', 'Test response', 90, 'test-model', budget);

    const status = inbox.getBudgetStatus(requestId);
    expect(status).toBe('within');
  });

  test('should return null budget status when no budget set', () => {
    const requestId = 'test-no-budget-status';

    inbox.addResponse(requestId, 'Test message', 'Test response', 100, 'test-model');

    const status = inbox.getBudgetStatus(requestId);
    expect(status).toBeNull();
  });

  test('should handle negative remaining budget', () => {
    const requestId = 'test-negative-remaining';
    const budget = 5;

    // Consume more than budget
    inbox.addResponse(requestId, 'Test message', 'Response 1', 50, 'test-model', budget);
    inbox.addResponse(requestId, '', 'Response 2', 40, 'test-model');

    const conversation = inbox.getConversation(requestId);
    const remaining = conversation?.metadata.energyBudgetRemaining || 0;
    
    expect(remaining).toBeLessThan(0);
    expect(conversation?.metadata.budgetStatus).toBe('exceeded');
  });

  test('should persist budget across multiple operations', () => {
    const requestId = 'test-persist-budget';
    const budget = 100;

    // Create with budget
    inbox.addResponse(requestId, 'Test message', 'Response 1', 90, 'test-model', budget);

    // Add more responses
    inbox.addResponse(requestId, '', 'Response 2', 80, 'test-model');
    inbox.addResponse(requestId, '', 'Response 3', 70, 'test-model');

    // Budget should still be there
    const conversation = inbox.getConversation(requestId);
    expect(conversation?.metadata.energyBudget).toBe(budget);
  });
});
