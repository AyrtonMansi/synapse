# Monitoring and Observability Guide

## Overview
This guide covers monitoring, metrics collection, and observability for the Synapse platform.

## 1. Prometheus Metrics

### Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'synapse-backend'
    static_configs:
      - targets: ['backend:3000']
    metrics_path: /metrics
    scrape_interval: 10s
    
  - job_name: 'synapse-node'
    static_configs:
      - targets: ['node:8080']
    scrape_interval: 10s
    
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
    
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
```

### Application Metrics (Node.js)
```typescript
// src/metrics/prometheus.ts
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export const register = new Registry();

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

export const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
  registers: [register]
});

export const cacheHitRate = new Gauge({
  name: 'cache_hit_rate',
  help: 'Cache hit rate percentage',
  labelNames: ['cache_type'],
  registers: [register]
});

export const jobsCompleted = new Counter({
  name: 'synapse_jobs_completed_total',
  help: 'Total jobs completed',
  labelNames: ['status'],
  registers: [register]
});

export const gpuUtilization = new Gauge({
  name: 'synapse_gpu_utilization_percent',
  help: 'GPU utilization',
  labelNames: ['device'],
  registers: [register]
});

// Express middleware
export const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestsTotal.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode
    });
    httpDuration.observe({ method: req.method, route: req.route?.path }, duration);
  });
  
  next();
};
```

### Python Metrics (Synapse Node)
```python
# src/metrics/metrics.py
from prometheus_client import Counter, Histogram, Gauge, start_http_server

JOBS_COMPLETED = Counter(
    'synapse_node_jobs_completed', 
    'Jobs completed', 
    ['status']
)

JOB_DURATION = Histogram(
    'synapse_node_job_duration_seconds',
    'Job duration',
    ['job_type'],
    buckets=[1, 5, 10, 30, 60, 120, 300]
)

GPU_UTILIZATION = Gauge(
    'synapse_node_gpu_utilization_percent',
    'GPU utilization',
    ['device_id']
)

GPU_MEMORY = Gauge(
    'synapse_node_gpu_memory_bytes',
    'GPU memory',
    ['device_id']
)

def start_metrics_server(port=8080):
    start_http_server(port)
```

## 2. Grafana Dashboards

### Main Dashboard JSON
```json
{
  "dashboard": {
    "title": "Synapse Platform",
    "panels": [
      {
        "title": "Request Rate",
        "type": "stat",
        "targets": [{
          "expr": "sum(rate(http_requests_total[5m]))",
          "legendFormat": "req/s"
        }]
      },
      {
        "title": "Latency (p99)",
        "type": "graph",
        "targets": [{
          "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
          "legendFormat": "p99"
        }]
      },
      {
        "title": "GPU Utilization",
        "type": "gauge",
        "targets": [{
          "expr": "synapse_gpu_utilization_percent",
          "legendFormat": "GPU {{device}}"
        }]
      },
      {
        "title": "Jobs Completed",
        "type": "graph",
        "targets": [{
          "expr": "sum(rate(synapse_jobs_completed_total[5m])) by (status)",
          "legendFormat": "{{status}}"
        }]
      }
    ]
  }
}
```

## 3. Alerting Rules

### Prometheus Alerts
```yaml
# alerts.yml
groups:
  - name: synapse
    rules:
      - alert: HighErrorRate
        expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate"
          
      - alert: HighLatency
        expr: histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency"
          
      - alert: LowCacheHitRate
        expr: cache_hit_rate < 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low cache hit rate"
          
      - alert: GPUOverheating
        expr: synapse_gpu_temperature > 85
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "GPU overheating"
```

### Alertmanager Config
```yaml
# alertmanager.yml
route:
  receiver: 'slack'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty'

receivers:
  - name: 'slack'
    slack_configs:
      - channel: '#alerts'
        title: 'Synapse Alert'
        
  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: '<KEY>'
```

## 4. Performance Profiling

### Node.js Profiling
```typescript
// src/profiling/profile.ts
import { writeFileSync } from 'fs';
import { Session } from 'inspector';

export const startProfiling = async (duration = 60000) => {
  const session = new Session();
  session.connect();
  
  await new Promise((resolve) => {
    session.post('Profiler.enable', () => {
      session.post('Profiler.start', resolve);
    });
  });
  
  await new Promise(r => setTimeout(r, duration));
  
  session.post('Profiler.stop', (err, data) => {
    writeFileSync(`profile-${Date.now()}.cpuprofile`, JSON.stringify(data.profile));
    session.disconnect();
  });
};
```

### Memory Profiling
```typescript
// src/profiling/memory.ts
export const logMemoryUsage = () => {
  const usage = process.memoryUsage();
  console.log({
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`
  });
};

setInterval(logMemoryUsage, 30000);
```

## 5. Distributed Tracing

### Jaeger Configuration
```yaml
# jaeger.yml
apiVersion: v1
kind: ConfigMap
metadata:
  name: jaeger-config
data:
  jaeger.yml: |
    collector:
      num-workers: 50
      queue-size: 2000
    
    storage:
      type: elasticsearch
      options:
        es:
          server-urls: http://elasticsearch:9200
```

### OpenTelemetry Instrumentation
```typescript
// src/tracing/otel.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';

export const initTracing = () => {
  const sdk = new NodeSDK({
    traceExporter: new JaegerExporter({
      endpoint: 'http://jaeger:14268/api/traces'
    }),
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new PgInstrumentation()
    ]
  });
  
  sdk.start();
  return sdk;
};
```

## 6. Log Aggregation

### Fluent Bit Configuration
```ini
# fluent-bit.conf
[INPUT]
    Name tail
    Path /var/log/synapse/*.log
    Parser json
    Tag synapse.*

[FILTER]
    Name kubernetes
    Match synapse.*
    Kube_URL https://kubernetes.default.svc:443

[OUTPUT]
    Name es
    Match synapse.*
    Host elasticsearch
    Port 9200
    Index synapse-logs
```

### Structured Logging
```typescript
// src/logging/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'synapse-backend' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' })
  ]
});

// Usage
logger.info('Job submitted', { jobId: '123', userId: '456' });
logger.error('Processing failed', { error: err.message, stack: err.stack });
```

## 7. Health Checks

```typescript
// src/health/checks.ts
import { Router } from 'express';
import { redis } from '@/cache/redis';
import { prisma } from '@/db/client';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'healthy', time: Date.now() });
});

router.get('/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', error: err.message });
  }
});

export default router;
```

## 8. Monitoring Checklist

- [ ] Prometheus metrics collection
- [ ] Grafana dashboards
- [ ] Alertmanager configuration
- [ ] Jaeger tracing
- [ ] Log aggregation
- [ ] Health check endpoints
- [ ] Performance profiling
- [ ] Error tracking (Sentry)
- [ ] Uptime monitoring
- [ ] Synthetic monitoring
