# Synapse Analytics & Monitoring Platform

A comprehensive analytics solution for the Synapse Protocol decentralized compute network.

## Features

### 1. Network Analytics Dashboard
- **Real-time node count**: Track active, online, syncing, and maintenance nodes
- **Geographic distribution map**: Visual representation of nodes across regions
- **GPU utilization across network**: Monitor compute resource usage
- **Job completion rates**: Track job success/failure metrics

### 2. Economic Metrics
- **Token price tracking**: Real-time SYN price with 24h/7d changes
- **Trading volume**: Volume by exchange with trend analysis
- **Node earnings distribution**: Breakdown by tier and region
- **Staking APR calculator**: Interactive calculator for reward estimation

### 3. Performance Monitoring
- **API latency heatmap**: Time-series visualization of endpoint performance
- **Model performance comparison**: Latency, throughput, and satisfaction metrics
- **Error rate tracking**: Categorized error analysis
- **Capacity forecasting**: ML-based predictions with recommendations

### 4. Leaderboards
- **Top nodes by earnings**: Ranked by total rewards
- **Most reliable nodes**: Based on uptime and success rate
- **Fastest inference times**: Lowest latency performers
- **Regional performance**: Compare regions by various metrics

## Project Structure

### Frontend (`synapse-frontend/src/analytics/`)
```
analytics/
├── types.ts                    # TypeScript type definitions
├── api.ts                      # API client and React Query hooks
├── index.ts                    # Module exports
├── components/
│   ├── index.ts               # Component exports
│   ├── NetworkAnalyticsDashboard.tsx
│   ├── EconomicMetricsDashboard.tsx
│   ├── PerformanceMonitoringDashboard.tsx
│   ├── LeaderboardsDashboard.tsx
│   ├── AnalyticsOverview.tsx
│   ├── SystemHealthMonitor.tsx
│   ├── StatCard.tsx
│   ├── TimeRangeSelector.tsx
│   ├── GeographicMap.tsx
│   ├── LatencyHeatmap.tsx
│   ├── LoadingState.tsx
│   └── ErrorState.tsx
├── hooks/
│   └── index.ts               # Custom React hooks
└── utils/
    └── formatters.ts          # Formatting utilities
```

### Backend (`synapse-backend/analytics/`)
```
analytics/
├── types.ts                   # Database and service types
├── index.ts                   # Module exports
├── services/
│   ├── networkAnalytics.ts    # Network metrics service
│   ├── economicAnalytics.ts   # Token economics service
│   ├── performanceAnalytics.ts # Performance monitoring service
│   ├── leaderboardService.ts  # Leaderboard calculations
│   └── realtimeAnalytics.ts   # WebSocket/realtime service
├── controllers/
│   └── analyticsController.ts # HTTP request handlers
└── routes/
    └── analyticsRoutes.ts     # API route definitions
```

## API Endpoints

### Network Analytics
- `GET /api/analytics/network/stats` - Network statistics
- `GET /api/analytics/network/geographic` - Geographic distribution
- `GET /api/analytics/network/gpu-utilization?range=24h` - GPU utilization
- `GET /api/analytics/network/jobs?period=24h` - Job completion metrics

### Economic Metrics
- `GET /api/analytics/economics/price` - Current token price
- `GET /api/analytics/economics/price-history?days=30` - Price history
- `GET /api/analytics/economics/volume?period=24h` - Trading volume
- `GET /api/analytics/economics/earnings?period=24h` - Earnings distribution
- `GET /api/analytics/economics/staking-pools` - Staking pools
- `POST /api/analytics/economics/staking-calculate` - Calculate rewards

### Performance Monitoring
- `GET /api/analytics/performance/latency?range=24h` - API latencies
- `GET /api/analytics/performance/latency-heatmap?range=24h` - Latency heatmap
- `GET /api/analytics/performance/models` - Model performance
- `GET /api/analytics/performance/errors?range=24h` - Error rates
- `GET /api/analytics/performance/capacity-forecast` - Capacity forecast

### Leaderboards
- `GET /api/analytics/leaderboard/earnings?limit=100` - Earnings leaderboard
- `GET /api/analytics/leaderboard/reliability?limit=100` - Reliability leaderboard
- `GET /api/analytics/leaderboard/speed?limit=100` - Speed leaderboard
- `GET /api/analytics/leaderboard/regional` - Regional performance

### System Health
- `GET /api/analytics/health` - System health status

### Alerts
- `GET /api/analytics/alerts` - List alerts
- `POST /api/analytics/alerts` - Create alert
- `PUT /api/analytics/alerts/:id` - Update alert
- `DELETE /api/analytics/alerts/:id` - Delete alert

## Usage

### Frontend

```tsx
import { NetworkAnalyticsDashboard } from './analytics';

function AnalyticsPage() {
  return <NetworkAnalyticsDashboard />;
}
```

### Backend

```typescript
import { createAnalyticsRoutes } from './analytics';
import express from 'express';

const app = express();
const db = /* your database connection */;

app.use('/api/analytics', createAnalyticsRoutes(db));
```

## Dependencies

### Frontend
- React 18+
- React Query (TanStack Query)
- Recharts
- Framer Motion
- Lucide React

### Backend
- Express.js
- Database (PostgreSQL/MongoDB)
- Redis (for caching)
- WebSocket support (Socket.io)

## Real-time Updates

The platform supports real-time updates via WebSocket for:
- Live network statistics
- Token price changes
- New job completions
- System alerts

Connect to the WebSocket endpoint and subscribe to channels:
```javascript
socket.emit('subscribe', {
  clientId: 'unique-id',
  channels: ['network', 'economic', 'alerts']
});
```

## Caching Strategy

- Network stats: 30 seconds
- Geographic data: 1 minute
- Price data: 15 seconds
- Leaderboards: 5 minutes
- Capacity forecast: 1 hour

## License

MIT
