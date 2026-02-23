import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

// Stress test: Find breaking point
export const options = {
  stages: [
    { duration: '2m', target: 500 },    // Normal load
    { duration: '2m', target: 1000 },   // High load
    { duration: '2m', target: 2000 },   // Very high
    { duration: '2m', target: 5000 },   // Extreme
    { duration: '5m', target: 10000 },  // Breaking point
    { duration: '2m', target: 0 },      // Recovery
  ],
  thresholds: {
    http_req_failed: ['rate<0.5'],  // Allow up to 50% errors at breaking point
  },
};

const BASE_URL = __ENV.API_URL || 'https://api.synapse.sh';

export default function () {
  // Only hit health endpoint to avoid token costs
  const res = http.get(`${BASE_URL}/health`, {
    tags: { name: 'health' },
  });

  const success = check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });

  errorRate.add(!success);
}
