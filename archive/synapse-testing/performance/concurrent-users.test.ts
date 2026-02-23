import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ConcurrentUserSimulator } from '../utils/user-simulator.js';
import { TestEnvironment } from '../utils/test-env.js';

const env = new TestEnvironment();

describe('Performance - Concurrent User Simulation', () => {
  beforeAll(async () => {
    await env.start();
  });

  afterAll(async () => {
    await env.stop();
  });

  describe('Realistic User Patterns', () => {
    it('should handle 100 concurrent active users', async () => {
      const simulator = new ConcurrentUserSimulator();
      const users = await simulator.spawnUsers(100, {
        behavior: 'active-chatter',
        duration: 30000, // 30 seconds
      });

      const results = await simulator.run();

      expect(results.successRate).toBeGreaterThan(0.95);
      expect(results.avgLatency).toBeLessThan(100);
      expect(results.errors).toHaveLength(0);
    });

    it('should handle 1000 concurrent passive users', async () => {
      const simulator = new ConcurrentUserSimulator();
      const users = await simulator.spawnUsers(1000, {
        behavior: 'lurker',
        duration: 60000,
      });

      const results = await simulator.run();

      expect(results.successRate).toBeGreaterThan(0.98);
    });

    it('should simulate mixed user behaviors', async () => {
      const simulator = new ConcurrentUserSimulator();
      
      await simulator.spawnUsers(50, { behavior: 'power-user' });
      await simulator.spawnUsers(200, { behavior: 'casual' });
      await simulator.spawnUsers(500, { behavior: 'lurker' });
      await simulator.spawnUsers(20, { behavior: 'bot' });

      const results = await simulator.run({ duration: 60000 });

      expect(results.throughput.messagesPerSecond).toBeGreaterThan(100);
      expect(results.latency.p95).toBeLessThan(500);
    });
  });

  describe('Chat Room Simulation', () => {
    it('should handle large channel with 500 users', async () => {
      const channelId = 'large-channel-test';
      const simulator = new ConcurrentUserSimulator();

      await simulator.joinChannel(channelId, 500);

      const results = await simulator.simulateChat({
        channelId,
        duration: 120000,
        messageRate: 0.1, // msgs/sec per user
      });

      expect(results.messagesDelivered).toBeGreaterThan(10000);
      expect(results.deliveryRate).toBeGreaterThan(0.99);
    });

    it('should handle rapid join/leave patterns', async () => {
      const simulator = new ConcurrentUserSimulator();
      const channelId = 'volatile-channel';

      const results = await simulator.simulateVolatility({
        channelId,
        users: 100,
        joinRate: 5, // users/sec joining
        leaveRate: 4, // users/sec leaving
        duration: 60000,
      });

      expect(results.maxConcurrent).toBeLessThan(200);
      expect(results.minLatency).toBeGreaterThan(0);
    });
  });

  describe('Message Ordering', () => {
    it('should maintain message order under load', async () => {
      const simulator = new ConcurrentUserSimulator();
      const channelId = 'ordering-test';

      const results = await simulator.testMessageOrdering({
        channelId,
        senders: 50,
        messagesPerSender: 20,
      });

      expect(results.outOfOrderCount).toBe(0);
      expect(results.totalMessages).toBe(1000);
    });
  });

  describe('WebSocket Load', () => {
    it('should handle 10000 concurrent WebSocket connections', async () => {
      const simulator = new ConcurrentUserSimulator();

      const results = await simulator.simulateWebSockets({
        connections: 10000,
        duration: 60000,
        messageRate: 0.05,
      });

      expect(results.connected).toBe(10000);
      expect(results.messagesReceived).toBeGreaterThan(0);
    });
  });

  describe('Spike Recovery', () => {
    it('should recover after traffic spike', async () => {
      const simulator = new ConcurrentUserSimulator();

      // Normal load
      await simulator.spawnUsers(100, { behavior: 'casual' });
      await simulator.run({ duration: 30000 });

      // Spike
      await simulator.spawnUsers(2000, { behavior: 'active' });
      const spikeResults = await simulator.run({ duration: 60000 });

      // Recovery
      await simulator.reduceUsers(1800);
      const recoveryResults = await simulator.run({ duration: 30000 });

      expect(spikeResults.errors.length).toBeLessThan(100);
      expect(recoveryResults.avgLatency).toBeLessThan(spikeResults.avgLatency);
    });
  });
});
