/**
 * Economic Metrics Dashboard
 * Token economics, trading, and staking analytics
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  PieChart as PieChartIcon,
  BarChart3,
  Calculator,
  Award,
  RefreshCw,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
} from 'recharts';
import {
  useTokenPrice,
  usePriceHistory,
  useTradingVolume,
  useEarningsDistribution,
  useStakingPools,
  useStakingCalculation,
} from '../api';
import { StatCard } from './StatCard';
import { TimeRangeSelector } from './TimeRangeSelector';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';
import { formatCurrency, formatNumber, formatPercentage } from '../utils/formatters';

const EXCHANGE_COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ec4899', '#10b981', '#6366f1'];
const TIER_COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];

export const EconomicMetricsDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState('24h');
  const [stakingAmount, setStakingAmount] = useState('1000');
  const [selectedPool, setSelectedPool] = useState('');
  const [stakingDuration, setStakingDuration] = useState(30);

  const { data: tokenPrice, isLoading: priceLoading } = useTokenPrice();
  const { data: priceHistory, isLoading: historyLoading } = usePriceHistory(
    timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
  );
  const { data: tradingVolume, isLoading: volumeLoading } = useTradingVolume(timeRange);
  const { data: earningsData, isLoading: earningsLoading } = useEarningsDistribution(timeRange);
  const { data: stakingPools, isLoading: poolsLoading } = useStakingPools();

  const stakingCalcMutation = useStakingCalculation();

  const handleCalculateStaking = async () => {
    if (!selectedPool || !stakingAmount) return;
    await stakingCalcMutation.mutateAsync({
      amount: stakingAmount,
      poolId: selectedPool,
      duration: stakingDuration,
    });
  };

  // Process price history data
  const priceChartData = useMemo(() => {
    if (!priceHistory) return [];
    return priceHistory.map((item) => ({
      timestamp: new Date(item.timestamp).toLocaleDateString(),
      price: item.price,
      volume: item.volume24h / 1000000, // in millions
    }));
  }, [priceHistory]);

  // Process volume by exchange
  const volumeByExchangeData = useMemo(() => {
    if (!tradingVolume?.volumeByExchange) return [];
    return tradingVolume.volumeByExchange.map((item, index) => ({
      ...item,
      color: EXCHANGE_COLORS[index % EXCHANGE_COLORS.length],
    }));
  }, [tradingVolume]);

  // Process earnings distribution by tier
  const earningsByTierData = useMemo(() => {
    if (!earningsData?.distributionByTier) return [];
    return earningsData.distributionByTier.map((item, index) => ({
      name: item.tier,
      value: parseFloat(item.totalEarnings),
      count: item.nodeCount,
      color: TIER_COLORS[index % TIER_COLORS.length],
    }));
  }, [earningsData]);

  // Process earnings by region
  const earningsByRegionData = useMemo(() => {
    if (!earningsData?.earningsByRegion) return [];
    return earningsData.earningsByRegion
      .sort((a, b) => parseFloat(b.earnings) - parseFloat(a.earnings))
      .slice(0, 10);
  }, [earningsData]);

  const isLoading = priceLoading || historyLoading || volumeLoading || earningsLoading || poolsLoading;

  if (isLoading) return <LoadingState message="Loading economic metrics..." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-green-500" />
            Economic Metrics
          </h1>
          <p className="text-gray-400 mt-1">
            Token economics, trading activity, and staking analytics
          </p>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Key Price Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={tokenPrice && tokenPrice.priceChange24h >= 0 ? TrendingUp : TrendingDown}
          title="SYN Price"
          value={formatCurrency(tokenPrice?.price || 0)}
          subtitle={`${tokenPrice && tokenPrice.priceChange24h >= 0 ? '+' : ''}${formatPercentage(tokenPrice?.priceChange24h || 0)} 24h`}
          trend={tokenPrice?.priceChange24h}
          color={tokenPrice && tokenPrice.priceChange24h >= 0 ? 'green' : 'red'}
        />
        <StatCard
          icon={BarChart3}
          title="24h Volume"
          value={formatCurrency(tokenPrice?.volume24h || 0)}
          subtitle="Trading volume"
          trend={tradingVolume?.volumeChange}
          color="blue"
        />
        <StatCard
          icon={PieChartIcon}
          title="Market Cap"
          value={formatCurrency(tokenPrice?.marketCap || 0)}
          subtitle={`${formatNumber(tokenPrice?.circulatingSupply || 0)} SYN circulating`}
          color="purple"
        />
        <StatCard
          icon={Award}
          title="Total Earnings"
          value={`${parseFloat(earningsData?.totalEarnings || '0').toFixed(2)} SYN`}
          subtitle={`${earningsData?.distributionByTier.reduce((acc, t) => acc + t.nodeCount, 0) || 0} earning nodes`}
          color="yellow"
        />
      </div>

      {/* Price Chart & Volume */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Price History Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 bg-gray-900 rounded-xl p-6 border border-gray-800"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-green-500" />
              <h2 className="text-xl font-semibold text-white">Price History</h2>
            </div>
            <div className="flex gap-2">
              <span className="text-sm text-gray-400">7d: </span>
              <span className={`text-sm font-medium ${tokenPrice && tokenPrice.priceChange7d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatPercentage(tokenPrice?.priceChange7d || 0)}
              </span>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={priceChartData}>
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="timestamp" stroke="#6b7280" fontSize={12} />
                <YAxis yAxisId="left" stroke="#6b7280" fontSize={12} tickFormatter={(v) => `$${v}`} />
                <YAxis yAxisId="right" orientation="right" stroke="#6b7280" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number, name: string) => [
                    name === 'price' ? `$${value.toFixed(4)}` : `${value.toFixed(2)}M`,
                    name === 'price' ? 'Price' : 'Volume (M)',
                  ]}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="price"
                  stroke="#22c55e"
                  fillOpacity={1}
                  fill="url(#priceGradient)"
                />
                <Bar yAxisId="right" dataKey="volume" fill="#3b82f6" opacity={0.5} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Volume by Exchange */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-900 rounded-xl p-6 border border-gray-800"
        >
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-semibold text-white">Volume by Exchange</h2>
          </div>
          <div className="h-64 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={volumeByExchangeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="volume"
                >
                  {volumeByExchangeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {volumeByExchangeData.slice(0, 4).map((exchange) => (
              <div key={exchange.exchange} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: exchange.color }}
                  />
                  <span className="text-gray-300">{exchange.exchange}</span>
                </div>
                <span className="text-gray-400">{exchange.percentage.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Staking Calculator & Pools */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Staking Calculator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-900 rounded-xl p-6 border border-gray-800"
        >
          <div className="flex items-center gap-3 mb-4">
            <Calculator className="w-6 h-6 text-purple-500" />
            <h2 className="text-xl font-semibold text-white">Staking Calculator</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Staking Amount (SYN)</label>
              <input
                type="number"
                value={stakingAmount}
                onChange={(e) => setStakingAmount(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                placeholder="Enter amount"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Select Pool</label>
              <select
                value={selectedPool}
                onChange={(e) => setSelectedPool(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">Select a pool</option>
                {stakingPools?.map((pool) => (
                  <option key={pool.id} value={pool.id}>
                    {pool.name} - {pool.apr.toFixed(2)}% APR
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Duration: {stakingDuration} days
              </label>
              <input
                type="range"
                min="7"
                max="365"
                value={stakingDuration}
                onChange={(e) => setStakingDuration(parseInt(e.target.value))}
                className="w-full accent-purple-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>7 days</span>
                <span>365 days</span>
              </div>
            </div>

            <button
              onClick={handleCalculateStaking}
              disabled={!selectedPool || stakingCalcMutation.isPending}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {stakingCalcMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Calculator className="w-4 h-4" />
              )}
              Calculate Rewards
            </button>

            {stakingCalcMutation.data && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-gray-800 rounded-lg p-4 space-y-2"
              >
                <div className="flex justify-between">
                  <span className="text-gray-400">Daily Reward</span>
                  <span className="text-white font-medium">
                    {parseFloat(stakingCalcMutation.data.dailyReward).toFixed(4)} SYN
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Monthly Reward</span>
                  <span className="text-white font-medium">
                    {parseFloat(stakingCalcMutation.data.monthlyReward).toFixed(4)} SYN
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Rewards ({stakingDuration} days)</span>
                  <span className="text-green-400 font-bold">
                    {parseFloat(stakingCalcMutation.data.estimatedRewards).toFixed(4)} SYN
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-700">
                  <span className="text-gray-400">Projected APR</span>
                  <span className="text-purple-400 font-bold">
                    {stakingCalcMutation.data.projectedApr.toFixed(2)}%
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Staking Pools */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-900 rounded-xl p-6 border border-gray-800"
        >
          <div className="flex items-center gap-3 mb-4">
            <Wallet className="w-6 h-6 text-yellow-500" />
            <h2 className="text-xl font-semibold text-white">Staking Pools</h2>
          </div>

          <div className="space-y-3">
            {stakingPools?.map((pool) => (
              <div
                key={pool.id}
                onClick={() => setSelectedPool(pool.id)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedPool === pool.id
                    ? 'bg-purple-900/30 border-purple-500'
                    : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-medium">{pool.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        pool.risk === 'low'
                          ? 'bg-green-900/50 text-green-400'
                          : pool.risk === 'medium'
                          ? 'bg-yellow-900/50 text-yellow-400'
                          : 'bg-red-900/50 text-red-400'
                      }`}
                    >
                      {pool.risk} risk
                    </span>
                  </div>
                  <span className="text-purple-400 font-bold">{pool.apr.toFixed(2)}% APR</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Total Staked</p>
                    <p className="text-gray-300">{parseFloat(pool.totalStaked).toFixed(0)} SYN</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Participants</p>
                    <p className="text-gray-300">{pool.participants.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Lock Period</p>
                    <p className="text-gray-300">{pool.lockPeriod} days</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Earnings Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Earnings by Tier */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-900 rounded-xl p-6 border border-gray-800"
        >
          <div className="flex items-center gap-3 mb-4">
            <PieChartIcon className="w-6 h-6 text-pink-500" />
            <h2 className="text-xl font-semibold text-white">Earnings by Tier</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={earningsByTierData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                >
                  {earningsByTierData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number, name: string, props: any) => [
                    `${value.toFixed(2)} SYN (${props.payload.count} nodes)`,
                    props.payload.name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Top Earning Regions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gray-900 rounded-xl p-6 border border-gray-800"
        >
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-6 h-6 text-cyan-500" />
            <h2 className="text-xl font-semibold text-white">Top Earning Regions</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={earningsByRegionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#6b7280" fontSize={12} />
                <YAxis type="category" dataKey="region" stroke="#6b7280" fontSize={12} width={100} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  formatter={(value: string) => [`${parseFloat(value).toFixed(2)} SYN`, 'Earnings']}
                />
                <Bar dataKey="earnings" fill="#06b6d4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
