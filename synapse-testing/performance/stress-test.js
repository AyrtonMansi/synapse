import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const latencyP95 = new Trend('latency_p95');
const throughput = new Counter('requests_completed');

export const options = {
  scenarios: {
    // Gradual ramp-up to find breaking point
    stress_ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 100 },
        { duration: '5m', target: 500 },
        { duration: '5m', target: 1000 },
        { duration: '5m', target: 2000 },
        { duration: '5m', target: 3000 },
        { duration: '5m', target: 4000 },
        { duration: '5m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
    // Sustained high load
    sustained_stress: {
      executor: 'constant-vus',
      vus: 2000,
      duration: '10m',
      startTime: '40m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export function setup() {
  // Warm up the system
  for (let i = 0; i < 100; i++) {
    http.get(`${BASE_URL}/health`);
  }
  
  return { startTime: Date.now() };
}

export default function (data) {
  const headers = {
    'Authorization': `Bearer ${__ENV.TEST_TOKEN || 'stress-test-token'}`,
    'Content-Type': 'application/json',
  };

  group('Critical Path Operations', () => {
    // Send message
    const msgRes = http.post(`${BASE_URL}/messages`, JSON.stringify({
      channelId: `stress-${__VU % 10}`,
      content: `Stress test message ${Date.now()}`,
    }), { headers });

    check(msgRes, {
      'message sent': (r) => r.status === 201,
      'response time OK': (r) => r.timings.duration < 1000,
    });

    errorRate.add(msgRes.status !== 201);
    latencyP95.add(msgRes.timings.duration);
    throughput.add(1);

    // Get messages
    const getRes = http.get(
      `${BASE_URL}/channels/stress-${__VU % 10}/messages?limit=20`,
      { headers }
    );

    check(getRes, {
      'messages retrieved': (r) => r.status === 200,
    });

    errorRate.add(getRes.status !== 200);
  });

  group('User Operations', () => {
    const res = http.get(`${BASE_URL}/users/me`, { headers });
    check(res, { 'user fetched': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
  });

  group('Channel Operations', () => {
    const res = http.get(`${BASE_URL}/channels`, { headers });
    check(res, { 'channels listed': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
  });

  sleep(Math.random() * 0.5);
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Stress test completed in ${duration}s`);
}

export function handleSummary(data) {
  return {
    'reports/stress-test-results.json': JSON.stringify(data, null, 2),
  };
}
