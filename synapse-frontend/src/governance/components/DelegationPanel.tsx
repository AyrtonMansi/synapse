import { useState } from 'react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  ArrowRightLeft, 
  History,
  Search,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import type { DelegationInfo } from '../types';

interface DelegationPanelProps {
  delegationInfo: DelegationInfo | null;
  onDelegate: (delegatee: string, amount: string) => void;
  onRevoke: () => void;
  isProcessing?: boolean;
  userVotingPower?: string;
}

export function DelegationPanel({
  delegationInfo,
  onDelegate,
  onRevoke,
  isProcessing,
  userVotingPower = '0',
}: DelegationPanelProps) {
  const [activeTab, setActiveTab] = useState<'delegate' | 'status' | 'history'>('delegate');
  const [delegatee, setDelegatee] = useState('');
  const [amount, setAmount] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const isDelegated = delegationInfo?.isActive && delegationInfo.delegate !== '0x0000000000000000000000000000000000000000';
  const delegatedAmount = isDelegated ? delegationInfo.delegatedAmount : '0';
  const availableToDelegate = parseFloat(userVotingPower) - parseFloat(delegatedAmount);

  const handleDelegate = () => {
    if (!delegatee || !amount) return;
    onDelegate(delegatee, amount);
    setDelegatee('');
    setAmount('');
  };

  const handleMax = () => {
    setAmount(availableToDelegate.toString());
  };

  // Mock delegation history
  const delegationHistory = [
    { id: 1, action: 'delegated', delegatee: '0x1234...5678', amount: '1000', timestamp: Date.now() - 86400000 },
    { id: 2, action: 'revoked', delegatee: '0xabcd...efgh', amount: '500', timestamp: Date.now() - 172800000 },
  ];

  // Mock top delegates
  const topDelegates = [
    { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', name: 'Alice Delegate', votesDelegated: '15000', proposalsVoted: 23 },
    { address: '0x8ba1f109551bD432803012645Hac136c82C3e8C', name: 'Bob Validator', votesDelegated: '12000', proposalsVoted: 19 },
    { address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', name: 'Charlie DAO', votesDelegated: '8500', proposalsVoted: 15 },
  ];

  const filteredDelegates = topDelegates.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Vote Delegation</h3>
            <p className="text-sm text-gray-500">Delegate your voting power to trusted community members</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { id: 'delegate', label: 'Delegate', icon: ArrowRightLeft },
          { id: 'status', label: 'My Status', icon: UserCheck },
          { id: 'history', label: 'History', icon: History },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'delegate' && (
          <div className="space-y-6">
            {/* Current Status */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">Your Voting Power</span>
                <span className="font-medium text-gray-900">{parseFloat(userVotingPower).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">Currently Delegated</span>
                <span className="font-medium text-gray-900">{parseFloat(delegatedAmount).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-700">Available to Delegate</span>
                <span className="font-bold text-blue-600">{availableToDelegate.toFixed(2)}</span>
              </div>
            </div>

            {isDelegated ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <UserCheck className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800">Active Delegation</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      You have delegated {delegatedAmount} votes to{' '}
                      <span className="font-mono">{delegationInfo?.delegate?.slice(0, 6)}...{delegationInfo?.delegate?.slice(-4)}</span>
                    </p>
                    <button
                      onClick={onRevoke}
                      disabled={isProcessing}
                      className="mt-3 text-sm text-yellow-800 hover:text-yellow-900 underline"
                    >
                      Revoke Delegation
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delegate Address
                  </label>
                  <input
                    type="text"
                    value={delegatee}
                    onChange={(e) => setDelegatee(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount to Delegate
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      max={availableToDelegate}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleMax}
                      className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleDelegate}
                  disabled={isProcessing || !delegatee || !amount || parseFloat(amount) > availableToDelegate}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Processing...' : 'Delegate Votes'}
                </button>
              </div>
            )}

            {/* Top Delegates */}
            <div className="pt-6 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search delegates..."
                  className="flex-1 text-sm border-none focus:outline-none"
                />
              </div>

              <h4 className="text-sm font-medium text-gray-700 mb-3">Top Delegates</h4>
              <div className="space-y-2">
                {filteredDelegates.map((delegate) => (
                  <button
                    key={delegate.address}
                    onClick={() => setDelegatee(delegate.address)}
                    className="w-full flex items-center justify-between p-3 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{delegate.name}</div>
                      <div className="text-xs text-gray-500 font-mono">
                        {delegate.address.slice(0, 6)}...{delegate.address.slice(-4)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">{delegate.votesDelegated}</div>
                      <div className="text-xs text-gray-500">{delegate.proposalsVoted} proposals</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'status' && (
          <div className="space-y-6">
            {isDelegated ? (
              <>
                <div className="flex items-center justify-center">
                  <div className="p-6 bg-green-50 rounded-full">
                    <UserCheck className="w-12 h-12 text-green-600" />
                  </div>
                </div>

                <div className="text-center">
                  <h4 className="text-lg font-medium text-gray-900">Delegation Active</h4>
                  <p className="text-gray-500 mt-1">Your votes are being delegated to</p>
                  <div className="mt-2 font-mono text-blue-600 bg-blue-50 inline-block px-4 py-2 rounded-lg">
                    {delegationInfo?.delegate}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900">{delegatedAmount}</div>
                    <div className="text-sm text-gray-500">Votes Delegated</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {new Date(delegationInfo?.delegatedAt || 0).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-gray-500">Delegation Date</div>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-900">What this means</p>
                      <ul className="text-sm text-blue-700 mt-1 space-y-1">
                        <li>• Your delegate can vote on your behalf</li>
                        <li>• You can still vote directly (overrides delegation)</li>
                        <li>• You can revoke delegation at any time</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <button
                  onClick={onRevoke}
                  disabled={isProcessing}
                  className="w-full py-3 border-2 border-red-200 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isProcessing ? 'Processing...' : 'Revoke Delegation'}
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center">
                  <div className="p-6 bg-gray-100 rounded-full">
                    <UserX className="w-12 h-12 text-gray-400" />
                  </div>
                </div>

                <div className="text-center">
                  <h4 className="text-lg font-medium text-gray-900">No Active Delegation</h4>
                  <p className="text-gray-500 mt-1">
                    You are currently voting with your full voting power
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-600">Your Voting Power</span>
                    <span className="font-bold text-gray-900">{parseFloat(userVotingPower).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Delegated To</span>
                    <span className="text-gray-400">—</span>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('delegate')}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Delegate Your Votes
                </button>
              </>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-700">Recent Delegation Activity</h4>
            
            {delegationHistory.length > 0 ? (
              <div className="space-y-3">
                {delegationHistory.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    {item.action === 'delegated' ? (
                      <ArrowRightLeft className="w-5 h-5 text-blue-600 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 capitalize">{item.action}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {item.action === 'delegated' ? 'To' : 'From'}{' '}
                        <span className="font-mono">{item.delegatee}</span>
                      </div>
                      <div className="text-sm font-medium text-gray-900 mt-1">
                        {item.amount} votes
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No delegation history yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}