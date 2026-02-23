/**
 * Leaderboards Dashboard
 * Top performers across various metrics
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Medal,
  Award,
  TrendingUp,
  TrendingDown,
  MapPin,
  Clock,
  CheckCircle,
  Zap,
  Globe,
  Activity,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  useEarningsLeaderboard,
  useReliabilityLeaderboard,
  useSpeedLeaderboard,
  useRegionalPerformance,
} from '../api';
import { TimeRangeSelector } from './TimeRangeSelector';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';

type LeaderboardTab = 'earnings' | 'reliability' | 'speed' | 'regional';

const TIER_ICONS = {
  Titan: <Trophy className="w-5 h-5 text-yellow-400" />,
  Platinum: <Medal className="w-5 h-5 text-gray-300" />,
  Gold: <Medal className="w-5 h-5 text-yellow-600" />,
  Silver: <Medal className="w-5 h-5 text-gray-400" />,
  Bronze: <Medal className="w-5 h-5 text-amber-700" />,
};

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export const LeaderboardsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('earnings');
  const [timeRange, setTimeRange] = useState('24h');
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const itemsPerPage = 25;

  const { data: earningsData, isLoading: earningsLoading } = useEarningsLeaderboard(100);
  const { data: reliabilityData, isLoading: reliabilityLoading } = useReliabilityLeaderboard(100);
  const { data: speedData, isLoading: speedLoading } = useSpeedLeaderboard(100);
  const { data: regionalData, isLoading: regionalLoading } = useRegionalPerformance();

  const isLoading = earningsLoading || reliabilityLoading || speedLoading || regionalLoading;

  // Filter and paginate data
  const filterData = (data: any[] | undefined) => {
    if (!data) return [];
    let filtered = data;
    if (searchQuery) {
      filtered = filtered.filter(
        (item) =>
          item.nodeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (selectedRegion) {
      filtered = filtered.filter((item) => item.region === selectedRegion);
    }
    return filtered;
  };

  const paginatedData = useMemo(() => {
    const data =
      activeTab === 'earnings'
        ? earningsData
        : activeTab === 'reliability'
        ? reliabilityData
        : activeTab === 'speed'
        ? speedData
        : regionalData;
    const filtered = filterData(data);
    const start = (page - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [earningsData, reliabilityData, speedData, regionalData, activeTab, page, searchQuery, selectedRegion]);

  const totalPages = useMemo(() => {
    const data =
      activeTab === 'earnings'
        ? earningsData
        : activeTab === 'reliability'
        ? reliabilityData
        : activeTab === 'speed'
        ? speedData
        : regionalData;
    return Math.ceil((filterData(data).length || 0) / itemsPerPage);
  }, [earningsData, reliabilityData, speedData, regionalData, activeTab, searchQuery, selectedRegion]);

  // Get unique regions for filter
  const uniqueRegions = useMemo(() => {
    const regions = new Set<string>();
    earningsData?.forEach((item) => regions.add(item.region));
    return Array.from(regions).sort();
  }, [earningsData]);

  if (isLoading) return <LoadingState message="Loading leaderboards..." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-500" />
            Leaderboards
          </h1>
          <p className="text-gray-400 mt-1">
            Top performing nodes and regions across the network
          </p>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'earnings', label: 'Top Earners', icon: Award },
          { id: 'reliability', label: 'Most Reliable', icon: CheckCircle },
          { id: 'speed', label: 'Fastest Inference', icon: Zap },
          { id: 'regional', label: 'Regional Performance', icon: Globe },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as LeaderboardTab);
              setPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-white text-sm w-48"
          />
        </div>
        {activeTab !== 'regional' && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">All Regions</option>
              {uniqueRegions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Leaderboard Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"
        >
          {activeTab === 'earnings' && (
            <EarningsLeaderboardTable data={paginatedData as any[]} />
          )}
          {activeTab === 'reliability' && (
            <ReliabilityLeaderboardTable data={paginatedData as any[]} />
          )}
          {activeTab === 'speed' && (
            <SpeedLeaderboardTable data={paginatedData as any[]} />
          )}
          {activeTab === 'regional' && (
            <RegionalPerformanceTable data={paginatedData as any[]} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-gray-400 text-sm">
            Showing {(page - 1) * itemsPerPage + 1} - {Math.min(page * itemsPerPage, (page - 1) * itemsPerPage + paginatedData.length)} of{' '}
            {filterData(
              activeTab === 'earnings'
                ? earningsData
                : activeTab === 'reliability'
                ? reliabilityData
                : activeTab === 'speed'
                ? speedData
                : regionalData
            ).length}{' '}
            entries
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg bg-gray-800 text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-4 py-2 bg-gray-800 rounded-lg text-white">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg bg-gray-800 text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Earnings Leaderboard Table
const EarningsLeaderboardTable: React.FC<{ data: any[] }> = ({ data }) => (
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
        <tr className="bg-gray-800/50">
          <th className="text-left py-4 px-6 text-gray-400 font-medium">Rank</th>
          <th className="text-left py-4 px-6 text-gray-400 font-medium">Node</th>
          <th className="text-left py-4 px-6 text-gray-400 font-medium">Operator</th>
          <th className="text-left py-4 px-6 text-gray-400 font-medium">Region</th>
          <th className="text-left py-4 px-6 text-gray-400 font-medium">Tier</th>
          <th className="text-right py-4 px-6 text-gray-400 font-medium">Earnings</th>
          <th className="text-right py-4 px-6 text-gray-400 font-medium">Jobs</th>
          <th className="text-right py-4 px-6 text-gray-400 font-medium">Uptime</th>
          <th className="text-center py-4 px-6 text-gray-400 font-medium">24h</th>
        </tr>
      </thead>
      <tbody>
        {data.map((entry, index) => (
          <tr
            key={entry.nodeId}
            className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${
              index < 3 ? 'bg-yellow-500/5' : ''
            }`}
          >
            <td className="py-4 px-6">
              {entry.rank <= 3 ? (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                  style={{
                    backgroundColor: `${RANK_COLORS[entry.rank - 1]}20`,
                    color: RANK_COLORS[entry.rank - 1],
                  }}
                >
                  {entry.rank}
                </div>
              ) : (
                <span className="text-gray-500 font-medium">{entry.rank}</span>
              )}
            </td>
            <td className="py-4 px-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                  {entry.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-medium">{entry.name}</p>
                  <p className="text-gray-500 text-xs">{entry.nodeId.slice(0, 12)}...</p>
                </div>
              </div>
            </td>
            <td className="py-4 px-6">
              <span className="text-gray-300">{entry.operator.slice(0, 8)}...</span>
            </td>
            <td className="py-4 px-6">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-500" />
                <span className="text-gray-300">{entry.region}</span>
              </div>
            </td>
            <td className="py-4 px-6">
              <div className="flex items-center gap-2">
                {TIER_ICONS[entry.tier as keyof typeof TIER_ICONS] || TIER_ICONS.Bronze}
                <span className="text-gray-300">{entry.tier}</span>
              </div>
            </td>
            <td className="py-4 px-6 text-right">
              <span className="text-green-400 font-bold">{parseFloat(entry.earnings).toFixed(2)} SYN</span>
            </td>
            <td className="py-4 px-6 text-right">
              <span className="text-gray-300">{entry.jobsCompleted.toLocaleString()}</span>
            </td>
            <td className="py-4 px-6 text-right">
              <span className="text-blue-400">{entry.uptime.toFixed(1)}%</span>
            </td>
            <td className="py-4 px-6 text-center">
              {entry.change24h > 0 ? (
                <div className="flex items-center justify-center gap-1 text-green-400">
                  <TrendingUp className="w-4 h-4" />
                  <span>+{entry.change24h}</span>
                </div>
              ) : entry.change24h < 0 ? (
                <div className="flex items-center justify-center gap-1 text-red-400">
                  <TrendingDown className="w-4 h-4" />
                  <span>{entry.change24h}</span>
                </div>
              ) : (
                <span className="text-gray-500">-</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Reliability Leaderboard Table
const ReliabilityLeaderboardTable: React.FC<{ data: any[] }> = ({ data }) => (
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
        <tr className="bg-gray-800/50">
          <th className="text-left py-4 px-6 text-gray-400 font-medium">Rank</th>
          <th className="text-left py-4 px-6 text-gray-400 font-medium">Node</th>
          <th className="text-left py-4 px-6 text-gray-400 font-medium">Operator</th>
          <th className="text-right py-4 px-6 text-gray-400 font-medium">Reliability Score</th>
          <th className="text-right py-4 px-6 text-gray-400 font-medium">Uptime</th>
          <th className="text-right py-4 px-6 text-gray-400 font-medium">Consecutive Jobs</th>
          <th className="text-right py-4 px-6 text-gray-400 font-medium">Failed Jobs</th>
          <th className="text-right py-4 px-6 text-gray-400 font-medium">Avg Response</th>
          <th className="text-center py-4 px-6 text-gray-400 font-medium">24h</th>
        </tr>
      </thead>
      <tbody>
        {data.map((entry) => (
          <tr
            key={entry.nodeId}
            className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
          >
            <td className="py-4 px-6">
              <span className="text-gray-500 font-medium">{entry.rank}</span>
            </td>
            <td className="py-4 px-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-white font-medium">{entry.name}</span>
              </div>
            </td>
            <td className="py-4 px-6">
              <span className="text-gray-300">{entry.operator.slice(0, 8)}...</span>
            </td>
            <td className="py-4 px-6 text-right">
              <div className="flex items-center justify-end gap-2">
                <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${entry.reliabilityScore}%` }}
                  />
                </div>
                <span className="text-green-400 font-bold">{entry.reliabilityScore.toFixed(1)}</span>
              </div>
            </td>
            <td className="py-4 px-6 text-right">
              <span className="text-blue-400">{entry.uptime.toFixed(2)}%</span>
            </td>
            <td className="py-4 px-6 text-right">
              <span className="text-gray-300">{entry.consecutiveSuccessfulJobs.toLocaleString()}</span>
            </td>
            <td className="py-4 px-6 text-right">
              <span className={entry.failedJobs === 0 ? 'text-green-400' : 'text-yellow-400'}>
                {entry.failedJobs}
              </span>
            </td>
            <td className="py-4 px-6 text-right">
              <span className="text-gray-300">{entry.averageResponseTime.toFixed(0)}ms</span>
            </td>
            <td className="py-4 px-6 text-center">
              {entry.change24h > 0 ? (
                <div className="flex items-center justify-center gap-1 text-green-400">
                  <TrendingUp className="w-4 h-4" />
                  <span>+{entry.change24h}</span>
                </div>
              ) : entry.change24h < 0 ? (
                <div className="flex items-center justify-center gap-1 text-red-400">
                  <TrendingDown className="w-4 h-4" />
                  <span>{entry.change24h}</span>
                </div>
              ) : (
                <span className="text-gray-500">-</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Speed Leaderboard Table
const SpeedLeaderboardTable: React.FC<{ data: any[] }> = ({ data }) => (
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
        <tr className="bg-gray-800/50">
          <th className="text-left py-4 px-6 text-gray-400 font-medium">Rank</th>
          <th className="text-left py-4 px-6 text-gray-400 font-medium">Node</th>
          <th className="text-left py-4 px-6 text-gray-400 font-medium">Model</th>
          <th className="text-left py-4 px-6 text-gray-400 font-medium">GPU</th>
          <th className="text-right py-4 px-6 text-gray-400 font-medium">Avg Inference</th>
          <th className="text-right py-4 px-6 text-gray-400 font-medium">Fastest</th>
          <th className="text-right py-4 px-6 text-gray-400 font-medium">Tokens/sec</th>
          <th className="text-right py-4 px-6 text-gray-400 font-medium">Samples</th>
          <th className="text-center py-4 px-6 text-gray-400 font-medium">24h</th>
        </tr>
      </thead>
      <tbody>
        {data.map((entry) => (
          <tr
            key={entry.nodeId}
            className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
          >
            <td className="py-4 px-6">
              <span className="text-gray-500 font-medium">{entry.rank}</span>
            </td>
            <td className="py-4 px-6">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-yellow-500" />
                <span className="text-white font-medium">{entry.name}</span>
              </div>
            </td>
            <td className="py-4 px-6">
              <span className="text-purple-400">{entry.model}</span>
            </td>
            <td className="py-4 px-6">
              <span className="text-gray-300">{entry.gpuModel}</span>
            </td>
            <td className="py-4 px-6 text-right">
              <span className="text-green-400 font-bold">{entry.averageInferenceTime.toFixed(2)}ms</span>
            </td>
            <td className="py-4 px-6 text-right">
              <span className="text-cyan-400">{entry.fastestInferenceTime.toFixed(2)}ms</span>
            </td>
            <td className="py-4 px-6 text-right">
              <span className="text-yellow-400">{entry.tokensPerSecond.toFixed(1)}</span>
            </td>
            <td className="py-4 px-6 text-right">
              <span className="text-gray-300">{entry.samples.toLocaleString()}</span>
            </td>
            <td className="py-4 px-6 text-center">
              {entry.change24h > 0 ? (
                <div className="flex items-center justify-center gap-1 text-green-400">
                  <TrendingUp className="w-4 h-4" />
                  <span>+{entry.change24h}</span>
                </div>
              ) : entry.change24h < 0 ? (
                <div className="flex items-center justify-center gap-1 text-red-400">
                  <TrendingDown className="w-4 h-4" />
                  <span>{entry.change24h}</span>
                </div>
              ) : (
                <span className="text-gray-500">-</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// Regional Performance Table
const RegionalPerformanceTable: React.FC<{ data: any[] }> = ({ data }) => {
  const chartData = data.slice(0, 10).map((region) => ({
    region: region.region,
    nodeCount: region.nodeCount,
    earnings: parseFloat(region.totalEarnings),
    jobs: region.totalJobs,
  }));

  return (
    <div className="p-6">
      <div className="h-64 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="region" stroke="#6b7280" fontSize={12} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
            />
            <Bar dataKey="nodeCount" fill="#3b82f6" name="Nodes" radius={[4, 4, 0, 0]} />
            <Bar dataKey="jobs" fill="#10b981" name="Jobs" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <table className="w-full">
        <thead>
          <tr className="bg-gray-800/50">
            <th className="text-left py-4 px-6 text-gray-400 font-medium">Rank</th>
            <th className="text-left py-4 px-6 text-gray-400 font-medium">Region</th>
            <th className="text-right py-4 px-6 text-gray-400 font-medium">Nodes</th>
            <th className="text-right py-4 px-6 text-gray-400 font-medium">Avg Uptime</th>
            <th className="text-right py-4 px-6 text-gray-400 font-medium">Avg Latency</th>
            <th className="text-right py-4 px-6 text-gray-400 font-medium">Total Jobs</th>
            <th className="text-right py-4 px-6 text-gray-400 font-medium">Total Earnings</th>
            <th className="text-center py-4 px-6 text-gray-400 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((region) => (
            <tr
              key={region.region}
              className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
            >
              <td className="py-4 px-6">
                <span className="text-gray-500 font-medium">{region.rank}</span>
              </td>
              <td className="py-4 px-6">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-blue-500" />
                  <span className="text-white font-medium">{region.region}</span>
                </div>
              </td>
              <td className="py-4 px-6 text-right">
                <span className="text-gray-300">{region.nodeCount.toLocaleString()}</span>
              </td>
              <td className="py-4 px-6 text-right">
                <span className="text-blue-400">{region.averageUptime.toFixed(1)}%</span>
              </td>
              <td className="py-4 px-6 text-right">
                <span className="text-gray-300">{region.averageLatency.toFixed(0)}ms</span>
              </td>
              <td className="py-4 px-6 text-right">
                <span className="text-gray-300">{region.totalJobs.toLocaleString()}</span>
              </td>
              <td className="py-4 px-6 text-right">
                <span className="text-green-400 font-medium">
                  {parseFloat(region.totalEarnings).toFixed(2)} SYN
                </span>
              </td>
              <td className="py-4 px-6 text-center">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    region.status === 'expanding'
                      ? 'bg-green-900/50 text-green-400'
                      : region.status === 'stable'
                      ? 'bg-blue-900/50 text-blue-400'
                      : 'bg-yellow-900/50 text-yellow-400'
                  }`}
                >
                  {region.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
