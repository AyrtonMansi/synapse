import { describe, it, expect } from 'vitest';
import { PenetrationTester } from '../utils/pen-tester.js';
import { TestEnvironment } from '../utils/test-env.js';

const env = new TestEnvironment();
const tester = new PenetrationTester();

describe('Security - Penetration Testing', () => {
  beforeAll(async () => {
    await env.start();
  });

  afterAll(async () => {
    await env.stop();
  });

  describe('SQL Injection', () => {
    it('should prevent SQL injection in message queries', async () => {
      const payloads = [
        "' OR '1'='1",
        "'; DROP TABLE messages; --",
        "' UNION SELECT * FROM users --",
        "1'; DELETE FROM messages WHERE '1'='1",
      ];

      for (const payload of payloads) {
        const res = await tester.inject(payload, 'message-query');
        expect(res.vulnerable).toBe(false);
        expect(res.blockedBy).toBeDefined();
      }
    });

    it('should prevent SQL injection in user search', async () => {
      const result = await tester.testSqlInjection('/api/users/search', {
        method: 'GET',
        params: { q: "' OR 1=1 --" },
      });

      expect(result.vulnerable).toBe(false);
      expect(result.response.status).toBe(400);
    });

    it('should use parameterized queries', async () => {
      const audit = await tester.auditDatabaseQueries();
      expect(audit.usesParameterizedQueries).toBe(true);
      expect(audit.rawQueryCount).toBe(0);
    });
  });

  describe('XSS (Cross-Site Scripting)', () => {
    it('should sanitize message content', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert("xss")>',
        'javascript:alert("xss")',
        '<svg onload=alert("xss")>',
        '\\" onclick=alert(1)',
      ];

      for (const payload of xssPayloads) {
        const message = await tester.sendMessage({ content: payload });
        
        // Verify content is escaped/sanitized
        expect(message.content).not.toContain('<script>');
        expect(message.content).not.toMatch(/on\w+=/i);
        expect(message.html).toBeUndefined(); // Should not have raw HTML
      }
    });

    it('should set proper CSP headers', async () => {
      const headers = await tester.getSecurityHeaders('/');
      
      expect(headers['content-security-policy']).toBeDefined();
      expect(headers['content-security-policy']).toContain("default-src 'self'");
      expect(headers['content-security-policy']).toContain("script-src");
    });

    it('should escape output in API responses', async () => {
      const malicious = '<script>document.location="http://evil.com"</script>';
      const user = await tester.createUser({ username: malicious });
      
      expect(user.username).not.toContain('<script>');
      expect(user.username).toContain('&lt;');
    });
  });

  describe('Authentication Bypass', () => {
    it('should reject invalid JWT tokens', async () => {
      const invalidTokens = [
        'invalid-token',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
        '',
        null,
      ];

      for (const token of invalidTokens) {
        const res = await tester.makeRequest('/api/protected', {
          headers: { Authorization: `Bearer ${token}` },
        });

        expect(res.status).toBe(401);
      }
    });

    it('should reject tampered JWT tokens', async () => {
      const validToken = await tester.getValidToken();
      const tampered = validToken.slice(0, -5) + 'XXXXX';

      const res = await tester.makeRequest('/api/protected', {
        headers: { Authorization: `Bearer ${tampered}` },
      });

      expect(res.status).toBe(401);
    });

    it('should enforce token expiration', async () => {
      const expiredToken = await tester.createExpiredToken();
      
      const res = await tester.makeRequest('/api/protected', {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('expired');
    });

    it('should prevent session fixation', async () => {
      const session1 = await tester.login('user1', 'pass1');
      const session2 = await tester.login('user1', 'pass1');
      
      expect(session1.token).not.toBe(session2.token);
    });
  });

  describe('Authorization Bypass', () => {
    it('should enforce channel access controls', async () => {
      const user1 = await tester.createUser('user1');
      const user2 = await tester.createUser('user2');
      const privateChannel = await tester.createPrivateChannel(user1);

      const res = await tester.makeRequest(`/api/channels/${privateChannel.id}`, {
        headers: { Authorization: `Bearer ${user2.token}` },
      });

      expect(res.status).toBe(403);
    });

    it('should prevent privilege escalation', async () => {
      const normalUser = await tester.createUser('normal');
      
      // Try to access admin endpoint
      const res = await tester.makeRequest('/api/admin/users', {
        headers: { Authorization: `Bearer ${normalUser.token}` },
      });

      expect(res.status).toBe(403);
    });

    it('should verify object-level permissions', async () => {
      const user1 = await tester.createUser('user1');
      const user2 = await tester.createUser('user2');
      const message = await tester.sendMessageAs(user1, 'private');

      // Try to delete another user's message
      const res = await tester.makeRequest(`/api/messages/${message.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user2.token}` },
      });

      expect(res.status).toBe(403);
    });
  });

  describe('CSRF Protection', () => {
    it('should require CSRF tokens for state-changing operations', async () => {
      const user = await tester.createUser('csrf-test');

      const res = await tester.makeRequest('/api/messages', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${user.token}`,
          // No CSRF token
        },
        body: { content: 'test' },
      });

      expect(res.status).toBe(403);
    });

    it('should validate CSRF token matches session', async () => {
      const user = await tester.createUser('csrf-test2');
      const wrongToken = 'invalid-csrf-token';

      const res = await tester.makeRequest('/api/messages', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${user.token}`,
          'X-CSRF-Token': wrongToken,
        },
        body: { content: 'test' },
      });

      expect(res.status).toBe(403);
    });
  });

  describe('API Security', () => {
    it('should implement rate limiting', async () => {
      const results = await tester.testRateLimit('/api/messages', {
        requests: 150,
        window: 60,
      });

      expect(results.limited).toBe(true);
      expect(results.remainingRequests).toBeLessThanOrEqual(0);
    });

    it('should return security headers', async () => {
      const headers = await tester.getSecurityHeaders('/api/health');

      expect(headers['strict-transport-security']).toBeDefined();
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBeDefined();
      expect(headers['x-xss-protection']).toBeDefined();
    });

    it('should not expose sensitive data in errors', async () => {
      const res = await tester.makeRequest('/api/error-test', {
        method: 'POST',
        body: { trigger: 'database' },
      });

      expect(res.status).toBe(500);
      expect(res.body).not.toContain('password');
      expect(res.body).not.toContain('database');
      expect(res.body).not.toContain('stack');
    });

    it('should validate all input parameters', async () => {
      const testCases = [
        { param: 'id', value: '../../../etc/passwd', expected: 400 },
        { param: 'limit', value: '999999', expected: 400 },
        { param: 'offset', value: '-1', expected: 400 },
        { param: 'sort', value: '; DROP TABLE', expected: 400 },
      ];

      for (const test of testCases) {
        const res = await tester.makeRequest(`/api/messages?${test.param}=${encodeURIComponent(test.value)}`);
        expect(res.status).toBe(test.expected);
      }
    });
  });

  describe('File Upload Security', () => {
    it('should validate file types', async () => {
      const maliciousFiles = [
        { name: 'shell.php', content: '<?php system($_GET["cmd"]); ?>' },
        { name: 'script.js.exe', content: 'MZ' },
        { name: 'null.jpg.php', content: '<?php echo "x"; ?>' },
      ];

      for (const file of maliciousFiles) {
        const res = await tester.uploadFile('/api/upload', file);
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Invalid file type');
      }
    });

    it('should enforce file size limits', async () => {
      const largeFile = {
        name: 'large.bin',
        content: Buffer.alloc(100 * 1024 * 1024), // 100MB
      };

      const res = await tester.uploadFile('/api/upload', largeFile);
      expect(res.status).toBe(413);
    });

    it('should scan uploads for malware', async () => {
      const eicar = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
      
      const res = await tester.uploadFile('/api/upload', {
        name: 'test.txt',
        content: eicar,
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('malware');
    });
  });

  describe('Denial of Service Prevention', () => {
    it('should timeout long-running requests', async () => {
      const start = Date.now();
      const res = await tester.makeRequest('/api/slow-endpoint', {
        timeout: 5000,
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10000);
      expect(res.status).toBe(408);
    });

    it('should limit request payload size', async () => {
      const largePayload = { data: 'x'.repeat(10 * 1024 * 1024) }; // 10MB

      const res = await tester.makeRequest('/api/messages', {
        method: 'POST',
        body: largePayload,
      });

      expect(res.status).toBe(413);
    });

    it('should prevent regex DoS', async () => {
      const redosPayload = 'a'.repeat(10000) + '!';
      
      const start = Date.now();
      const res = await tester.makeRequest('/api/validate', {
        method: 'POST',
        body: { pattern: redosPayload },
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
      expect(res.status).toBe(400);
    });
  });
});
