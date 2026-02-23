import { describe, it, expect } from 'vitest';
import { AccessControlTester } from '../utils/access-tester.js';
import { TestEnvironment } from '../utils/test-env.js';

const env = new TestEnvironment();
const tester = new AccessControlTester();

describe('Security - Access Control Validation', () => {
  beforeAll(async () => {
    await env.start();
  });

  afterAll(async () => {
    await env.stop();
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('should enforce admin-only operations', async () => {
      const roles = ['user', 'moderator', 'admin'];
      const adminEndpoints = [
        { method: 'DELETE', path: '/api/users/:id' },
        { method: 'POST', path: '/api/system/config' },
        { method: 'GET', path: '/api/admin/audit-logs' },
        { method: 'POST', path: '/api/admin/ban' },
      ];

      for (const role of roles) {
        const user = await tester.createUserWithRole(role);
        
        for (const endpoint of adminEndpoints) {
          const res = await tester.makeRequest(endpoint.path, {
            method: endpoint.method,
            headers: { Authorization: `Bearer ${user.token}` },
          });

          if (role === 'admin') {
            expect(res.status).not.toBe(403);
          } else {
            expect(res.status).toBe(403);
          }
        }
      }
    });

    it('should support role hierarchy', async () => {
      const hierarchy = {
        admin: ['admin', 'moderator', 'user'],
        moderator: ['moderator', 'user'],
        user: ['user'],
      };

      for (const [role, inherited] of Object.entries(hierarchy)) {
        const user = await tester.createUserWithRole(role);
        
        for (const inheritedRole of inherited) {
          const hasAccess = await tester.checkRoleAccess(user, inheritedRole);
          expect(hasAccess).toBe(true);
        }
      }
    });

    it('should prevent privilege escalation', async () => {
      const user = await tester.createUserWithRole('user');
      
      const res = await tester.makeRequest('/api/users/me', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user.token}` },
        body: { role: 'admin' },
      });

      expect(res.status).toBe(403);
      
      const profile = await tester.getUserProfile(user.token);
      expect(profile.role).toBe('user');
    });
  });

  describe('API Key Access Control', () => {
    it('should enforce API key scopes', async () => {
      const apiKeys = {
        readOnly: await tester.createApiKey(['read:messages']),
        writeOnly: await tester.createApiKey(['write:messages']),
        admin: await tester.createApiKey(['read:messages', 'write:messages', 'admin:users']),
      };

      for (const [name, key] of Object.entries(apiKeys)) {
        const res = await tester.makeRequest('/api/messages', {
          headers: { 'X-API-Key': key },
        });
        
        if (name === 'writeOnly') {
          expect(res.status).toBe(403);
        } else {
          expect(res.status).toBe(200);
        }
      }
    });

    it('should enforce API key rate limits', async () => {
      const apiKey = await tester.createApiKey(['read:messages'], { rateLimit: 10 });

      for (let i = 0; i < 10; i++) {
        const res = await tester.makeRequest('/api/messages', {
          headers: { 'X-API-Key': apiKey },
        });
        expect(res.status).toBe(200);
      }

      const limitedRes = await tester.makeRequest('/api/messages', {
        headers: { 'X-API-Key': apiKey },
      });
      expect(limitedRes.status).toBe(429);
    });
  });

  describe('Permission Inheritance', () => {
    it('should handle channel permission inheritance', async () => {
      const org = await tester.createOrganization();
      const channel = await tester.createChannel(org, { 
        permissions: { read: 'members', write: 'moderators' },
      });

      const member = await tester.createOrgMember(org, 'member');
      const moderator = await tester.createOrgMember(org, 'moderator');

      const memberWrite = await tester.makeRequest(`/api/channels/${channel.id}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${member.token}` },
        body: { content: 'test' },
      });
      expect(memberWrite.status).toBe(403);

      const moderatorWrite = await tester.makeRequest(`/api/channels/${channel.id}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${moderator.token}` },
        body: { content: 'test' },
      });
      expect(moderatorWrite.status).toBe(201);
    });
  });
});
