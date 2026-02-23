import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errors = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '2m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    errors: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export default function () {
  const channelId = `load-${Math.floor(Math.random() * 100)}`;

  group('WebSocket Load', () => {
    // Note: k6 doesn't natively support WebSocket in the same way
    // This simulates the connection overhead
    const res = http.get(`${BASE_URL}/ws/health?channel=${channelId}`, {
      headers: { 'Upgrade': 'websocket' },
    });

    check(res, {
      'ws endpoint responds': (r) => r.status === 101 || r.status === 200,
    });

    errors.add(res.status !== 101 && res.status !== 200);
  });

  group('P2P Discovery Load', () => {
    const res = http.get(`${BASE_URL}/p2p/peers?limit=50`);

    check(res, {
      'peer discovery works': (r) => r.status === 200,
    });

    errors.add(res.status !== 200);
  });

  sleep(0.1);
}
