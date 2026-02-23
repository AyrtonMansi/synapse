/**
 * Stat Card Component
 * Reusable stat display card with trend indicator
 */

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  title: string;
  value: string;
  subtitle: string;
  trend?: number;
  color: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'emerald' | 'cyan' | 'pink';
}

const colorClasses = {
  blue: 'from-blue-500/20 to-blue-600/10 text-blue-400 border-blue-500/30',
  green: 'from-green-500/20 to-green-600/10 text-green-400 border-green-500/30',
  red: 'from-red-500/20 to-red-600/10 text-red-400 border-red-500/30',
  yellow: 'from-yellow-500/20 to-yellow-600/10 text-yellow-400 border-yellow-500/30',
  purple: 'from-purple-500/20 to-purple-600/10 text-purple-400 border-purple-500/30',
  emerald: 'from-emerald-500/20 to-emerald-600/10 text-emerald-400 border-emerald-500/30',
  cyan: 'from-cyan-500/20 to-cyan-600/10 text-cyan-400 border-cyan-500/30',
  pink: 'from-pink-500/20 to-pink-600/10 text-pink-400 border-pink-500/30',
};

const iconColors = {
  blue: 'text-blue-500',
  green: 'text-green-500',
  red: 'text-red-500',
  yellow: 'text-yellow-500',
  purple: 'text-purple-500',
  emerald: 'text-emerald-500',
  cyan: 'text-cyan-500',
  pink: 'text-pink-500',
};

export const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  title,
  value,
  subtitle,
  trend,
  color,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${colorClasses[color]} p-5`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          <p className="text-gray-500 text-xs mt-1">{subtitle}</p>
        </div>
        <div className={`p-2 rounded-lg bg-gray-900/50 ${iconColors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-3">
          {trend > 0 ? (
            <>
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-green-400 text-sm font-medium">+{trend.toFixed(1)}%</span>
            </>
          ) : trend < 0 ? (
            <>
              <TrendingDown className="w-4 h-4 text-red-400" />
              <span className="text-red-400 text-sm font-medium">{trend.toFixed(1)}%</span>
            </>
          ) : (
            <span className="text-gray-500 text-sm">No change</span>
          )}
          <span className="text-gray-500 text-xs ml-1">vs last period</span>
        </div>
      )}
    </motion.div>
  );
};
