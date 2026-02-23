import { useState } from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Flame, 
  PieChart as PieChartIcon,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Calculator
} from 'lucide-react';
import type { TreasuryAsset, TreasuryStats, SpendingProposal, TokenBurn } from '../types';

interface TreasuryDashboardProps {
  assets: TreasuryAsset[];
  stats: TreasuryStats;
  recentBurns?: TokenBurn[];
  spendingProposals?: SpendingProposal[];
  onRefresh?: () => void;
  isLoading?: boolean;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

export function TreasuryDashboard({
  assets,
  stats,
  recentBurns = [],
  spendingProposals = [],
  onRefresh,
  isLoading,
}: TreasuryDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'allocation' | 'burns' | 'spending'>('overview');
  const [revenueInput, setRevenueInput] = useState('');
  const [calculatedShares, setCalculatedShares] = useState<{ burn: string; staking: string; treasury: string } | null>(null);

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatNumber = (value: string) => {
    const num = parseFloat(value);
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const calculateShares = () => {
    const revenue = parseFloat(revenueInput);
    if (isNaN(revenue) || revenue <= 0) return;

    const burn = (revenue * stats.burnRate) / 100;
    const staking = (revenue * stats.stakingShare) / 100;
    const treasury = (revenue * stats.treasuryShare) / 100;

    setCalculatedShares({
      burn: burn.toFixed(2),
      staking: staking.toFixed(2),
      treasury: treasury.toFixed(2),
    });
  };

  // Chart data
  const pieData = assets
    .filter(a => parseFloat(a.valueUSD) > 0)
    .map(asset => ({
      name: asset.symbol,
      value: parseFloat(asset.valueUSD),
      percentage: asset.percentage || 0,
    }));

  const spendingData = spendingProposals
    .filter(p => p.executed)
    .slice(0, 10)
    .map(p => ({
      name: p.category || 'Other',
      value: parseFloat(p.amountUSD),
    }));

  const burnData = recentBurns.slice(0, 10).map((burn, i) => ({
    name: `#${burn.id}`,
    amount: parseFloat(burn.amount),
    value: parseFloat(burn.valueUSD),
  }));

  const StatCard = ({ 
    title, 
    value, 
    change, 
    icon, 
    color 
  }: { 
    title: string; 
    value: string; 
    change?: string; 
    icon: React.ReactNode;
    color: string;
  }) => (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {change && (
            <div className={`flex items-center gap-1 mt-1 text-sm ${change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
              {change.startsWith('+') ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              <span>{change}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Treasury Analytics</h2>
          <p className="text-gray-500">Real-time treasury monitoring and management</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Treasury Value"
          value={formatCurrency(stats.totalValueUSD)}
          icon={<Wallet className="w-6 h-6 text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          change="+12.5%"
          icon={<TrendingUp className="w-6 h-6 text-green-600" />}
          color="bg-green-50"
        />
        <StatCard
          title="Total Spent"
          value={formatCurrency(stats.totalSpent)}
          icon={<TrendingDown className="w-6 h-6 text-red-600" />}
          color="bg-red-50"
        />
        <StatCard
          title="Total Burned"
          value={formatNumber(stats.totalBurned)}
          icon={<Flame className="w-6 h-6 text-orange-600" />}
          color="bg-orange-50"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { id: 'overview', label: 'Overview', icon: PieChartIcon },
          { id: 'allocation', label: 'Asset Allocation', icon: Wallet },
          { id: 'burns', label: 'Token Burns', icon: Flame },
          { id: 'spending', label: 'Spending', icon: DollarSign },
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
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Revenue Share Calculator */}
            <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <Calculator className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Revenue Share Calculator</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">Enter Revenue Amount</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={revenueInput}
                      onChange={(e) => setRevenueInput(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={calculateShares}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Calculate
                    </button>
                  </div>
                </div>

                {calculatedShares && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                      <div className="text-2xl font-bold text-orange-600">${calculatedShares.burn}</div>
                      <div className="text-xs text-gray-500">Burn ({stats.burnRate}%)</div>
                    </div>
                    <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                      <div className="text-2xl font-bold text-green-600">${calculatedShares.staking}</div>
                      <div className="text-xs text-gray-500">Staking ({stats.stakingShare}%)</div>
                    </div>
                    <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                      <div className="text-2xl font-bold text-blue-600">${calculatedShares.treasury}</div>
                      <div className="text-xs text-gray-500">Treasury ({stats.treasuryShare}%)</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="text-sm text-gray-500 mb-1">Active Assets</div>
                <div className="text-3xl font-bold text-gray-900">{stats.assetCount}</div>
                <div className="text-xs text-gray-400 mt-1">Tracked in treasury</div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="text-sm text-gray-500 mb-1">ETH Value</div>
                <div className="text-3xl font-bold text-gray-900">{formatCurrency(stats.ethValueUSD)}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {((parseFloat(stats.ethValueUSD) / parseFloat(stats.totalValueUSD)) * 100).toFixed(1)}% of treasury
                </div>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="text-sm text-gray-500 mb-1">Token Values</div>
                <div className="text-3xl font-bold text-gray-900">{formatCurrency(stats.tokenValuesUSD)}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {((parseFloat(stats.tokenValuesUSD) / parseFloat(stats.totalValueUSD)) * 100).toFixed(1)}% of treasury
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'allocation' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Asset Allocation</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name} ${percentage.toFixed(1)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value: number) => formatCurrency(value.toString())} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Asset List */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Asset Breakdown</h3>
              <div className="space-y-3">
                {assets
                  .filter(a => parseFloat(a.valueUSD) > 0)
                  .sort((a, b) => parseFloat(b.valueUSD) - parseFloat(a.valueUSD))
                  .map((asset, index) => (
                    <div key={asset.token} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div>
                          <div className="font-medium text-gray-900">{asset.symbol}</div>
                          <div className="text-xs text-gray-500 font-mono">
                            {asset.isETH ? 'Native' : `${asset.token.slice(0, 6)}...${asset.token.slice(-4)}`}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">{formatCurrency(asset.valueUSD)}</div>
                        <div className="text-xs text-gray-500">{formatNumber(asset.balance)} {asset.symbol}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'burns' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent Token Burns</h3>
              <div className="text-sm text-gray-500">
                Total Burned: <span className="font-medium text-gray-900">{formatNumber(stats.totalBurned)}</span>
              </div>
            </div>

            {burnData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={burnData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip formatter={(value: number) => formatNumber(value.toString())} />
                    <Bar dataKey="amount" fill="#F97316" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Flame className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No token burns recorded yet</p>
              </div>
            )}

            {/* Burn History Table */}
            {recentBurns.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">ID</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Amount</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Value (USD)</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Reason</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentBurns.slice(0, 5).map((burn) => (
                      <tr key={burn.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-gray-500">#{burn.id}</td>
                        <td className="px-4 py-3 font-medium">{formatNumber(burn.amount)}</td>
                        <td className="px-4 py-3">{formatCurrency(burn.valueUSD)}</td>
                        <td className="px-4 py-3 text-gray-600">{burn.reason}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(burn.timestamp * 1000).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'spending' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Spending Proposals</h3>
              <div className="text-sm text-gray-500">
                Total Spent: <span className="font-medium text-gray-900">{formatCurrency(stats.totalSpent)}</span>
              </div>
            </div>

            {spendingData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={spendingData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => formatCurrency(v.toString())} />
                    <YAxis type="category" dataKey="name" width={100} />
                    <RechartsTooltip formatter={(value: number) => formatCurrency(value.toString())} />
                    <Bar dataKey="value" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No spending proposals recorded yet</p>
              </div>
            )}

            {/* Active Proposals */}
            {spendingProposals.filter(p => !p.executed && !p.canceled).length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Active Proposals</h4>
                <div className="space-y-2">
                  {spendingProposals
                    .filter(p => !p.executed && !p.canceled)
                    .slice(0, 3)
                    .map((proposal) => (
                      <div key={proposal.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900">{proposal.description}</div>
                          <div className="text-xs text-gray-500">{proposal.category}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-gray-900">{formatCurrency(proposal.amountUSD)}</div>
                          <div className={`text-xs ${proposal.approved ? 'text-green-600' : 'text-yellow-600'}`}>
                            {proposal.approved ? 'Approved' : 'Pending Approval'}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}