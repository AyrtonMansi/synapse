export function Sessions() {
  return (
    <div className="error-state">
      <h3>Sessions</h3>
      <p>Session history coming soon.</p>
    </div>
  );
}

export function Usage() {
  return (
    <div className="error-state">
      <h3>Usage</h3>
      <p>Usage analytics coming soon.</p>
    </div>
  );
}

export function Earnings() {
  return (
    <div className="error-state">
      <h3>Earnings</h3>
      <p>Earnings dashboard coming soon.</p>
    </div>
  );
}

export function Settings() {
  return (
    <div className="error-state">
      <h3>Settings</h3>
      <p>Configuration options coming soon.</p>
    </div>
  );
}

export function Docs() {
  return (
    <div className="error-state">
      <h3>Documentation</h3>
      <p>API documentation coming soon.</p>
      <pre className="code-block" style={{ marginTop: '24px', textAlign: 'left' }}>
        {`# Quick Reference

POST /v1/chat/completions
  -H "Authorization: Bearer \${API_KEY}"
  -d '{"model":"deepseek-v3","messages":[{"role":"user","content":"Hello"}]}'

GET /stats
  → { nodes_online, jobs_today, tokens_processed }

GET /yield-estimate
  → { estimates: [{ fingerprint, tok_per_sec, health_score }] }`}
      </pre>
    </div>
  );
}
