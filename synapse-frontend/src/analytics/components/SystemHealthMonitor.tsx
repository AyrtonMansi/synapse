/**
 * System Health Monitor Component
 * Real-time system health indicators
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Server,
  Database,
  Globe,
  Cpu,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { useSystemHealth } from '../api';

interface HealthIndicatorProps {
  name: string;
  status: 'healthy' | 'degraded' | 'critical';
  latency: number;
  uptime: number;
  lastCheck: number;
}

const HealthIndicator: React.FC<HealthIndicatorProps> = ({
  name,
  status,
  latency,
  uptime,
  lastCheck,
}) => {
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsChecking(true);
      setTimeout(() => setIsChecking(false), 500);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = () => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'healthy':
        return 'border-green-500/30 bg-green-500/10';
      case 'degraded':
        return 'border-yellow-500/30 bg-yellow-500/10';
      case 'critical':
        return 'border-red-500/30 bg-red-500/10';
    }
  };

  const getLatencyColor = () => {
    if (latency < 50) return 'text-green-400';
    if (latency < 100) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative p-4 rounded-lg border ${getStatusColor()} transition-all`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            {getStatusIcon()}
            {isChecking && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-blue-500"
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
          </div>
          <div>
            <p className="text-white font-medium">{name}</p>
            <p className={`text-sm ${getLatencyColor()}`}>{latency.toFixed(0)}ms</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-gray-400 text-xs">Uptime</p>
          <p className="text-white font-medium">{uptime.toFixed(2)}%</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
        <Clock className="w-3 h-3" />
        Last check: {new Date(lastCheck).toLocaleTimeString()}
      </div>
    </motion.div>
  );
};

export const SystemHealthMonitor: React.FC = () => {
  const { data: systemHealth, isLoading } = useSystemHealth();
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-1/3" />
          <div className="grid grid-cols-3 gap-4">
            <div className="h-24 bg-gray-800 rounded" />
            <div className="h-24 bg-gray-800 rounded" />
            <div className="h-24 bg-gray-800 rounded" />
          </div>
        </div>
      </div>
    );
  }

  const criticalCount = systemHealth?.services.filter((s) => s.status === 'critical').length || 0;
  const degradedCount = systemHealth?.services.filter((s) => s.status === 'degraded').length || 0;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-blue-500" />
          <div>
            <h3 className="text-white font-semibold">System Health</h3>
            <p className="text-gray-500 text-sm">
              {systemHealth?.services.length} services monitored
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-medium">
                {criticalCount} Critical
              </span>
            )}
            {degradedCount > 0 && (
              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium">
                {degradedCount} Degraded
              </span>
            )}
            {criticalCount === 0 && degradedCount === 0 && (
              <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium">
                All Healthy
              </span>
            )}
          </div>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            className="text-gray-400"
          >
            ▼
          </motion.div>
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-800"
          >
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {systemHealth?.services.map((service) => (
                <HealthIndicator
                  key={service.name}
                  name={service.name}
                  status={service.status}
                  latency={service.latency}
                  uptime={service.uptime}
                  lastCheck={service.lastCheck}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
