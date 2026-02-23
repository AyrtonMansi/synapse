/**
 * Performance Monitoring Dashboard
 * API latency, model performance, errors, and capacity forecasting
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Clock,
  AlertTriangle,
  Zap,
  TrendingUp,
  Server,
  Brain,
  Gauge,
  Calendar,
  Filter,
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
  Cell,
  Legend,
  ComposedChart,
  ScatterChart,
  Scatter,
} from 'recharts';
import {
  useAPILatencies,
  useLatencyHeatmap,
  useModelPerformance,
  useErrorRates,
  useCapacityForecast,
} from '../api';
import { StatCard } from './StatCard';
import { TimeRangeSelector } from './TimeRangeSelector';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';
import { LatencyHeatmap } from './LatencyHeatmap';

const ERROR_COLORS = {
  '4xx': '#f59e0b',
  '5xx': '#ef4444',
  timeout: '#8b5cf6',
  rate_limit: '#06b6d4',
  other: '#6b7280',
};

const MODEL_COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#ec4899', '#10b981', '#6366f1', '#f97316'];

export const PerformanceMonitoringDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState('24h');
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');

  const {
    data: apiLatencies,
    isLoading: latenciesLoading,
    error: latenciesError,
  } = useAPILatencies(timeRange);

  const {
    data: heatmapData,
    isLoading: heatmapLoading,
  } = useLatencyHeatmap(timeRange, selectedEndpoint || undefined);

  const {
    data: modelPerformance,
    isLoading: modelsLoading,
  } = useModelPerformance();

  const {
    data: errorRates,
    isLoading: errorsLoading,
  } = useErrorRates(timeRange);

  const {
    data: capacityForecast,
    isLoading: forecastLoading,
  } = useCapacityForecast();

  const isLoading = latenciesLoading || heatmapLoading || modelsLoading || errorsLoading || forecastLoading;
  const hasError = latenciesError;

  // Process latency data
  const latencyChartData = useMemo(() => {
    if (!apiLatencies) return [];
    return apiLatencies.map((item) => ({
      timestamp: new Date(item.timestamp).toLocaleTimeString(),
      p50: item.p50,
      p95: item.p95,
      p99: item.p99,
      average: item.average,
      endpoint: item.endpoint,
    }));
  }, [apiLatencies]);

  // Get unique endpoints for filter
  const uniqueEndpoints = useMemo(() => {
    if (!apiLatencies) return [];
    return [...new Set(apiLatencies.map((item) => item.endpoint))];
  }, [apiLatencies]);

  // Process error data
  const errorChartData = useMemo(() => {
    if (!errorRates) return [];
    return errorRates.map((item) => ({
      timestamp: new Date(item.timestamp).toLocaleTimeString(),
      errorRate: item.errorRate * 100,
      totalRequests: item.totalRequests,
      errorCount: item.errorCount,
    }));
  }, [errorRates]);

  // Process errors by type
  const errorsByType = useMemo(() => {
    if (!errorRates || errorRates.length === 0) return [];
    const latest = errorRates[errorRates.length - 1];
    return latest.errorsByType.map((error) => ({
      ...error,
      color: ERROR_COLORS[error.type as keyof typeof ERROR_COLORS] || ERROR_COLORS.other,
    }));
  }, [errorRates]);

  // Process model performance data
  const modelChartData = useMemo(() => {
    if (!modelPerformance) return [];
    return modelPerformance.map((model) => ({
      model: model.model,
      avgLatency: model.averageLatency,
      p95Latency: model.p95Latency,
      tokensPerSecond: model.tokensPerSecond,
      successRate: model.successRate * 100,
      userSatisfaction: model.userSatisfaction * 100,
    }));
  }, [modelPerformance]);

  // Process capacity forecast data
  const forecastChartData = useMemo(() => {
    if (!capacityForecast) return [];
    return capacityForecast.timeHorizon.map((date, index) => ({
      date,
      current: index === 0 ? capacityForecast.currentCapacity : null,
      predicted: capacityForecast.predictedCapacity[index],
      confidence: capacityForecast.confidence[index],
    }));
  }, [capacityForecast]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!apiLatencies || !errorRates || !modelPerformance) return null;

    const latestLatency = apiLatencies[apiLatencies.length - 1];
    const latestErrors = errorRates[errorRates.length - 1];
    const avgSuccessRate = modelPerformance.reduce((acc, m) => acc + m.successRate, 0) / modelPerformance.length;

    return {
      avgLatency: latestLatency?.average || 0,
      p95Latency: latestLatency?.p95 || 0,
      errorRate: latestErrors?.errorRate || 0,
      successRate: avgSuccessRate,
      totalRequests: apiLatencies.reduce((acc, item) => acc + item.requestCount, 0),
    };
  }, [apiLatencies, errorRates, modelPerformance]);

  if (isLoading) return <LoadingState message="Loading performance metrics..." />;
  if (hasError) return <ErrorState message="Failed to load performance data" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-500" />
            Performance Monitoring
          </h1>
          <p className="text-gray-400 mt-1">
            API health, model performance, and system capacity
          </p>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Clock}
          title="Avg API Latency"
          value={`${summaryStats?.avgLatency.toFixed(0)}ms`}
          subtitle={`P95: ${summaryStats?.p95Latency.toFixed(0)}ms`}
          trend={-5.2}
          color="blue"
        />
        <StatCard
          icon={AlertTriangle}
          title="Error Rate"
          value={`${(summaryStats?.errorRate || 0).toFixed(2)}%`}
          subtitle="Last 24 hours"
          trend={-0.5}
          color={summaryStats && summaryStats.errorRate > 1 ? 'red' : 'green'}
        />
        <StatCard
          icon={Zap}
          title="Success Rate"
          value={`${((summaryStats?.successRate || 0) * 100).toFixed(1)}%`}
          subtitle="Model inference"
          trend={+0.3}
          color="emerald"
        />
        <StatCard
          icon={Server}
          title="Total Requests"
          value={(summaryStats?.totalRequests || 0).toLocaleString()}
          subtitle="API calls processed"
          trend={+12.5}
          color="purple"
        />
      </div>

      {/* API Latency Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900 rounded-xl p-6 border border-gray-800"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-semibold text-white">API Latency Over Time</h2>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={selectedEndpoint}
              onChange={(e) => setSelectedEndpoint(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">All Endpoints</option>
              {uniqueEndpoints.map((endpoint) => (
                <option key={endpoint} value={endpoint}>
                  {endpoint}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={latencyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="timestamp" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} unit="ms" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="average"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="Average"
              />
              <Line
                type="monotone"
                dataKey="p95"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="P95"
              />
              <Line
                type="monotone"
                dataKey="p99"
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="3 3"
                dot={false}
                name="P99"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Latency Heatmap */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gray-900 rounded-xl p-6 border border-gray-800"
      >
        <div className="flex items-center gap-3 mb-4">
          <Activity className="w-6 h-6 text-purple-500" />
          <h2 className="text-xl font-semibold text-white">Latency Heatmap</h2>
        </div>
        <LatencyHeatmap data={heatmapData || []} />
      </motion.div>

      {/* Model Performance & Error Rates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-900 rounded-xl p-6 border border-gray-800"
        >
          <div className="flex items-center gap-3 mb-4">
            <Brain className="w-6 h-6 text-pink-500" />
            <h2 className="text-xl font-semibold text-white">Model Performance</h2>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modelChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="model" stroke="#6b7280" fontSize={12} />
                <YAxis yAxisId="left" stroke="#6b7280" fontSize={12} unit="ms" />
                <YAxis yAxisId="right" orientation="right" stroke="#6b7280" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="avgLatency"
                  fill="#8b5cf6"
                  name="Avg Latency (ms)"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="tokensPerSecond"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Tokens/sec"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Error Rates */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-900 rounded-xl p-6 border border-gray-800"
        >
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <h2 className="text-xl font-semibold text-white">Error Rate Trends</h2>
          </div>
          <div className="h-64 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={errorChartData}>
                <defs>
                  <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="timestamp" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, 'Error Rate']}
                />
                <Area
                  type="monotone"
                  dataKey="errorRate"
                  stroke="#ef4444"
                  fill="url(#errorGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Error Type Distribution */}
          <div className="grid grid-cols-2 gap-3">
            {errorsByType.map((error) => (
              <div key={error.type} className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: error.color }}
                  />
                  <span className="text-gray-300 text-sm capitalize">{error.type}</span>
                </div>
                <span className="text-white font-medium">{error.percentage.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Model Comparison Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gray-900 rounded-xl p-6 border border-gray-800"
      >
        <div className="flex items-center gap-3 mb-4">
          <Gauge className="w-6 h-6 text-cyan-500" />
          <h2 className="text-xl font-semibold text-white">Model Comparison</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Model</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Avg Latency</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">P95 Latency</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Tokens/sec</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Success Rate</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">User Rating</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Cost/Token</th>
              </tr>
            </thead>
            <tbody>
              {modelPerformance?.map((model, index) => (
                <tr key={model.model} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: MODEL_COLORS[index % MODEL_COLORS.length] }}
                      />
                      <span className="text-white font-medium">{model.model}</span>
                      <span className="text-xs text-gray-500">v{model.version}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-300">{model.averageLatency.toFixed(0)}ms</td>
                  <td className="py-3 px-4 text-right text-gray-300">{model.p95Latency.toFixed(0)}ms</td>
                  <td className="py-3 px-4 text-right text-gray-300">{model.tokensPerSecond.toFixed(1)}</td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`font-medium ${
                        model.successRate > 0.99
                          ? 'text-green-400'
                          : model.successRate > 0.95
                          ? 'text-yellow-400'
                          : 'text-red-400'
                      }`}
                    >
                      {(model.successRate * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-yellow-400">★</span>
                      <span className="text-gray-300">{(model.userSatisfaction * 5).toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-300">{model.costPerToken.toFixed(6)} SYN</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Capacity Forecasting */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-gray-900 rounded-xl p-6 border border-gray-800"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-green-500" />
            <h2 className="text-xl font-semibold text-white">Capacity Forecast</h2>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-gray-400">Next 30 days</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Forecast Chart */}
          <div className="lg:col-span-2 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={forecastChartData}>
                <defs>
                  <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="predicted"
                  stroke="#10b981"
                  fill="url(#forecastGradient)"
                  name="Predicted Capacity"
                />
                <Line
                  type="monotone"
                  dataKey="current"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', r: 6 }}
                  name="Current Capacity"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Forecast Stats */}
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Growth Rate</p>
              <p className="text-2xl font-bold text-green-400">
                +{capacityForecast?.growthRate.toFixed(1)}%
              </p>
              <p className="text-gray-500 text-xs mt-1">Projected monthly growth</p>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-1">Confidence Level</p>
              <p className="text-2xl font-bold text-blue-400">
                {(capacityForecast?.confidence[0] || 0).toFixed(1)}%
              </p>
              <p className="text-gray-500 text-xs mt-1">Model prediction accuracy</p>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-gray-400 text-sm mb-2">Recommended Actions</p>
              <ul className="space-y-2">
                {capacityForecast?.recommendedActions.map((action, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-green-500 mt-0.5">•</span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
