import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { Inbox } from '../src/inbox';
import * as fs from 'fs';
import * as path from 'path';

let testCounter = 0;

describe('Approval System', () => {
  let inbox: Inbox;
  let currentTestDb: string;

  beforeEach(() => {
    // Use unique database for each test
    testCounter++;
    currentTestDb = path.join(process.cwd(), `test-approval-${testCounter}.db`);
    
    // Clean up if exists
    if (fs.existsSync(currentTestDb)) {
      fs.unlinkSync(currentTestDb);
    }
    
    // Create inbox with test database path
    inbox = new Inbox(currentTestDb);
  });

  afterEach(() => {
    // Close database and clean up
    if (inbox && (inbox as any).db) {
      try {
        (inbox as any).db.close();
      } catch (e) {
        // Ignore close errors
      }
    }
    
    if (fs.existsSync(currentTestDb)) {
      fs.unlinkSync(currentTestDb);
    }
  });

  describe('Database Schema', () => {
    it('should create approval columns in responses table', () => {
      const requestId = 'test-schema-001';
      inbox.addApprovalRequest(requestId, 'Test message', 'Test approval content', 50, 'test-model');
      
      const approvals = inbox.getAllApprovals(requestId);
      assert.strictEqual(approvals.length, 1);
      assert.ok(approvals[0]);
      assert.strictEqual(approvals[0]!.status, 'pending');
    });
  });

  describe('Approval Request Creation', () => {
    it('should create an approval request with pending status', () => {
      const requestId = 'test-approval-001';
      const userMessage = 'Should I delete the old logs?';
      const approvalContent = 'Yes, I will delete logs older than 30 days.';
      
      inbox.addApprovalRequest(requestId, userMessage, approvalContent, 75, 'llama3.2:3b');
      
      const pending = inbox.getPendingApprovals(requestId);
      assert.strictEqual(pending.length, 1);
      assert.ok(pending[0]);
      assert.strictEqual(pending[0]!.content, approvalContent);
      assert.strictEqual(pending[0]!.energyLevel, 75);
    });

    it('should create approval request with energy budget', () => {
      const requestId = 'test-approval-002';
      const userMessage = 'Analyze this dataset';
      const approvalContent = 'This will require 100 energy units. Proceed?';
      const energyBudget = 100;
      
      inbox.addApprovalRequest(requestId, userMessage, approvalContent, 60, 'llama3.2:3b', energyBudget);
      
      const conversation = inbox.getConversation(requestId);
      assert.strictEqual(conversation?.metadata.energyBudget, energyBudget);
      
      const pending = inbox.getPendingApprovals(requestId);
      assert.strictEqual(pending.length, 1);
    });
  });

  describe('Approval Status Updates', () => {
    it('should approve a pending approval request', () => {
      const requestId = 'test-approval-003';
      inbox.addApprovalRequest(requestId, 'Test', 'Approval content', 50, 'test-model');
      
      const pending = inbox.getPendingApprovals(requestId);
      assert.ok(pending[0]);
      const approvalId = pending[0]!.id;
      
      inbox.updateApprovalStatus(requestId, approvalId, 'approved', 'Looks good');
      
      const allApprovals = inbox.getAllApprovals(requestId);
      assert.ok(allApprovals[0]);
      assert.strictEqual(allApprovals[0]!.status, 'approved');
      assert.strictEqual(allApprovals[0]!.feedback, 'Looks good');
      assert.ok(allApprovals[0]!.approvalTimestamp);
    });

    it('should reject a pending approval request', () => {
      const requestId = 'test-approval-004';
      inbox.addApprovalRequest(requestId, 'Test', 'Approval content', 50, 'test-model');
      
      inbox.updateApprovalStatus(requestId, null, 'rejected', 'Not now');
      
      const allApprovals = inbox.getAllApprovals(requestId);
      assert.ok(allApprovals[0]);
      assert.strictEqual(allApprovals[0]!.status, 'rejected');
      assert.strictEqual(allApprovals[0]!.feedback, 'Not now');
    });

    it('should update latest pending approval when responseId is null', () => {
      const requestId = 'test-approval-005';
      inbox.addApprovalRequest(requestId, 'Test', 'First approval', 50, 'test-model');
      inbox.addApprovalRequest(requestId, 'Test', 'Second approval', 50, 'test-model');
      
      inbox.updateApprovalStatus(requestId, null, 'approved');
      
      const allApprovals = inbox.getAllApprovals(requestId);
      assert.ok(allApprovals[0]);
      assert.ok(allApprovals[1]);
      // Latest should be approved
      assert.strictEqual(allApprovals[0]!.status, 'approved');
      // First should still be pending
      assert.strictEqual(allApprovals[1]!.status, 'pending');
    });
  });

  describe('Budget Management', () => {
    it('should set energy budget for a conversation', () => {
      const requestId = 'test-budget-001';
      inbox.addResponse(requestId, 'Test message', 'Response', 50, 'test-model');
      
      inbox.setEnergyBudget(requestId, 150);
      
      const conversation = inbox.getConversation(requestId);
      assert.strictEqual(conversation?.metadata.energyBudget, 150);
    });

    it('should get remaining budget correctly', () => {
      const requestId = 'test-budget-002';
      inbox.addResponse(requestId, 'Test', '', 0, 'test-model', 100);
      inbox.addResponse(requestId, 'Test', 'Response 1', 30, 'test-model');
      inbox.addResponse(requestId, 'Test', 'Response 2', 20, 'test-model');
      
      const remaining = inbox.getRemainingBudget(requestId);
      assert.strictEqual(remaining, 50); // 100 - 30 - 20
    });

    it('should return correct budget status', () => {
      const requestId1 = 'test-budget-003';
      inbox.addResponse(requestId1, 'Test', '', 0, 'test-model', 100);
      inbox.addResponse(requestId1, 'Test', 'Response', 30, 'test-model');
      assert.strictEqual(inbox.getBudgetStatus(requestId1), 'within');
      
      const requestId2 = 'test-budget-004';
      inbox.addResponse(requestId2, 'Test', '', 0, 'test-model', 50);
      inbox.addResponse(requestId2, 'Test', 'Response', 60, 'test-model');
      assert.strictEqual(inbox.getBudgetStatus(requestId2), 'exceeded');
      
      const requestId3 = 'test-budget-005';
      inbox.addResponse(requestId3, 'Test', '', 0, 'test-model', 0);
      assert.strictEqual(inbox.getBudgetStatus(requestId3), 'depleted');
    });
  });

  describe('Approval Queries', () => {
    it('should get all pending approvals for a conversation', () => {
      const requestId = 'test-query-001';
      inbox.addApprovalRequest(requestId, 'Test', 'Approval 1', 50, 'test-model');
      inbox.addApprovalRequest(requestId, 'Test', 'Approval 2', 50, 'test-model');
      inbox.addApprovalRequest(requestId, 'Test', 'Approval 3', 50, 'test-model');
      
      // Approve one
      inbox.updateApprovalStatus(requestId, null, 'approved');
      
      const pending = inbox.getPendingApprovals(requestId);
      assert.strictEqual(pending.length, 2); // Two still pending
    });

    it('should get latest pending approval', () => {
      const requestId = 'test-query-002';
      inbox.addApprovalRequest(requestId, 'Test', 'Approval 1', 50, 'test-model');
      inbox.addApprovalRequest(requestId, 'Test', 'Approval 2', 50, 'test-model');
      inbox.addApprovalRequest(requestId, 'Test', 'Latest approval', 50, 'test-model');
      
      const latest = inbox.getLatestPendingApproval(requestId);
      assert.ok(latest);
      assert.strictEqual(latest.content, 'Latest approval');
    });

    it('should get all approvals regardless of status', () => {
      const requestId = 'test-query-003';
      inbox.addApprovalRequest(requestId, 'Test', 'Approval 1', 50, 'test-model');
      inbox.addApprovalRequest(requestId, 'Test', 'Approval 2', 50, 'test-model');
      inbox.addApprovalRequest(requestId, 'Test', 'Approval 3', 50, 'test-model');
      
      // Approve first
      const pending = inbox.getPendingApprovals(requestId);
      assert.ok(pending[2]);
      assert.ok(pending[1]);
      inbox.updateApprovalStatus(requestId, pending[2]!.id, 'approved');
      
      // Reject second
      inbox.updateApprovalStatus(requestId, pending[1]!.id, 'rejected');
      
      const allApprovals = inbox.getAllApprovals(requestId);
      assert.strictEqual(allApprovals.length, 3);
      
      const statuses = allApprovals.map(a => a.status).sort();
      assert.deepStrictEqual(statuses, ['approved', 'pending', 'rejected']);
    });
  });

  describe('Integration with Regular Responses', () => {
    it('should allow both regular responses and approval requests in same conversation', () => {
      const requestId = 'test-integration-001';
      
      // Regular response
      inbox.addResponse(requestId, 'User message', 'Regular response', 50, 'test-model');
      
      // Approval request
      inbox.addApprovalRequest(requestId, 'User message', 'Approval request', 50, 'test-model');
      
      // Another regular response
      inbox.addResponse(requestId, 'User message', 'Another response', 50, 'test-model');
      
      const conversation = inbox.getConversation(requestId);
      assert.strictEqual(conversation?.responses.length, 3);
      
      const approvals = inbox.getAllApprovals(requestId);
      assert.strictEqual(approvals.length, 1);
    });
  });
});
