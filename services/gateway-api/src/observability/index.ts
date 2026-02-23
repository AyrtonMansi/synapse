/**
 * PHASE 11: SRE Observability
 * Prometheus metrics, structured logging, health checks
 */

import { FastifyInstance } from 'fastify';

// Metric types
interface Counter {
  name: string;
  help: string;
  value: number;
  labels: Record<string, string>;
}

interface Gauge {
  name: string;
  help: string;
  value: number;
  labels: Record<string, string>;
}

interface Histogram {
  name: string;
  help: string;
  buckets: number[];
  values: number[];
  labels: Record<string, string>;
}

class MetricsRegistry {
  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, Gauge> = new Map();
  private histograms: Map<string, Histogram> = new Map();

  /**
   * Increment a counter metric
   */
  inc(name: string, help: string, value: number = 1, labels: Record<string, string> = {}): void {
    const key = this.key(name, labels);
    const existing = this.counters.get(key);
    
    if (existing) {
      existing.value += value;
    } else {
      this.counters.set(key, { name, help, value, labels });
    }
  }

  /**
   * Set a gauge metric
   */
  set(name: string, help: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.key(name, labels);
    this.gauges.set(key, { name, help, value, labels });
  }

  /**
   * Observe a histogram value
   */
  observe(name: string, help: string, value: number, buckets: number[] = [0.1, 0.5, 1, 2, 5, 10], labels: Record<string, string> = {}): void {
    const key = this.key(name, labels);
    const existing = this.histograms.get(key);
    
    if (existing) {
      existing.values.push(value);
    } else {
      this.histograms.set(key, { name, help, buckets, values: [value], labels });
    }
  }

  /**
   * Export metrics in Prometheus format
   */
  export(): string {
    const lines: string[] = [];
    
    // Counters
    for (const counter of this.counters.values()) {
      lines.push(`# HELP ${counter.name} ${counter.help}`);
      lines.push(`# TYPE ${counter.name} counter`);
      const labelStr = this.formatLabels(counter.labels);
      lines.push(`${counter.name}${labelStr} ${counter.value}`);
      lines.push('');
    }
    
    // Gauges
    for (const gauge of this.gauges.values()) {
      lines.push(`# HELP ${gauge.name} ${gauge.help}`);
      lines.push(`# TYPE ${gauge.name} gauge`);
      const labelStr = this.formatLabels(gauge.labels);
      lines.push(`${gauge.name}${labelStr} ${gauge.value}`);
      lines.push('');
    }
    
    // Histograms
    for (const hist of this.histograms.values()) {
      lines.push(`# HELP ${hist.name} ${hist.help}`);
      lines.push(`# TYPE ${hist.name} histogram`);
      const labelStr = this.formatLabels(hist.labels);
      
      // Calculate bucket counts
      const sorted = [...hist.values].sort((a, b) => a - b);
      for (const bucket of hist.buckets) {
        const count = sorted.filter(v => v <= bucket).length;
        lines.push(`${hist.name}_bucket{le="${bucket}"}${labelStr} ${count}`);
      }
      lines.push(`${hist.name}_bucket{le="+Inf"}${labelStr} ${sorted.length}`);
      lines.push(`${hist.name}_sum${labelStr} ${sorted.reduce((a, b) => a + b, 0)}`);
      lines.push(`${hist.name}_count${labelStr} ${sorted.length}`);
      lines.push('');
    }
    
    return lines.join('\n');
  }

  private key(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  private formatLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) return '';
    return '{' + entries.map(([k, v]) => `${k}="${v}"`).join(',') + '}';
  }
}

// Global registry
export const metrics = new MetricsRegistry();

/**
 * Structured logging
 */
interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  service: string;
  traceId?: string;
  spanId?: string;
  [key: string]: any;
}

export class StructuredLogger {
  constructor(private service: string) {}

  private log(level: LogEntry['level'], message: string, meta: Record<string, any> = {}): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      ...meta
    };
    
    // Output as JSON for log aggregation
    console.log(JSON.stringify(entry));
  }

  debug(message: string, meta?: Record<string, any>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, any>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.log('warn', message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, any>): void {
    this.log('error', message, {
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : undefined,
      ...meta
    });
  }
}

/**
 * Health check system
 */
interface HealthCheck {
  name: string;
  check: () => Promise<{ healthy: boolean; message?: string }>;
  critical: boolean;
}

class HealthCheckRegistry {
  private checks: HealthCheck[] = [];

  register(check: HealthCheck): void {
    this.checks.push(check);
  }

  async runAll(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, { healthy: boolean; message?: string }>;
  }> {
    const results: Record<string, { healthy: boolean; message?: string }> = {};
    let hasCriticalFailure = false;
    let hasAnyFailure = false;

    for (const check of this.checks) {
      try {
        const result = await check.check();
        results[check.name] = result;
        
        if (!result.healthy) {
          hasAnyFailure = true;
          if (check.critical) {
            hasCriticalFailure = true;
          }
        }
      } catch (error) {
        results[check.name] = { 
          healthy: false, 
          message: error instanceof Error ? error.message : 'Unknown error' 
        };
        hasAnyFailure = true;
        if (check.critical) hasCriticalFailure = true;
      }
    }

    return {
      status: hasCriticalFailure ? 'unhealthy' : hasAnyFailure ? 'degraded' : 'healthy',
      checks: results
    };
  }
}

export const healthChecks = new HealthCheckRegistry();

/**
 * Fastify plugin for observability
 */
export async function registerObservability(app: FastifyInstance, serviceName: string): Promise<void> {
  const logger = new StructuredLogger(serviceName);

  // Request logging middleware
  app.addHook('onRequest', async (request) => {
    (request as any).startTime = Date.now();
  });

  app.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - ((request as any).startTime || Date.now());
    
    logger.info('Request completed', {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      durationMs: duration,
      userAgent: request.headers['user-agent'],
      ip: request.ip
    });

    // Record metrics
    metrics.inc('http_requests_total', 'Total HTTP requests', 1, {
      method: request.method,
      status: reply.statusCode.toString(),
      path: request.routerPath || request.url
    });
    
    metrics.observe('http_request_duration_seconds', 'HTTP request duration', duration / 1000, [0.1, 0.5, 1, 2, 5, 10], {
      method: request.method,
      path: request.routerPath || request.url
    });
  });

  // Error logging
  app.addHook('onError', async (request, reply, error) => {
    logger.error('Request error', error, {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode
    });

    metrics.inc('http_errors_total', 'Total HTTP errors', 1, {
      method: request.method,
      status: reply.statusCode.toString()
    });
  });

  // Metrics endpoint
  app.get('/metrics', async (_, reply) => {
    reply.type('text/plain');
    return metrics.export();
  });

  // Health endpoint
  app.get('/health', async () => {
    return healthChecks.runAll();
  });

  // Readiness endpoint (for K8s)
  app.get('/ready', async (_, reply) => {
    const result = await healthChecks.runAll();
    reply.status(result.status === 'healthy' ? 200 : 503);
    return result;
  });

  logger.info('Observability registered', { service: serviceName });
}
