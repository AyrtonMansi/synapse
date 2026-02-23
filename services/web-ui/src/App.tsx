import { useState, useEffect } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function App() {
  const [input, setInput] = useState('');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({ nodes_online: 0, jobs_today: 0 });
  const [activeTab, setActiveTab] = useState<'gateway' | 'node' | 'test'>('gateway');
  const [testResult, setTestResult] = useState<{servedModel?: string, responseText?: string, error?: string} | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats({ 
          nodes_online: data.nodes_online || 0, 
          jobs_today: data.jobs_today || 0 
        });
      }
    } catch {
      // ignore
    }
  };

  const generateKey = async () => {
    if (!input) return;
    
    setLoading(true);
    try {
      const isEmail = input.includes('@');
      const body = isEmail ? { email: input } : { wallet: input };
      
      const res = await fetch(`${API_URL}/auth/api-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        const data = await res.json();
        setApiKey(data.api_key);
      }
    } finally {
      setLoading(false);
    }
  };

  const copyKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Synapse</h1>
          <p className="text-gray-500 text-sm mt-1">Decentralized AI Inference</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('gateway')}
            className={`flex-1 py-2 text-sm rounded-md transition-colors ${
              activeTab === 'gateway' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Gateway
          </button>
          <button
            onClick={() => setActiveTab('node')}
            className={`flex-1 py-2 text-sm rounded-md transition-colors ${
              activeTab === 'node' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Run a Node
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`flex-1 py-2 text-sm rounded-md transition-colors ${
              activeTab === 'test' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Test
          </button>
        </div>

        {activeTab === 'gateway' ? (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            {!apiKey ? (
              <>
                <div className="mb-4">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="email or wallet address"
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-gray-700 transition-colors"
                  />
                </div>
                <button
                  onClick={generateKey}
                  disabled={loading || !input}
                  className="w-full bg-white text-black font-medium py-3 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Generating...' : 'Generate API Key'}
                </button>
              </>
            ) : (
              <div className="text-center">
                <div className="text-green-500 text-sm mb-2">API Key Generated</div>
                <div className="bg-gray-950 rounded-lg p-3 mb-3 font-mono text-sm break-all text-gray-300">
                  {apiKey}
                </div>
                <button
                  onClick={copyKey}
                  className="text-sm text-gray-500 hover:text-white transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy to clipboard'}
                </button>
                
                <div className="mt-6 text-left">
                  <div className="text-xs text-gray-500 mb-2">Example usage:</div>
                  <pre className="bg-gray-950 rounded-lg p-3 text-xs text-gray-400 overflow-x-auto">
                    {`curl ${API_URL}/v1/chat/completions \\
  -H "Authorization: Bearer ${apiKey.slice(0, 20)}..." \\
  -d '{"model":"deepseek-v3","messages":[{"role":"user","content":"Hello"}]}'`}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="text-sm text-gray-400 mb-4">
              Run a GPU node and earn SYN tokens
            </div>
            
            <div className="bg-gray-950 rounded-lg p-3 mb-4">
              <code className="text-xs text-gray-300 font-mono">
                curl -sSL https://synapse.sh/install | bash
              </code>
            </div>
            
            <div className="text-xs text-gray-500 space-y-1">
              <div>• Detects GPU automatically</div>
              <div>• Connects to router at {API_URL.replace(':3001', ':3002')}</div>
              <div>• Starts earning on job completion</div>
            </div>
          </div>
        )}

        {activeTab === 'test' && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="text-sm text-gray-400 mb-4">
              Test inference and verify served model
            </div>
            
            <button
              onClick={async () => {
                if (!apiKey) {
                  setTestResult({ error: 'Generate API key first' });
                  return;
                }
                setTestLoading(true);
                try {
                  const res = await fetch(`${API_URL}/v1/chat/completions`, {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                      model: 'deepseek-v3',
                      messages: [{ role: 'user', content: 'Say hello' }],
                      max_tokens: 50
                    })
                  });
                  const servedModel = res.headers.get('x-synapse-model-served') || 'unknown';
                  const data = await res.json();
                  setTestResult({
                    servedModel,
                    responseText: data.choices?.[0]?.message?.content || JSON.stringify(data)
                  });
                } catch (e) {
                  setTestResult({ error: String(e) });
                } finally {
                  setTestLoading(false);
                }
              }}
              disabled={testLoading}
              className="w-full bg-white text-black font-medium py-3 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              {testLoading ? 'Testing...' : 'Test Completion'}
            </button>

            {testResult?.error && (
              <div className="mt-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
                {testResult.error}
              </div>
            )}

            {testResult?.servedModel && (
              <div className="mt-4 space-y-3">
                <div className="p-3 bg-gray-950 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Served Model (from header)</div>
                  <div className={`font-mono text-sm ${testResult.servedModel === 'deepseek-v3' ? 'text-green-400' : 'text-yellow-400'}`}>
                    {testResult.servedModel}
                  </div>
                </div>
                <div className="p-3 bg-gray-950 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Response Preview</div>
                  <div className="text-sm text-gray-300 line-clamp-3">
                    {testResult.responseText}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="mt-6 flex justify-center gap-6 text-xs text-gray-500">
          <span>Nodes online: <span className="text-white">{stats.nodes_online}</span></span>
          <span>Jobs today: <span className="text-white">{stats.jobs_today}</span></span>
        </div>
      </div>
    </div>
  );
}

export default App;