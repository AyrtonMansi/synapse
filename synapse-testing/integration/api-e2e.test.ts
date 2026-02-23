import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SynapseAPIClient } from '../utils/api-client.js';
import { TestEnvironment } from '../utils/test-env.js';

const env = new TestEnvironment();
let client: SynapseAPIClient;

describe('Synapse API - End-to-End Flows', () => {
  beforeAll(async () => {
    await env.start();
    client = new SynapseAPIClient(env.getApiUrl());
    await client.authenticate(env.getTestCredentials());
  });

  afterAll(async () => {
    await env.stop();
  });

  describe('Authentication Flow', () => {
    it('should complete full OAuth2 flow', async () => {
      const auth = await client.auth.oauth2({
        clientId: 'test-client',
        scope: 'read write',
      });
      expect(auth.accessToken).toBeDefined();
      expect(auth.refreshToken).toBeDefined();
      expect(auth.expiresIn).toBeGreaterThan(0);
    });

    it('should refresh expired tokens', async () => {
      const tokens = await client.auth.login({
        username: 'testuser',
        password: 'testpass',
      });
      
      const refreshed = await client.auth.refresh(tokens.refreshToken);
      expect(refreshed.accessToken).not.toBe(tokens.accessToken);
      expect(refreshed.refreshToken).toBeDefined();
    });

    it('should handle invalid credentials', async () => {
      await expect(
        client.auth.login({ username: 'invalid', password: 'wrong' })
      ).rejects.toThrow('Authentication failed');
    });
  });

  describe('Message Flow', () => {
    it('should send and receive messages', async () => {
      const message = await client.messages.send({
        channelId: 'test-channel',
        content: 'Hello, Synapse!',
        timestamp: Date.now(),
      });
      
      expect(message.id).toBeDefined();
      expect(message.content).toBe('Hello, Synapse!');
      expect(message.status).toBe('delivered');
    });

    it('should handle message reactions', async () => {
      const msg = await client.messages.send({
        channelId: 'test-channel',
        content: 'React to this',
      });

      const reaction = await client.messages.addReaction(msg.id, '👍');
      expect(reaction.emoji).toBe('👍');
      expect(reaction.count).toBe(1);

      const reactions = await client.messages.getReactions(msg.id);
      expect(reactions).toContainEqual(expect.objectContaining({ emoji: '👍' }));
    });

    it('should support message threading', async () => {
      const parent = await client.messages.send({
        channelId: 'test-channel',
        content: 'Parent message',
      });

      const reply = await client.messages.send({
        channelId: 'test-channel',
        content: 'Thread reply',
        parentId: parent.id,
      });

      expect(reply.parentId).toBe(parent.id);
      
      const thread = await client.messages.getThread(parent.id);
      expect(thread.messages).toHaveLength(2);
    });
  });

  describe('Channel Management', () => {
    it('should create and configure channels', async () => {
      const channel = await client.channels.create({
        name: 'test-channel',
        type: 'public',
        description: 'Test channel',
      });

      expect(channel.id).toBeDefined();
      expect(channel.name).toBe('test-channel');

      const updated = await client.channels.update(channel.id, {
        description: 'Updated description',
      });

      expect(updated.description).toBe('Updated description');

      await client.channels.delete(channel.id);
      await expect(client.channels.get(channel.id)).rejects.toThrow();
    });

    it('should manage channel permissions', async () => {
      const channel = await client.channels.create({ name: 'perm-test' });
      
      await client.channels.setPermissions(channel.id, {
        userId: 'user-1',
        permissions: ['read', 'write'],
      });

      const perms = await client.channels.getPermissions(channel.id);
      expect(perms).toContainEqual(
        expect.objectContaining({ userId: 'user-1', permissions: ['read', 'write'] })
      );
    });
  });

  describe('Real-time Events', () => {
    it('should receive WebSocket events', async () => {
      const events: any[] = [];
      
      const ws = await client.ws.connect();
      ws.on('message', (msg) => events.push(msg));
      
      await client.messages.send({
        channelId: 'test-channel',
        content: 'WebSocket test',
      });

      await new Promise((resolve) => setTimeout(resolve, 500));
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('message');
      
      ws.close();
    });

    it('should handle reconnection', async () => {
      const ws = await client.ws.connect();
      let reconnected = false;
      
      ws.on('reconnect', () => { reconnected = true; });
      
      // Simulate disconnect
      ws.terminate();
      
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      expect(reconnected).toBe(true);
      expect(ws.readyState).toBe(WebSocket.OPEN);
      
      ws.close();
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limiting', async () => {
      const promises = Array(150).fill(null).map(() =>
        client.messages.send({
          channelId: 'test-channel',
          content: 'Rate limit test',
        }).catch(e => e)
      );

      const results = await Promise.all(promises);
      const rateLimited = results.filter(r => r.status === 429);
      
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should validate request payloads', async () => {
      await expect(
        client.messages.send({
          channelId: '', // Invalid
          content: '', // Invalid
        })
      ).rejects.toThrow('Validation failed');
    });

    it('should handle service unavailable', async () => {
      await env.simulateServiceDown();
      
      await expect(
        client.messages.send({ channelId: 'test', content: 'test' })
      ).rejects.toThrow('Service unavailable');
      
      await env.restoreService();
    });
  });
});
