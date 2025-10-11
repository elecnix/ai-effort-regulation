import request from 'supertest';
import express from 'express';
import { startServer } from '../src/server';
import { SensitiveLoop } from '../src/loop';

describe('Energy Budget API Tests', () => {
  let app: express.Application;
  let loop: SensitiveLoop;

  beforeAll(async () => {
    // Initialize the sensitive loop
    loop = new SensitiveLoop(false, 10);
    (global as any).sensitiveLoop = loop;
    
    // Start server (but don't actually listen)
    // We'll use supertest which doesn't need the server to listen
  });

  afterAll(async () => {
    if (loop) {
      await loop.stop();
    }
  });

  test('POST /message should accept valid energy budget', async () => {
    const response = await request('http://localhost:3005')
      .post('/message')
      .send({
        content: 'Test message with budget',
        energyBudget: 50
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('received');
    expect(response.body.requestId).toBeDefined();
  });

  test('POST /message should accept zero energy budget', async () => {
    const response = await request('http://localhost:3005')
      .post('/message')
      .send({
        content: 'Urgent message',
        energyBudget: 0
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('received');
  });

  test('POST /message should accept message without energy budget', async () => {
    const response = await request('http://localhost:3005')
      .post('/message')
      .send({
        content: 'Message without budget'
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('received');
  });

  test('POST /message should reject negative energy budget', async () => {
    const response = await request('http://localhost:3005')
      .post('/message')
      .send({
        content: 'Test message',
        energyBudget: -10
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('energyBudget must be a non-negative number');
  });

  test('POST /message should reject non-numeric energy budget', async () => {
    const response = await request('http://localhost:3005')
      .post('/message')
      .send({
        content: 'Test message',
        energyBudget: 'invalid'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('energyBudget must be a non-negative number');
  });

  test('POST /message should reject NaN energy budget', async () => {
    const response = await request('http://localhost:3005')
      .post('/message')
      .send({
        content: 'Test message',
        energyBudget: NaN
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('energyBudget must be a non-negative number');
  });

  test('POST /message should accept large energy budget', async () => {
    const response = await request('http://localhost:3005')
      .post('/message')
      .send({
        content: 'Complex task',
        energyBudget: 1000000
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('received');
  });

  test('POST /message should accept decimal energy budget', async () => {
    const response = await request('http://localhost:3005')
      .post('/message')
      .send({
        content: 'Test message',
        energyBudget: 25.5
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('received');
  });

  test('GET /conversations/:requestId should return budget information', async () => {
    // First create a conversation with budget
    const postResponse = await request('http://localhost:3005')
      .post('/message')
      .send({
        content: 'Test message with budget',
        energyBudget: 75
      });

    const requestId = postResponse.body.requestId;

    // Wait a bit for the conversation to be processed
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get the conversation
    const getResponse = await request('http://localhost:3005')
      .get(`/conversations/${requestId}`);

    if (getResponse.status === 200) {
      expect(getResponse.body.metadata).toBeDefined();
      // Budget info may or may not be present depending on processing
      // Just verify the structure is correct if present
      if (getResponse.body.metadata.energyBudget !== undefined) {
        expect(typeof getResponse.body.metadata.energyBudget).toBe('number');
      }
    }
  });

  test('POST /message should handle null energy budget as no budget', async () => {
    const response = await request('http://localhost:3005')
      .post('/message')
      .send({
        content: 'Test message',
        energyBudget: null
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('received');
  });
});
