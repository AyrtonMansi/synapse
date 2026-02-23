import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const latencyTrend = new Trend('latency_p95');

// Soak test: Extended duration to catch memory leaks
export const options = {
  stages: [
    { duration: '5m', target: 50 },    // Warm up
    { duration: '55m', target: 50 },   // 1 hour sustained load
    { duration: '5m', target: 0 },     // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.005'],
  },
};

const BASE_URL = __ENV.API_URL || 'https://api.synapse.sh';
const API_KEY = __ENV.API_KEY || 'syn_live_test_testtesttesttest';

export default function () {
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  };

  // Simulate realistic user patterns
  const scenarios = [
    // 40% health checks
    () => {
      const res = http.get(`${BASE_URL}/health`);
      return check(res, {
        'health ok': (r) => r.status === 200,
      });
    },
    // 30% stats checks
    () => {
      const res = http.get(`${BASE_URL}/stats`);
      return check(res, {
        'stats ok': (r) => r.status === 200,
      });
    },
    // 30% chat completions
    () => {
      const payload = JSON.stringify({
        model: 'deepseek-v3',
        messages: [{ role: 'user', content: 'Test message for soak test' }],
        max_tokens: 100,
      });
      const res = http.post(`${BASE_URL}/v1/chat/completions`, payload, { headers });
      latencyTrend.add(res.timings.duration);
      return check(res, {
        'chat ok': (r) => r.status === 200,
        'chat fast': (r) => r.timings.duration < 3000,
      });
    },
  ];

  // Weighted random selection
  const rand = Math.random();
  let result;
  if (rand < 0.4) {
    result = scenarios[0]();
  } else if (rand < 0.7) {
    result = scenarios[1]();
  } else {
    result = scenarios[2]();
  }

  errorRate.add(!result);

  // Variable sleep to simulate real users
  sleep(Math.random() * 2 + 0.5);
}
