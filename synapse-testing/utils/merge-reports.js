const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '..', 'reports');

function mergeReports() {
  console.log('📊 Merging test reports...\n');

  const reports = {
    timestamp: new Date().toISOString(),
    summary: {},
    results: {},
  };

  // Collect all report files
  const reportFiles = [
    { name: 'unit', file: 'unit-results.json' },
    { name: 'integration', file: 'integration-results.json' },
    { name: 'security', file: 'security-results.json' },
    { name: 'benchmark', file: 'benchmark-report.json' },
    { name: 'load', file: 'load-test.json' },
  ];

  for (const { name, file } of reportFiles) {
    const filePath = path.join(REPORTS_DIR, file);
    
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        reports.results[name] = data;
        console.log(`✅ Loaded ${name} report`);
      } catch (e) {
        console.warn(`⚠️ Could not parse ${file}`);
      }
    } else {
      console.warn(`⚠️ Report not found: ${file}`);
    }
  }

  // Generate summary
  reports.summary = {
    totalSuites: Object.keys(reports.results).length,
    testTypes: Object.keys(reports.results),
  };

  // Save merged report
  const outputPath = path.join(REPORTS_DIR, 'merged-report.json');
  fs.writeFileSync(outputPath, JSON.stringify(reports, null, 2));

  console.log(`\n✅ Merged report saved to: ${outputPath}`);
  
  // Generate HTML report
  generateHTMLReport(reports, outputPath.replace('.json', '.html'));
  
  return reports;
}

function generateHTMLReport(reports, outputPath) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Synapse Test Report</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
    .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .test-type { background: #fff; padding: 15px; margin: 10px 0; border-left: 4px solid #007acc; }
    pre { background: #f5f5f5; padding: 15px; overflow-x: auto; }
    .timestamp { color: #666; }
  </style>
</head>
<body>
  <h1>🧪 Synapse Test Report</h1>
  <p class="timestamp">Generated: ${reports.timestamp}</p>
  
  <div class="summary">
    <h2>Summary</h2>
    <p>Total test suites: ${reports.summary.totalSuites}</p>
    <p>Test types: ${reports.summary.testTypes.join(', ')}</p>
  </div>

  <h2>Results by Type</h2>
  ${Object.entries(reports.results).map(([name, data]) => `
    <div class="test-type">
      <h3>${name}</h3>
      <pre>${JSON.stringify(data, null, 2)}</pre>
    </div>
  `).join('')}
</body>
</html>`;

  fs.writeFileSync(outputPath, html);
  console.log(`✅ HTML report saved to: ${outputPath}`);
}

if (require.main === module) {
  mergeReports();
}

module.exports = { mergeReports };
