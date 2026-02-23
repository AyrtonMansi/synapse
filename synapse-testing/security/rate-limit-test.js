import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errors = new Rate('errors');
const blockedRequests = new Rate('blocked_requests');
const responseTime = new Trend('response_time');

export const options = {
  scenarios: {
    // Test rate limiting
    rate_limit_test: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 500,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '1m', target: 200 },
        { duration: '2m', target: 50 },
      ],
    },
    // Test burst handling
    burst_test: {
      executor: 'shared-iterations',
      vus: 100,
      iterations: 1000,
      maxDuration: '30s',
      startTime: '7m',
    },
  },
  thresholds: {
    blocked_requests: ['rate>0.8'], // Expect most excess requests to be blocked
    errors: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export default function () {
  const endpoints = [
    '/api/messages',
    '/api/users/me',
    '/api/channels',
    '/api/health',
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

  const res = http.get(`${BASE_URL}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${__ENV.TEST_TOKEN || 'test-token'}`,
      'X-Client-ID': `client-${__VU}`,
    },
  });

  const isBlocked = res.status === 429;
  const isError = res.status >= 500;

  blockedRequests.add(isBlocked);
  errors.add(isError);
  responseTime.add(res.timings.duration);

  check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
    'has rate limit headers': (r) => 
      r.headers['X-RateLimit-Limit'] !== undefined ||
      r.headers['X-Ratelimit-Limit'] !== undefined,
  });

  sleep(0.01);
}

export function handleSummary(data) {
  return {
    'reports/rate-limit-results.json': JSON.stringify(data, null, 2),
  };
}
