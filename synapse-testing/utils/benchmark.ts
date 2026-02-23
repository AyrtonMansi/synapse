export class BenchmarkRunner {
  private results: any[] = [];

  async benchmark(options: {
    name: string;
    fn: () => Promise<any>;
    iterations: number;
    warmup?: number;
    concurrency?: number;
  }): Promise<any> {
    const { name, fn, iterations, warmup = 0, concurrency = 1 } = options;

    // Warmup
    for (let i = 0; i < warmup; i++) {
      await fn();
    }

    const times: number[] = [];
    const startTime = performance.now();

    if (concurrency === 1) {
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await fn();
        times.push(performance.now() - start);
      }
    } else {
      const batches = Math.ceil(iterations / concurrency);
      for (let i = 0; i < batches; i++) {
        const batchStart = performance.now();
        const batch = Array(Math.min(concurrency, iterations - i * concurrency))
          .fill(null)
          .map(() => fn());
        await Promise.all(batch);
        times.push(performance.now() - batchStart);
      }
    }

    const totalTime = performance.now() - startTime;
    
    const result = {
      name,
      iterations,
      concurrency,
      totalTime,
      opsPerSecond: (iterations / totalTime) * 1000,
      mean: times.reduce((a, b) => a + b, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      p50: this.percentile(times, 0.5),
      p95: this.percentile(times, 0.95),
      p99: this.percentile(times, 0.99),
    };

    this.results.push(result);
    return result;
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted.sort((a, b) => a - b)[index];
  }

  async generateReport(): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      benchmarks: this.results,
    };

    const fs = await import('fs');
    const path = await import('path');

    const reportPath = path.join(process.cwd(), 'reports', 'benchmark-report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n=== Benchmark Report ===');
    for (const result of this.results) {
      console.log(`${result.name}:`);
      console.log(`  Mean: ${result.mean.toFixed(2)}ms`);
      console.log(`  P95: ${result.p95.toFixed(2)}ms`);
      console.log(`  P99: ${result.p99.toFixed(2)}ms`);
      console.log(`  Ops/sec: ${result.opsPerSecond.toFixed(2)}`);
    }
  }
}
