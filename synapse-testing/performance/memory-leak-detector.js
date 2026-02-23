const { createServer } = require('http');
const v8 = require('v8');
const fs = require('fs');
const path = require('path');

class MemoryLeakDetector {
  constructor(options = {}) {
    this.threshold = options.threshold || 10 * 1024 * 1024; // 10MB
    this.interval = options.interval || 5000; // 5 seconds
    this.maxSnapshots = options.maxSnapshots || 10;
    this.snapshots = [];
    this.running = false;
    this.heapStats = [];
  }

  start() {
    this.running = true;
    this.collectBaseline();
    
    this.monitorInterval = setInterval(() => {
      this.collectStats();
    }, this.interval);

    console.log('Memory leak detection started');
  }

  stop() {
    this.running = false;
    clearInterval(this.monitorInterval);
    this.generateReport();
  }

  collectBaseline() {
    if (global.gc) {
      global.gc();
    }
    
    this.baseline = {
      heapUsed: process.memoryUsage().heapUsed,
      heapTotal: process.memoryUsage().heapTotal,
      external: process.memoryUsage().external,
      timestamp: Date.now(),
    };
  }

  collectStats() {
    const stats = {
      ...process.memoryUsage(),
      timestamp: Date.now(),
      heapStats: v8.getHeapStatistics(),
    };

    this.heapStats.push(stats);

    // Check for leak
    if (this.heapStats.length > 10) {
      this.analyzeTrend();
    }

    // Keep only last 100 measurements
    if (this.heapStats.length > 100) {
      this.heapStats.shift();
    }
  }

  analyzeTrend() {
    const recent = this.heapStats.slice(-10);
    const first = recent[0].heapUsed;
    const last = recent[recent.length - 1].heapUsed;
    const growth = last - first;

    if (growth > this.threshold) {
      console.warn(`⚠️ Potential memory leak detected: ${(growth / 1024 / 1024).toFixed(2)}MB growth`);
      this.captureSnapshot();
    }
  }

  captureSnapshot() {
    if (this.snapshots.length >= this.maxSnapshots) {
      return;
    }

    const snapshot = v8.writeHeapSnapshot();
    this.snapshots.push({
      path: snapshot,
      timestamp: Date.now(),
    });

    console.log(`Heap snapshot saved: ${snapshot}`);
  }

  generateReport() {
    const report = {
      summary: {
        duration: this.heapStats.length > 0 
          ? this.heapStats[this.heapStats.length - 1].timestamp - this.baseline.timestamp
          : 0,
        totalGrowth: this.heapStats.length > 0
          ? this.heapStats[this.heapStats.length - 1].heapUsed - this.baseline.heapUsed
          : 0,
        snapshotsTaken: this.snapshots.length,
        leakDetected: this.snapshots.length > 0,
      },
      baseline: this.baseline,
      final: this.heapStats[this.heapStats.length - 1],
      trend: this.heapStats.map(s => ({
        timestamp: s.timestamp,
        heapUsed: s.heapUsed,
        heapTotal: s.heapTotal,
        external: s.external,
      })),
      snapshots: this.snapshots,
    };

    const reportPath = path.join(__dirname, '../../reports/memory-leak-report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n=== Memory Leak Report ===');
    console.log(`Duration: ${(report.summary.duration / 1000).toFixed(2)}s`);
    console.log(`Total Growth: ${(report.summary.totalGrowth / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Leak Detected: ${report.summary.leakDetected}`);
    console.log(`Report saved to: ${reportPath}`);

    return report;
  }
}

// Example test scenarios
async function runMemoryTests() {
  const detector = new MemoryLeakDetector({
    threshold: 5 * 1024 * 1024, // 5MB
    interval: 1000,
  });

  detector.start();

  // Simulate various memory scenarios
  console.log('Running memory tests...\n');

  // Test 1: Normal operation
  console.log('Test 1: Normal operation');
  await testNormalOperation(10000);

  // Test 2: Event emitter leak
  console.log('Test 2: Event emitter pattern');
  await testEventEmitterLeak();

  // Test 3: Closure leak
  console.log('Test 3: Closure pattern');
  await testClosureLeak();

  // Test 4: Cache growth
  console.log('Test 4: Unbounded cache');
  await testCacheGrowth();

  detector.stop();

  const report = detector.generateReport();
  
  if (report.summary.leakDetected) {
    console.log('\n⚠️ Memory leaks detected! Analyze heap snapshots for details.');
    process.exit(1);
  } else {
    console.log('\n✓ No significant memory leaks detected');
  }
}

async function testNormalOperation(duration) {
  return new Promise(resolve => {
    const data = [];
    const interval = setInterval(() => {
      // Normal allocation that gets cleaned up
      data.push(Buffer.alloc(1024));
      if (data.length > 100) {
        data.shift();
      }
    }, 100);

    setTimeout(() => {
      clearInterval(interval);
      if (global.gc) global.gc();
      resolve();
    }, duration);
  });
}

async function testEventEmitterLeak() {
  const EventEmitter = require('events');
  const emitter = new EventEmitter();

  for (let i = 0; i < 1000; i++) {
    // Adding listeners without removing them
    emitter.on('test', () => {
      const data = new Array(1000).fill(i);
      return data;
    });
  }

  emitter.emit('test');
}

async function testClosureLeak() {
  const cache = [];

  function createClosure() {
    const largeData = new Array(10000).fill('data');
    return function() {
      return largeData;
    };
  }

  for (let i = 0; i < 1000; i++) {
    cache.push(createClosure());
  }
}

async function testCacheGrowth() {
  const cache = new Map();

  for (let i = 0; i < 10000; i++) {
    cache.set(`key-${i}`, {
      data: new Array(1000).fill(i),
      timestamp: Date.now(),
    });
  }

  // No eviction policy - unbounded growth
}

// Run if called directly
if (require.main === module) {
  runMemoryTests().catch(console.error);
}

module.exports = { MemoryLeakDetector };
