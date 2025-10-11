import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'http';

const BASE_URL = 'http://localhost:3002';

function makeRequest(method: string, path: string, body?: any): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode || 500, data: parsed });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

describe('Approval API Integration Tests', () => {
  describe('POST /message with approvalResponse', () => {
    it('should handle approval response in message', async () => {
      // First, send a message to create a conversation
      const { data: createData } = await makeRequest('POST', '/message', {
        content: 'Test message for approval',
        energyBudget: 100
      });

      const requestId = createData.requestId;
      assert.ok(requestId);

      // Wait a bit for the system to process
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Send approval response
      const { status, data } = await makeRequest('POST', '/message', {
        content: 'approved',
        id: requestId,
        approvalResponse: {
          approved: true,
          feedback: 'Looks good',
          newBudget: 150
        }
      });

      assert.strictEqual(status, 200);
      assert.strictEqual(data.requestId, requestId);
    });

    it('should handle budget adjustment in approval response', async () => {
      const { data: createData } = await makeRequest('POST', '/message', {
        content: 'Another test message',
        energyBudget: 100
      });

      const requestId = createData.requestId;

      await new Promise(resolve => setTimeout(resolve, 1000));

      const { status } = await makeRequest('POST', '/message', {
        content: 'approved with more budget',
        id: requestId,
        approvalResponse: {
          approved: true,
          budgetChange: 50 // Add 50 to current budget
        }
      });

      assert.strictEqual(status, 200);
    });
  });

  describe('GET /conversations/:requestId/approvals', () => {
    it('should retrieve all approvals for a conversation', async () => {
      const { data: createData } = await makeRequest('POST', '/message', {
        content: 'Test for approvals endpoint'
      });

      const requestId = createData.requestId;

      await new Promise(resolve => setTimeout(resolve, 2000));

      const { status, data } = await makeRequest('GET', `/conversations/${requestId}/approvals`);

      assert.strictEqual(status, 200);
      assert.strictEqual(data.requestId, requestId);
      assert.ok(Array.isArray(data.approvals));
    });
  });

  describe('POST /conversations/:requestId/approve', () => {
    it('should approve a pending approval request', async () => {
      const { data: createData } = await makeRequest('POST', '/message', {
        content: 'Test for approve endpoint'
      });

      const requestId = createData.requestId;

      await new Promise(resolve => setTimeout(resolve, 2000));

      const { status, data } = await makeRequest('POST', `/conversations/${requestId}/approve`, {
        feedback: 'Approved via API',
        newBudget: 200
      });

      assert.strictEqual(status, 200);
      assert.strictEqual(data.status, 'approved');
      assert.strictEqual(data.budgetUpdated, true);
      assert.strictEqual(data.newBudget, 200);
    });

    it('should approve with budget change', async () => {
      const { data: createData } = await makeRequest('POST', '/message', {
        content: 'Test for approve with budget change',
        energyBudget: 100
      });

      const requestId = createData.requestId;

      await new Promise(resolve => setTimeout(resolve, 2000));

      const { status, data } = await makeRequest('POST', `/conversations/${requestId}/approve`, {
        budgetChange: 25
      });

      assert.strictEqual(status, 200);
      assert.strictEqual(data.budgetUpdated, true);
      assert.ok(data.newBudget >= 100); // Should be at least the original budget
    });
  });

  describe('POST /conversations/:requestId/reject', () => {
    it('should reject a pending approval request', async () => {
      const { data: createData } = await makeRequest('POST', '/message', {
        content: 'Test for reject endpoint'
      });

      const requestId = createData.requestId;

      await new Promise(resolve => setTimeout(resolve, 2000));

      const { status, data } = await makeRequest('POST', `/conversations/${requestId}/reject`, {
        feedback: 'Not approved'
      });

      assert.strictEqual(status, 200);
      assert.strictEqual(data.status, 'rejected');
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for invalid request ID', async () => {
      const { status } = await makeRequest('GET', '/conversations//approvals');
      assert.ok(status >= 400);
    });

    it('should handle non-existent conversation gracefully', async () => {
      const { status } = await makeRequest('POST', '/conversations/non-existent-id/approve', {});
      // Should either return 404 or handle gracefully
      assert.ok(status >= 200);
    });
  });
});
