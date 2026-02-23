import { useState } from 'react';
import { 
  Shield, 
  Plus, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Settings,
  Wallet,
  ArrowRight,
  Copy,
  ExternalLink
} from 'lucide-react';
import type { GnosisSafeInfo, SafeTransaction } from '../types';

interface GnosisSafeManagerProps {
  safes: GnosisSafeInfo[];
  transactions: SafeTransaction[];
  onRegisterSafe?: (address: string, threshold: number, delegates: string[]) => void;
  onRequestTransaction?: (safe: string, to: string, value: string, data: string, description: string) => void;
  onSignTransaction?: (txId: string) => void;
  onExecuteTransaction?: (txId: string) => void;
  onUpdateThreshold?: (safe: string, threshold: number) => void;
  isProcessing?: boolean;
}

export function GnosisSafeManager({
  safes,
  transactions,
  onRegisterSafe,
  onRequestTransaction,
  onSignTransaction,
  onExecuteTransaction,
  onUpdateThreshold,
  isProcessing,
}: GnosisSafeManagerProps) {
  const [activeTab, setActiveTab] = useState<'safes' | 'transactions' | 'new'>('safes');
  const [selectedSafe, setSelectedSafe] = useState<string | null>(null);
  const [showNewSafeForm, setShowNewSafeForm] = useState(false);
  const [showNewTxForm, setShowNewTxForm] = useState(false);
  
  // Form states
  const [newSafeAddress, setNewSafeAddress] = useState('');
  const [newSafeThreshold, setNewSafeThreshold] = useState(1);
  const [newSafeDelegates, setNewSafeDelegates] = useState('');
  
  const [txTo, setTxTo] = useState('');
  const [txValue, setTxValue] = useState('');
  const [txData, setTxData] = useState('0x');
  const [txDescription, setTxDescription] = useState('');

  const selectedSafeData = safes.find(s => s.address === selectedSafe);

  const handleRegisterSafe = () => {
    const delegates = newSafeDelegates.split(',').map(d => d.trim()).filter(Boolean);
    onRegisterSafe?.(newSafeAddress, newSafeThreshold, delegates);
    setShowNewSafeForm(false);
    setNewSafeAddress('');
    setNewSafeThreshold(1);
    setNewSafeDelegates('');
  };

  const handleRequestTransaction = () => {
    if (!selectedSafe) return;
    onRequestTransaction?.(selectedSafe, txTo, txValue, txData, txDescription);
    setShowNewTxForm(false);
    setTxTo('');
    setTxValue('');
    setTxData('0x');
    setTxDescription('');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const pendingTransactions = transactions.filter(t => !t.executed && !t.canceled);
  const executedTransactions = transactions.filter(t => t.executed);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Gnosis Safe Integration</h3>
          <p className="text-sm text-gray-500">Multi-sig treasury management</p>
        </div>
        <button
          onClick={() => setShowNewSafeForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Register Safe
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { id: 'safes', label: 'Safes', count: safes.length },
          { id: 'transactions', label: 'Transactions', count: pendingTransactions.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'safes' && (
        <div className="space-y-4">
          {safes.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">No Gnosis Safes registered yet</p>
              <button
                onClick={() => setShowNewSafeForm(true)}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                Register your first Safe
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {safes.map((safe) => (
                <div
                  key={safe.address}
                  onClick={() => setSelectedSafe(selectedSafe === safe.address ? null : safe.address)}
                  className={`p-4 border rounded-xl cursor-pointer transition-all ${
                    selectedSafe === safe.address
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Shield className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">Gnosis Safe</div>
                        <div className="text-sm text-gray-500 font-mono">
                          {safe.address.slice(0, 8)}...{safe.address.slice(-6)}
                        </div>
                      </div>
                    </div>
                    <div className={`px-2 py-1 text-xs rounded-full ${
                      safe.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {safe.isActive ? 'Active' : 'Inactive'}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{safe.requiredConfirmations}</div>
                      <div className="text-xs text-gray-500">Required</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">{safe.delegateCount}</div>
                      <div className="text-xs text-gray-500">Delegates</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-900">
                        {transactions.filter(t => t.safe === safe.address && !t.executed).length}
                      </div>
                      <div className="text-xs text-gray-500">Pending</div>
                    </div>
                  </div>

                  {selectedSafe === safe.address && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Threshold</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{safe.threshold} of {safe.owners?.length}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const newThreshold = prompt('Enter new threshold:', safe.requiredConfirmations.toString());
                              if (newThreshold) {
                                onUpdateThreshold?.(safe.address, parseInt(newThreshold));
                              }
                            }}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <span className="text-sm text-gray-600">Owners</span>
                        <div className="mt-1 space-y-1">
                          {safe.owners?.map((owner) => (
                            <div key={owner} className="flex items-center justify-between text-sm">
                              <span className="font-mono">{owner.slice(0, 8)}...{owner.slice(-6)}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(owner);
                                }}
                                className="p-1 hover:bg-gray-200 rounded"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowNewTxForm(true);
                        }}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Create Transaction
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {/* Pending Transactions */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Pending Transactions</h4>
            {pendingTransactions.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-gray-500">No pending transactions</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingTransactions.map((tx) => (
                  <div key={tx.id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{tx.description}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          To: {tx.to.slice(0, 8)}...{tx.to.slice(-6)} | Value: {tx.value} ETH
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {tx.signatureCount} / {selectedSafeData?.requiredConfirmations} signatures
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(tx.requestedAt * 1000).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!tx.signatures.find(s => s.signer === 'user') && (
                          <button
                            onClick={() => onSignTransaction?.(tx.id)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
                          >
                            Sign
                          </button>
                        )}
                        {tx.isExecutable && (
                          <button
                            onClick={() => onExecuteTransaction?.(tx.id)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                          >
                            Execute
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ 
                            width: `${Math.min(100, (tx.signatureCount / (selectedSafeData?.requiredConfirmations || 1)) * 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Executed Transactions */}
          {executedTransactions.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Recent Executed</h4>
              <div className="space-y-2">
                {executedTransactions.slice(0, 3).map((tx) => (
                  <div key={tx.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">{tx.description}</span>
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    </div>
                    <div className="text-gray-400 text-xs mt-1">
                      Executed {new Date(tx.executedAt * 1000).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* New Safe Modal */}
      {showNewSafeForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Register Gnosis Safe</h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Safe Address</label>
                <input
                  type="text"
                  value={newSafeAddress}
                  onChange={(e) => setNewSafeAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Required Confirmations</label>
                <input
                  type="number"
                  value={newSafeThreshold}
                  onChange={(e) => setNewSafeThreshold(parseInt(e.target.value))}
                  min={1}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delegates (comma-separated)
                </label>
                <textarea
                  value={newSafeDelegates}
                  onChange={(e) => setNewSafeDelegates(e.target.value)}
                  placeholder="0x..., 0x..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewSafeForm(false)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRegisterSafe}
                disabled={!newSafeAddress || isProcessing}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Register
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Transaction Modal */}
      {showNewTxForm && selectedSafe && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Create Transaction</h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Address</label>
                <input
                  type="text"
                  value={txTo}
                  onChange={(e) => setTxTo(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Value (ETH)</label>
                <input
                  type="text"
                  value={txValue}
                  onChange={(e) => setTxValue(e.target.value)}
                  placeholder="0.0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data (optional)</label>
                <input
                  type="text"
                  value={txData}
                  onChange={(e) => setTxData(e.target.value)}
                  placeholder="0x"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  placeholder="What is this transaction for?"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewTxForm(false)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestTransaction}
                disabled={!txTo || !txDescription || isProcessing}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}