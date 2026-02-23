#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TESTS_DIR = path.join(__dirname, '..');
const REPORTS_DIR = path.join(TESTS_DIR, 'reports');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function runSecurityTests() {
  console.log('🔒 Running Security Tests...\n');
  
  const tests = [
    { name: 'Penetration Tests', cmd: 'npx vitest run security/penetration.test.ts' },
    { name: 'Access Control Tests', cmd: 'npx vitest run security/access-control.test.ts' },
    { name: 'Dependency Audit', cmd: 'npm audit' },
  ];

  let failed = 0;

  for (const test of tests) {
    console.log(`\n📋 ${test.name}`);
    console.log('='.repeat(50));
    
    try {
      execSync(test.cmd, { stdio: 'inherit', cwd: TESTS_DIR });
      console.log(`✅ ${test.name} passed\n`);
    } catch (e) {
      console.error(`❌ ${test.name} failed\n`);
      failed++;
    }
  }

  return failed;
}

function main() {
  ensureDir(REPORTS_DIR);

  console.log('╔════════════════════════════════════════╗');
  console.log('║     Synapse Security Test Suite        ║');
  console.log('╚════════════════════════════════════════╝\n');

  const failed = runSecurityTests();

  console.log('\n' + '='.repeat(50));
  if (failed === 0) {
    console.log('✅ All security tests passed!');
    process.exit(0);
  } else {
    console.log(`❌ ${failed} test(s) failed`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
