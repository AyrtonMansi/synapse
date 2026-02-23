#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TESTS_DIR = path.join(__dirname, '..');

function runBenchmarks() {
  console.log('⚡ Running Performance Benchmarks...\n');
  
  try {
    execSync('npx vitest run performance/benchmarks.test.ts', {
      stdio: 'inherit',
      cwd: TESTS_DIR,
    });
    
    console.log('\n✅ Benchmarks completed');
    return 0;
  } catch (e) {
    console.error('\n❌ Benchmarks failed');
    return 1;
  }
}

function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║    Synapse Performance Test Suite      ║');
  console.log('╚════════════════════════════════════════╝\n');

  const failed = runBenchmarks();
  process.exit(failed);
}

if (require.main === module) {
  main();
}
