import { useState } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { formatEther } from 'viem';
import { useNavigate } from 'react-router-dom';
import { useSynapse } from '../hooks/useSynapse';

export default function Dashboard() {
  const navigate = useNavigate();
  const { address } = useAccount();
  const { data: ethBalance } = useBalance({ address });
  const { synBalance } = useSynapse();
  const [activeTab, setActiveTab] = useState('keys');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <span className="text-xl font-semibold">Synapse</span>
              <nav className="hidden md:flex gap-6 text-sm">
                <button 
                  onClick={() => setActiveTab('keys')}
                  className={`${activeTab === 'keys' ? 'text-black font-medium' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  API Keys
                </button>
                <button 
                  onClick={() => setActiveTab('usage')}
                  className={`${activeTab === 'usage' ? 'text-black font-medium' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Usage
                </button>
                <button 
                  onClick={() => setActiveTab('nodes')}
                  className={`${activeTab === 'nodes' ? 'text-black font-medium' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Nodes
                </button>
                <button 
                  onClick={() => setActiveTab('billing')}
                  className={`${activeTab === 'billing' ? 'text-black font-medium' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Billing
                </button>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {synBalance ? parseFloat(synBalance).toFixed(2) : '0'} SYN
              </span>
              <span className="text-sm text-gray-400">|</span>
              <span className="text-sm text-gray-600 font-mono">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'keys' && <ApiKeysTab />}
        {activeTab === 'usage' && <UsageTab />}
        {activeTab === 'nodes' && <NodesTab />}
        {activeTab === 'billing' && <BillingTab synBalance={synBalance} ethBalance={ethBalance} />}
      </main>
    </div>
  );
}

function ApiKeysTab() {
  const [keys, setKeys] = useState([
    { id: 1, name: 'Production', key: 'syn_live_xxxxxxxxxxxx', created: '2024-02-20', usage: 450000 },
    { id: 2, name: 'Development', key: 'syn_test_xxxxxxxxxxxx', created: '2024-02-18', usage: 12000 },
  ]);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');

  const createKey = () => {
    if (!newName) return;
    setKeys([...keys, {
      id: Date.now(),
      name: newName,
      key: 'syn_live_' + Math.random().toString(36).substr(2, 12),
      created: new Date().toISOString().split('T')[0],
      usage: 0
    }]);
    setNewName('');
    setShowNew(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">API Keys</h1>
          <p className="text-gray-600">Manage your API keys for accessing AI models</p>
        </div>
        <button 
          onClick={() => setShowNew(true)}
          className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800"
        >
          Create New Key
        </button>
      </div>

      {showNew && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <input
            type="text"
            placeholder="Key name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 mr-2"
          />
          <button 
            onClick={createKey}
            className="bg-black text-white px-4 py-2 rounded-lg text-sm"
          >
            Create
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">Name</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">Key</th>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">Created</th>
              <th className="text-right px-6 py-3 text-sm font-medium text-gray-900">Usage</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key.id} className="border-b border-gray-100 last:border-0">
                <td className="px-6 py-4 text-sm text-gray-900">{key.name}</td>
                <td className="px-6 py-4 text-sm font-mono text-gray-600">{key.key.slice(0, 20)}...</td>
                <td className="px-6 py-4 text-sm text-gray-600">{key.created}</td>
                <td className="px-6 py-4 text-sm text-right text-gray-900">{key.usage.toLocaleString()} tokens</td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => setKeys(keys.filter(k => k.id !== key.id))}
                    className="text-red-600 text-sm hover:text-red-800"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 bg-gray-900 rounded-xl p-6">
        <h3 className="text-white font-medium mb-2">Quick Start</h3>
        <pre className="text-sm text-gray-400 overflow-x-auto">
          <code>{`curl https://api.synapse.network/v1/chat/completions \\
  -H "Authorization: Bearer syn_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "deepseek-v3", "messages": [{"role": "user", "content": "Hello"}]}'`}</code>
        </pre>
      </div>
    </div>
  );
}

function UsageTab() {
  const usage = [
    { date: 'Feb 17', requests: 1200, tokens: 45000, cost: 0.07 },
    { date: 'Feb 18', requests: 1500, tokens: 52000, cost: 0.08 },
    { date: 'Feb 19', requests: 1800, tokens: 61000, cost: 0.09 },
    { date: 'Feb 20', requests: 1400, tokens: 48000, cost: 0.07 },
    { date: 'Feb 21', requests: 2100, tokens: 75000, cost: 0.11 },
    { date: 'Feb 22', requests: 1900, tokens: 68000, cost: 0.10 },
    { date: 'Feb 23', requests: 450, tokens: 15000, cost: 0.02 },
  ];

  const totalTokens = usage.reduce((sum, d) => sum + d.tokens, 0);
  const totalCost = usage.reduce((sum, d) => sum + d.cost, 0);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Usage</h1>
      
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm text-gray-600 mb-1">Total Tokens</p>
          <p className="text-2xl font-semibold">{totalTokens.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm text-gray-600 mb-1">Total Cost</p>
          <p className="text-2xl font-semibold">${totalCost.toFixed(2)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm text-gray-600 mb-1">Free Tokens Left</p>
          <p className="text-2xl font-semibold">954,000</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-medium text-gray-900">Date</th>
              <th className="text-right px-6 py-3 text-sm font-medium text-gray-900">Requests</th>
              <th className="text-right px-6 py-3 text-sm font-medium text-gray-900">Tokens</th>
              <th className="text-right px-6 py-3 text-sm font-medium text-gray-900">Cost</th>
            </tr>
          </thead>
          <tbody>
            {usage.map((day) => (
              <tr key={day.date} className="border-b border-gray-100 last:border-0">
                <td className="px-6 py-4 text-sm text-gray-900">{day.date}</td>
                <td className="px-6 py-4 text-sm text-right text-gray-600">{day.requests.toLocaleString()}</td>
                <td className="px-6 py-4 text-sm text-right text-gray-600">{day.tokens.toLocaleString()}</td>
                <td className="px-6 py-4 text-sm text-right text-gray-900">${day.cost.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NodesTab() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Nodes</h1>
          <p className="text-gray-600">Run GPU nodes to earn SYN tokens</p>
        </div>
        <button className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">
          Deploy Node
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">No nodes yet</h3>
        <p className="text-gray-600 mb-6">Deploy your first GPU node to start earning</p>
        <button className="bg-black text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800">
          Deploy Node
        </button>
      </div>

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h4 className="font-medium text-amber-900 mb-2">Requirements</h4>
        <ul className="text-sm text-amber-800 space-y-1">
          <li>• NVIDIA GPU with 8GB+ VRAM</li>
          <li>• Minimum 10,000 SYN stake</li>
          <li>• Stable internet connection</li>
        </ul>
      </div>
    </div>
  );
}

function BillingTab({ synBalance, ethBalance }: any) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Billing</h1>
      
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-4">SYN Balance</h3>
          <p className="text-3xl font-semibold">{synBalance ? parseFloat(synBalance).toFixed(2) : '0.00'}</p>
          <p className="text-sm text-gray-500 mt-1">Available for API usage</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-4">ETH Balance</h3>
          <p className="text-3xl font-semibold">{ethBalance ? parseFloat(formatEther(ethBalance.value)).toFixed(4) : '0.0000'}</p>
          <p className="text-sm text-gray-500 mt-1">For gas fees</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="font-medium text-gray-900 mb-4">Payment Methods</h3>
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-purple-600 font-bold text-sm">SYN</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">Synapse Token</p>
              <p className="text-sm text-gray-500">Primary payment method</p>
            </div>
          </div>
          <span className="text-green-600 text-sm font-medium">Active</span>
        </div>
      </div>
    </div>
  );
}