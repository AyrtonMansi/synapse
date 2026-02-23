import { useState, useEffect } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface TestResult {
  responseText?: string;
  servedModel?: string;
  requestedModel?: string;
  isFallback?: boolean;
  receiptVerified?: string;
  nodeId?: string;
  error?: string;
  headers?: Record<string, string>;
}

// P1.4: Yield estimate interface
interface YieldEstimate {
  fingerprint: string;
  model: string;
  hardware: string;
  tok_per_sec: number;
  utilization_percent: number;
  jobs_per_hour: number;
  rate_per_1m_tokens: number;
  estimated_revenue_per_day: {
    low: number;
    expected: number;
    high: number;
  };
  health_score: number;
  success_rate: number;
}

function App() {
  const [input, setInput] = useState('');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({ nodes_online: 0, jobs_today: 0 });
  const [activeTab, setActiveTab] = useState<'gateway' | 'node' | 'test' | 'dashboard'>('gateway');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  // P1.4: Yield estimate state
  const [yieldEstimates, setYieldEstimates] = useState<YieldEstimate[]>([]);
  const [yieldLoading, setYieldLoading] = useState(false);

  useEffect(() => {
    fetchStats();
    // P1.4: Fetch yield estimates when on test tab
    if (activeTab === 'test') {
      fetchYieldEstimates();
    }
    const interval = setInterval(() => {
      fetchStats();
      if (activeTab === 'test') {
        fetchYieldEstimates();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab]);

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

  // P1.4: Fetch yield estimates from gateway
  const fetchYieldEstimates = async () => {
    setYieldLoading(true);
    try {
      const res = await fetch(`${API_URL}/yield-estimate`);
      if (res.ok) {
        const data = await res.json();
        setYieldEstimates(data.estimates || []);
      }
    } catch {
      // ignore
    } finally {
      setYieldLoading(false);
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

  // P0 TASK 3: Test completion and show served model
  const runTest = async () => {
    if (!apiKey) return;
    
    setTestLoading(true);
    setTestResult(null);
    
    try {
      const res = await fetch(`${API_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek-v3',
          messages: [{ role: 'user', content: 'Say hello in one word' }],
          max_tokens: 10
        })
      });
      
      // Capture headers
      const headers: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        if (key.startsWith('x-synapse')) {
          headers[key] = value;
        }
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setTestResult({
          responseText: data.choices?.[0]?.message?.content || 'No response',
          servedModel: data.model || headers['x-synapse-model-served'],
          requestedModel: data.synapse_meta?.requested_model || headers['x-synapse-model-requested'],
          isFallback: data.synapse_meta?.fallback === true || headers['x-synapse-fallback'] === 'true',
          receiptVerified: data.synapse_meta?.receipt_verified,
          nodeId: data.synapse_meta?.node_id,
          headers
        });
      } else {
        setTestResult({
          error: data.error || data.message || 'Request failed'
        });
      }
    } catch (err) {
      setTestResult({
        error: err instanceof Error ? err.message : 'Network error'
      });
    } finally {
      setTestLoading(false);
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
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 py-2 text-sm rounded-md transition-colors ${
              activeTab === 'dashboard' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('node')}
            className={`flex-1 py-2 text-sm rounded-md transition-colors ${
              activeTab === 'node' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Run Node
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
                    {`curl ${API_URL}/v1/chat/completions \\\n  -H "Authorization: Bearer ${apiKey.slice(0, 20)}..." \\\n  -d '{"model":"deepseek-v3","messages":[{"role":"user","content":"Hello"]}'`}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'dashboard' ? (
          // PHASE 10: Miner Performance Dashboard
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="text-sm text-gray-400 mb-4">
              Network Performance Dashboard
            </div>

            {yieldLoading ? (
              <div className="text-center py-4 text-gray-500">Loading node metrics...</div>
            ) : yieldEstimates.length === 0 ? (
              <div className="text-xs text-gray-600 text-center py-4">
                No active GPU nodes with benchmarks
                <div className="mt-2 text-gray-500">Start a node to see metrics</div>
              </div>
            ) : (
              <div className="space-y-4">
                {yieldEstimates.map((estimate, idx) => (
                  <div key={idx} className="bg-gray-950 rounded-lg p-4 space-y-3">
                    {/* Node Identity */}
                    <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                      <span className="text-xs text-gray-400">Node</span>
                      <span className="text-xs font-mono text-gray-300">
                        {estimate.fingerprint.slice(0, 12)}...
                      </span>
                    </div>

                    {/* Performance Metrics */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-900 rounded p-2">
                        <div className="text-[10px] text-gray-500">Throughput</div>
                        <div className="text-sm font-semibold text-green-400">
                          {estimate.tok_per_sec > 0 ? `${estimate.tok_per_sec} tok/s` : 'N/A'}
                        </div>
                      </div>
                      <div className="bg-gray-900 rounded p-2">
                        <div className="text-[10px] text-gray-500">Utilization</div>
                        <div className="text-sm font-semibold text-blue-400">
                          {estimate.utilization_percent.toFixed(1)}%
                        </div>
                      </div>
                      <div className="bg-gray-900 rounded p-2">
                        <div className="text-[10px] text-gray-500">Jobs/Hour</div>
                        <div className="text-sm font-semibold text-purple-400">
                          {estimate.jobs_per_hour.toFixed(1)}
                        </div>
                      </div>
                      <div className="bg-gray-900 rounded p-2">
                        <div className="text-[10px] text-gray-500">Health Score</div>
                        <div className={`text-sm font-semibold ${
                          estimate.health_score > 0.8 ? 'text-green-400' :
                          estimate.health_score > 0.5 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {(estimate.health_score * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>

                    {/* Model & Hardware */}
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Model: <span className="text-gray-300">{estimate.model}</span></span>
                      <span className="text-gray-500">Hardware: <span className="text-gray-300">{estimate.hardware}</span></span>
                    </div>

                    {/* Revenue Estimate */}
                    <div className="bg-gray-900 rounded p-3 mt-2">
                      <div className="text-[10px] text-gray-500 mb-2">Estimated Daily Revenue</div>
                      <div className="flex justify-between items-end">
                        <div className="text-center">
                          <div className="text-[10px] text-gray-600">Low</div>
                          <div className="text-xs text-yellow-500">${estimate.estimated_revenue_per_day.low.toFixed(2)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-gray-600">Expected</div>
                          <div className="text-lg font-bold text-green-400">${estimate.estimated_revenue_per_day.expected.toFixed(2)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-gray-600">High</div>
                          <div className="text-xs text-yellow-500">${estimate.estimated_revenue_per_day.high.toFixed(2)}</div>
                        </div>
                      </div>
                      <div className="text-[10px] text-gray-600 mt-2 italic text-center">
                        *estimate based on current utilization and rate
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'node' ? (
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
        ) : (
          // P0 TASK 3 + P1.4: Test tab with served model display and yield estimates
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <div className="text-sm text-gray-400 mb-4">
              Test inference and view miner yield estimates
            </div>
            
            {!apiKey ? (
              <div className="text-sm text-gray-500 text-center py-4">
                Generate an API key first to run tests
              </div>
            ) : (
              <>
                <button
                  onClick={runTest}
                  disabled={testLoading}
                  className="w-full bg-white text-black font-medium py-3 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-4"
                >
                  {testLoading ? 'Testing...' : 'Test Completion'}
                </button>
                
                {testResult && (
                  <div className="space-y-3 mb-6">
                    {testResult.error ? (
                      <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
                        <div className="text-red-400 text-sm font-medium">Error</div>
                        <div className="text-red-300 text-sm">{testResult.error}</div>
                      </div>
                    ) : (
                      <>
                        {/* Response text */}
                        <div className="bg-gray-950 rounded-lg p-3">
                          <div className="text-xs text-gray-500 mb-1">Response</div>
                          <div className="text-sm text-gray-300">{testResult.responseText}</div>
                        </div>
                        
                        {/* Model info */}
                        <div className="bg-gray-950 rounded-lg p-3 space-y-2">
                          <div className="text-xs text-gray-500 mb-2">Model Information</div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Requested</span>
                            <span className="text-sm font-mono text-gray-300">{testResult.requestedModel}</span>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Served</span>
                            <span className={`text-sm font-mono ${
                              testResult.servedModel === testResult.requestedModel 
                                ? 'text-green-400' 
                                : 'text-yellow-400'
                            }`}>
                              {testResult.servedModel}
                            </span>
                          </div>
                          
                          {testResult.isFallback && (
                            <div className="bg-yellow-900/30 border border-yellow-800 rounded px-2 py-1 mt-2">
                              <span className="text-xs text-yellow-400">⚠️ Fallback to echo-stub</span>
                            </div>
                          )}
                          
                          <div className="flex justify-between items-center pt-2 border-t border-gray-800">
                            <span className="text-xs text-gray-400">Node</span>
                            <span className="text-xs font-mono text-gray-500 truncate max-w-[150px]">
                              {testResult.nodeId || 'unknown'}
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Receipt</span>
                            <span className={`text-xs ${
                              testResult.receiptVerified === 'valid' 
                                ? 'text-green-400' 
                                : testResult.receiptVerified?.startsWith('invalid')
                                ? 'text-red-400'
                                : 'text-yellow-400'
                            }`}>
                              {testResult.receiptVerified || 'unsigned'}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
                
                {/* P1.4: Yield Estimates Section */}
                <div className="border-t border-gray-800 pt-4">
                  <div className="text-xs text-gray-500 mb-3 flex items-center justify-between">
                    <span>Miner Yield Estimates</span>
                    {yieldLoading && <span className="text-gray-600">Loading...</span>}
                  </div>
                  
                  {yieldEstimates.length === 0 ? (
                    <div className="text-xs text-gray-600 text-center py-4">
                      No active GPU nodes with benchmarks
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {yieldEstimates.map((estimate, idx) => (
                        <div key={idx} className="bg-gray-950 rounded-lg p-3 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Fingerprint</span>
                            <span className="text-xs font-mono text-gray-300">
                              {estimate.fingerprint.slice(0, 8)}...
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Model</span>
                            <span className="text-xs text-gray-300">{estimate.model}</span>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Throughput</span>
                            <span className="text-xs text-green-400">
                              {estimate.tok_per_sec > 0 ? `${estimate.tok_per_sec} tok/s` : 'N/A'}
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Utilization</span>
                            <span className="text-xs text-blue-400">
                              {estimate.utilization_percent.toFixed(1)}%
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400">Jobs/Hour</span>
                            <span className="text-xs text-purple-400">
                              {estimate.jobs_per_hour.toFixed(1)}
                            </span>
                          </div>
                          
                          {/* P1.4: Revenue estimate band */}
                          <div className="pt-2 border-t border-gray-800">
                            <div className="text-xs text-gray-500 mb-1">Est. Daily Revenue</div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-600">Low</span>
                              <span className="text-xs text-yellow-500">${estimate.estimated_revenue_per_day.low.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-600">Expected</span>
                              <span className="text-sm font-semibold text-green-400">${estimate.estimated_revenue_per_day.expected.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-600">High</span>
                              <span className="text-xs text-yellow-500">${estimate.estimated_revenue_per_day.high.toFixed(2)}</span>
                            </div>
                            <div className="text-[10px] text-gray-600 mt-1 italic">
                              *estimate based on current utilization
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
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
