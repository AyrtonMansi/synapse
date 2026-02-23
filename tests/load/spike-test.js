import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up
    { duration: '5m', target: 100 },   // Steady state
    { duration: '2m', target: 200 },   // Ramp up
    { duration: '5m', target: 200 },   // Steady state
    { duration: '2m', target: 400 },   // Stress test
    { duration: '5m', target: 400 },   // Peak load
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95% under 500ms
    http_req_duration: ['p(99)<1000'],  // 99% under 1s
    errors: ['rate<0.01'],               // <1% error rate
  },
};

const BASE_URL = __ENV.API_URL || 'https://api.synapse.sh';
const API_KEY = __ENV.API_KEY || 'syn_live_test_testtesttesttest';

export default function () {
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  };

  // Test 1: Health check
  {
    const res = http.get(`${BASE_URL}/health`);
    const success = check(res, {
      'health status is 200': (r) => r.status === 200,
      'health response time < 100ms': (r) => r.timings.duration < 100,
    });
    errorRate.add(!success);
  }

  sleep(0.1);

  // Test 2: Stats endpoint (cached, high volume)
  {
    const res = http.get(`${BASE_URL}/stats`);
    const success = check(res, {
      'stats status is 200': (r) => r.status === 200,
      'stats has nodes_online': (r) => JSON.parse(r.body).nodes_online !== undefined,
    });
    errorRate.add(!success);
  }

  sleep(0.1);

  // Test 3: Chat completions (main workload)
  {
    const payload = JSON.stringify({
      model: 'deepseek-v3',
      messages: [
        { role: 'user', content: 'Hello, this is a load test message' }
      ],
      max_tokens: 50,
      stream: false,
    });

    const res = http.post(`${BASE_URL}/v1/chat/completions`, payload, { headers });
    const success = check(res, {
      'chat status is 200': (r) => r.status === 200,
      'chat response has choices': (r) => {
        try {
          return JSON.parse(r.body).choices !== undefined;
        } catch {
          return false;
        }
      },
      'chat response time < 5s': (r) => r.timings.duration < 5000,
    });
    errorRate.add(!success);
  }

  sleep(0.5);
}
