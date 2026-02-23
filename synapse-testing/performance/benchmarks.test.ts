import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';
import { BenchmarkRunner } from '../utils/benchmark.js';
import { TestEnvironment } from '../utils/test-env.js';

const env = new TestEnvironment();
const runner = new BenchmarkRunner();

describe('Performance - Benchmarking Suite', () => {
  beforeAll(async () => {
    await env.start();
  });

  afterAll(async () => {
    await env.stop();
    await runner.generateReport();
  });

  describe('API Response Benchmarks', () => {
    it('should benchmark message creation', async () => {
      const result = await runner.benchmark({
        name: 'message-create',
        fn: async () => {
          return env.api.post('/messages', {
            channelId: 'benchmark-channel',
            content: 'Benchmark message',
          });
        },
        iterations: 1000,
        warmup: 100,
      });

      expect(result.mean).toBeLessThan(50); // < 50ms average
      expect(result.p95).toBeLessThan(100); // < 100ms p95
      expect(result.p99).toBeLessThan(200); // < 200ms p99
    });

    it('should benchmark message retrieval', async () => {
      // Seed data
      await Promise.all(Array(100).fill(null).map((_, i) => 
        env.api.post('/messages', {
          channelId: 'benchmark-channel',
          content: `Message ${i}`,
        })
      ));

      const result = await runner.benchmark({
        name: 'message-list',
        fn: async () => {
          return env.api.get('/channels/benchmark-channel/messages?limit=50');
        },
        iterations: 500,
        warmup: 50,
      });

      expect(result.mean).toBeLessThan(30);
      expect(result.p95).toBeLessThan(60);
    });

    it('should benchmark user authentication', async () => {
      const result = await runner.benchmark({
        name: 'auth-login',
        fn: async () => {
          return env.api.post('/auth/login', {
            username: `benchmark-${Date.now()}`,
            password: 'benchmark123',
          });
        },
        iterations: 500,
        warmup: 50,
      });

      expect(result.mean).toBeLessThan(100);
      expect(result.p95).toBeLessThan(200);
    });

    it('should benchmark search operations', async () => {
      const result = await runner.benchmark({
        name: 'search-messages',
        fn: async () => {
          return env.api.get('/search?q=test&limit=20');
        },
        iterations: 200,
        warmup: 20,
      });

      expect(result.mean).toBeLessThan(200);
      expect(result.p95).toBeLessThan(500);
    });
  });

  describe('Database Benchmarks', () => {
    it('should benchmark write throughput', async () => {
      const result = await runner.benchmark({
        name: 'db-write-throughput',
        fn: async () => {
          return env.db.insert('messages', {
            id: crypto.randomUUID(),
            content: 'Benchmark',
            createdAt: new Date(),
          });
        },
        iterations: 5000,
        concurrency: 100,
      });

      expect(result.opsPerSecond).toBeGreaterThan(1000);
    });

    it('should benchmark read throughput', async () => {
      const result = await runner.benchmark({
        name: 'db-read-throughput',
        fn: async () => {
          return env.db.query('SELECT * FROM messages LIMIT 10');
        },
        iterations: 10000,
        concurrency: 100,
      });

      expect(result.opsPerSecond).toBeGreaterThan(5000);
    });

    it('should benchmark complex queries', async () => {
      const result = await runner.benchmark({
        name: 'db-complex-query',
        fn: async () => {
          return env.db.query(`
            SELECT m.*, u.username, c.name as channel_name
            FROM messages m
            JOIN users u ON m.user_id = u.id
            JOIN channels c ON m.channel_id = c.id
            WHERE m.created_at > NOW() - INTERVAL '7 days'
            ORDER BY m.created_at DESC
            LIMIT 100
          `);
        },
        iterations: 100,
      });

      expect(result.mean).toBeLessThan(100);
    });
  });

  describe('Cryptographic Benchmarks', () => {
    it('should benchmark JWT signing', async () => {
      const result = await runner.benchmark({
        name: 'jwt-sign',
        fn: async () => {
          return env.crypto.signJWT({ userId: 'test', role: 'user' });
        },
        iterations: 10000,
      });

      expect(result.mean).toBeLessThan(1); // < 1ms
    });

    it('should benchmark JWT verification', async () => {
      const token = await env.crypto.signJWT({ userId: 'test' });
      
      const result = await runner.benchmark({
        name: 'jwt-verify',
        fn: async () => {
          return env.crypto.verifyJWT(token);
        },
        iterations: 10000,
      });

      expect(result.mean).toBeLessThan(1);
    });

    it('should benchmark password hashing', async () => {
      const result = await runner.benchmark({
        name: 'password-hash',
        fn: async () => {
          return env.crypto.hashPassword('benchmark-password');
        },
        iterations: 100,
      });

      expect(result.mean).toBeLessThan(100); // Argon2/scrypt
    });

    it('should benchmark AES encryption', async () => {
      const data = 'x'.repeat(1024); // 1KB
      
      const result = await runner.benchmark({
        name: 'aes-encrypt',
        fn: async () => {
          return env.crypto.encrypt(data);
        },
        iterations: 1000,
      });

      expect(result.mean).toBeLessThan(1);
    });
  });

  describe('Serialization Benchmarks', () => {
    it('should benchmark JSON serialization', async () => {
      const data = {
        users: Array(100).fill(null).map((_, i) => ({
          id: i,
          name: `User ${i}`,
          email: `user${i}@example.com`,
          metadata: { created: Date.now() },
        })),
      };

      const result = await runner.benchmark({
        name: 'json-serialize',
        fn: async () => {
          return JSON.stringify(data);
        },
        iterations: 10000,
      });

      expect(result.mean).toBeLessThan(0.5);
    });

    it('should benchmark Protocol Buffers', async () => {
      const result = await runner.benchmark({
        name: 'protobuf-serialize',
        fn: async () => {
          return env.proto.serialize({
            id: 123,
            content: 'Hello',
            timestamp: Date.now(),
          });
        },
        iterations: 10000,
      });

      expect(result.mean).toBeLessThan(0.1);
    });

    it('should benchmark MessagePack', async () => {
      const data = { foo: 'bar', nums: [1, 2, 3], nested: { a: 1 } };
      
      const result = await runner.benchmark({
        name: 'msgpack-serialize',
        fn: async () => {
          return env.msgpack.encode(data);
        },
        iterations: 10000,
      });

      expect(result.mean).toBeLessThan(0.1);
    });
  });

  describe('P2P Network Benchmarks', () => {
    it('should benchmark peer discovery', async () => {
      const result = await runner.benchmark({
        name: 'p2p-discovery',
        fn: async () => {
          return env.p2p.findPeers('/synapse/1.0.0');
        },
        iterations: 100,
      });

      expect(result.mean).toBeLessThan(500);
    });

    it('should benchmark message propagation', async () => {
      const result = await runner.benchmark({
        name: 'p2p-propagate',
        fn: async () => {
          return env.p2p.broadcast({
            type: 'test',
            data: 'benchmark',
          });
        },
        iterations: 100,
      });

      expect(result.mean).toBeLessThan(100);
    });

    it('should benchmark DHT operations', async () => {
      const key = `/synapse/test-${Date.now()}`;
      
      const result = await runner.benchmark({
        name: 'dht-put',
        fn: async () => {
          return env.p2p.dht.put(key, 'value');
        },
        iterations: 50,
      });

      expect(result.mean).toBeLessThan(1000);
    });
  });

  describe('Memory Benchmarks', () => {
    it('should benchmark object creation overhead', async () => {
      const initialMemory = process.memoryUsage();
      
      const objects = [];
      for (let i = 0; i < 100000; i++) {
        objects.push({
          id: i,
          data: new Array(10).fill(i),
        });
      }
      
      const finalMemory = process.memoryUsage();
      const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const bytesPerObject = heapGrowth / 100000;
      
      expect(bytesPerObject).toBeLessThan(500); // < 500 bytes per object
    });
  });
});
