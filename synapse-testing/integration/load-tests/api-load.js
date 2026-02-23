import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const apiErrors = new Rate('api_errors');
const responseTime = new Trend('response_time');
const messagesSent = new Counter('messages_sent');
const messagesReceived = new Counter('messages_received');

// Test configuration
export const options = {
  scenarios: {
    // Normal load test
    normal_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
    // Stress test
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 500 },
        { duration: '3m', target: 500 },
        { duration: '1m', target: 1000 },
        { duration: '3m', target: 1000 },
        { duration: '2m', target: 2000 },
        { duration: '5m', target: 2000 },
        { duration: '2m', target: 0 },
      ],
      startTime: '20m', // Run after normal load
    },
    // Spike test
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 5000 },
        { duration: '1m', target: 5000 },
        { duration: '10s', target: 0 },
      ],
      startTime: '40m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    api_errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || 'test-api-key';

export function setup() {
  // Authenticate and get tokens
  const authRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    username: `loadtest-${Date.now()}`,
    password: 'testpassword123',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(authRes, {
    'auth successful': (r) => r.status === 200,
  });

  return { token: authRes.json('accessToken') };
}

export default function (data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  };

  group('API Health Checks', () => {
    const res = http.get(`${BASE_URL}/health`, { headers });
    
    check(res, {
      'health check passes': (r) => r.status === 200,
      'health response time < 100ms': (r) => r.timings.duration < 100,
    });

    apiErrors.add(res.status !== 200);
    responseTime.add(res.timings.duration);
  });

  group('Send Messages', () => {
    const message = {
      channelId: 'load-test-channel',
      content: `Load test message at ${Date.now()}`,
      metadata: {
        priority: 'normal',
        tags: ['load-test'],
      },
    };

    const res = http.post(
      `${BASE_URL}/messages`,
      JSON.stringify(message),
      { headers }
    );

    check(res, {
      'message sent successfully': (r) => r.status === 201,
      'message has id': (r) => r.json('id') !== undefined,
    });

    if (res.status === 201) {
      messagesSent.add(1);
    }
    apiErrors.add(res.status !== 201);
    responseTime.add(res.timings.duration);
  });

  group('Fetch Messages', () => {
    const res = http.get(
      `${BASE_URL}/channels/load-test-channel/messages?limit=50`,
      { headers }
    );

    check(res, {
      'messages fetched': (r) => r.status === 200,
      'response is array': (r) => Array.isArray(r.json()),
    });

    if (res.status === 200) {
      messagesReceived.add(res.json().length);
    }
    apiErrors.add(res.status !== 200);
    responseTime.add(res.timings.duration);
  });

  group('User Operations', () => {
    const res = http.get(`${BASE_URL}/users/me`, { headers });

    check(res, {
      'user profile fetched': (r) => r.status === 200,
    });

    apiErrors.add(res.status !== 200);
    responseTime.add(res.timings.duration);
  });

  group('Channel Operations', () => {
    const res = http.get(`${BASE_URL}/channels`, { headers });

    check(res, {
      'channels listed': (r) => r.status === 200,
    });

    apiErrors.add(res.status !== 200);
    responseTime.add(res.timings.duration);
  });

  // Simulate realistic user behavior
  sleep(Math.random() * 2 + 1);
}

export function teardown(data) {
  // Cleanup test data
  http.del(`${BASE_URL}/test-data/cleanup`, null, {
    headers: { 'Authorization': `Bearer ${data.token}` },
  });
}
