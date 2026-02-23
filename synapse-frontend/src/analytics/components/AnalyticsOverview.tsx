/**
 * Analytics Overview Component
 * Main dashboard overview with key metrics
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  TrendingUp,
  Users,
  Cpu,
  DollarSign,
  Globe,
  Clock,
  AlertCircle,
} from 'lucide-react';
import {
  useNetworkStats,
  useTokenPrice,
  useSystemHealth,
  useAPILatencies,
} from '../api';
import { StatCard } from './StatCard';
import { LoadingState } from './LoadingState';
import { formatCurrency, formatNumber } from '../utils/formatters';

export const AnalyticsOverview: React.FC = () => {
  const { data: networkStats, isLoading: networkLoading } = useNetworkStats();
  const { data: tokenPrice, isLoading: priceLoading } = useTokenPrice();
  const { data: systemHealth, isLoading: healthLoading } = useSystemHealth();
  const { data: apiLatencies, isLoading: latencyLoading } = useAPILatencies('1h');

  const isLoading = networkLoading || priceLoading || healthLoading || latencyLoading;

  if (isLoading) return <LoadingState message="Loading analytics overview..." />;

  const avgLatency = apiLatencies?.length
    ? apiLatencies.reduce((sum, item) => sum + item.average, 0) / apiLatencies.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Activity className="w-8 h-8 text-blue-500" />
          Analytics Overview
        </h1>
        <p className="text-gray-400 mt-1">
          Real-time insights into the Synapse network
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          title="Active Nodes"
          value={networkStats?.activeNodes.toLocaleString() || '0'}
          subtitle={`${networkStats?.onlineNodes.toLocaleString()} online`}
          trend={+5.2}
          color="blue"
        />
        <StatCard
          icon={Cpu}
          title="Compute Power"
          value={`${networkStats?.totalTFLOPS.toFixed(1)} TFLOPS`}
          subtitle={`${networkStats?.totalGPUCount} GPUs active`}
          trend={+8.7}
          color="purple"
        />
        <StatCard
          icon={DollarSign}
          title="Token Price"
          value={formatCurrency(tokenPrice?.price || 0)}
          subtitle={`${tokenPrice && tokenPrice.priceChange24h >= 0 ? '+' : ''}${tokenPrice?.priceChange24h.toFixed(2)}% 24h`}
          trend={tokenPrice?.priceChange24h}
          color={tokenPrice && tokenPrice.priceChange24h >= 0 ? 'green' : 'red'}
        />
        <StatCard
          icon={Clock}
          title="Avg API Latency"
          value={`${avgLatency.toFixed(0)}ms`}
          subtitle="Last hour"
          trend={-3.5}
          color="cyan"
        />
      </div>

      {/* System Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900 rounded-xl p-6 border border-gray-800"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Globe className="w-6 h-6 text-green-500" />
            System Status
          </h2>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                systemHealth?.overall === 'healthy'
                  ? 'bg-green-500'
                  : systemHealth?.overall === 'degraded'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
            />
            <span
              className={`text-sm font-medium capitalize ${
                systemHealth?.overall === 'healthy'
                  ? 'text-green-400'
                  : systemHealth?.overall === 'degraded'
                  ? 'text-yellow-400'
                  : 'text-red-400'
              }`}
            >
              {systemHealth?.overall}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {systemHealth?.services.map((service) => (
            <div
              key={service.name}
              className="bg-gray-800 rounded-lg p-4 flex items-center justify-between"
            >
              <div>
                <p className="text-white font-medium">{service.name}</p>
                <p className="text-gray-500 text-sm">{service.latency.toFixed(0)}ms latency</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    service.status === 'healthy'
                      ? 'bg-green-500'
                      : service.status === 'degraded'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                />
                <span className="text-gray-400 text-sm">{service.uptime.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Recent Incidents */}
      {systemHealth?.incidents && systemHealth.incidents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-900 rounded-xl p-6 border border-gray-800"
        >
          <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-4">
            <AlertCircle className="w-6 h-6 text-red-500" />
            Recent Incidents
          </h2>
          <div className="space-y-3">
            {systemHealth.incidents.slice(0, 5).map((incident) => (
              <div
                key={incident.id}
                className="flex items-center justify-between bg-gray-800 rounded-lg p-4"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      incident.severity === 'critical'
                        ? 'bg-red-900/50 text-red-400'
                        : incident.severity === 'high'
                        ? 'bg-orange-900/50 text-orange-400'
                        : incident.severity === 'medium'
                        ? 'bg-yellow-900/50 text-yellow-400'
                        : 'bg-blue-900/50 text-blue-400'
                    }`}
                  >
                    {incident.severity}
                  </span>
                  <span className="text-gray-300">{incident.description}</span>
                </div>
                <div className="text-right">
                  <p className="text-gray-500 text-sm">
                    {new Date(incident.startedAt).toLocaleString()}
                  </p>
                  {incident.resolvedAt && (
                    <p className="text-green-400 text-xs">Resolved</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};
