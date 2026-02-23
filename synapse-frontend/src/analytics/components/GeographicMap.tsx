/**
 * Geographic Map Component
 * Displays node distribution on a world map
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { GeographicNode } from '../types';

interface GeographicMapProps {
  data: GeographicNode[];
}

// Simple SVG world map paths for major regions
const WORLD_MAP_PATHS = {
  northAmerica: 'M50,80 L250,80 L280,200 L150,280 L30,200 Z',
  southAmerica: '180,300 L280,300 L300,450 L200,500 L160,400 Z',
  europe: '420,100 L520,100 L530,180 L450,200 L410,160 Z',
  africa: '420,220 L520,220 L540,380 L460,420 L400,340 Z',
  asia: '540,80 L780,80 L800,240 L600,280 L540,200 Z',
  oceania: '700,340 L820,340 L840,440 L720,460 Z',
};

// Predefined region positions for the simplified map
const REGION_POSITIONS: Record<string, { x: number; y: number }> = {
  'us-east': { x: 180, y: 150 },
  'us-west': { x: 80, y: 160 },
  'us-central': { x: 130, y: 140 },
  'eu-west': { x: 450, y: 140 },
  'eu-central': { x: 480, y: 130 },
  'eu-north': { x: 470, y: 100 },
  'ap-south': { x: 620, y: 220 },
  'ap-southeast': { x: 750, y: 300 },
  'ap-northeast': { x: 720, y: 140 },
  'sa-east': { x: 240, y: 380 },
  'af-south': { x: 480, y: 380 },
  'me-south': { x: 550, y: 200 },
  'ca-central': { x: 160, y: 100 },
  'ap-east': { x: 680, y: 180 },
};

export const GeographicMap: React.FC<GeographicMapProps> = ({ data }) => {
  // Aggregate data by region
  const regionData = useMemo(() => {
    const aggregated = new Map<string, GeographicNode[]>();
    
    data.forEach((node) => {
      const existing = aggregated.get(node.region) || [];
      existing.push(node);
      aggregated.set(node.region, existing);
    });

    return Array.from(aggregated.entries()).map(([region, nodes]) => ({
      region,
      nodes,
      totalNodes: nodes.reduce((sum, n) => sum + n.nodeCount, 0),
      totalGPUs: nodes.reduce((sum, n) => sum + n.gpuCount, 0),
      avgUtilization: nodes.reduce((sum, n) => sum + n.utilization, 0) / nodes.length,
      status: nodes.some((n) => n.status === 'critical')
        ? 'critical'
        : nodes.some((n) => n.status === 'degraded')
        ? 'degraded'
        : 'healthy',
      position: REGION_POSITIONS[region] || { x: 400, y: 250 },
    }));
  }, [data]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return '#22c55e';
      case 'degraded':
        return '#f59e0b';
      case 'critical':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getBubbleSize = (nodeCount: number) => {
    const baseSize = 8;
    const scale = Math.min(nodeCount / 100, 3);
    return baseSize + scale * 8;
  };

  return (
    <div className="relative w-full h-full bg-gray-950 rounded-lg overflow-hidden">
      {/* World Map Background */}
      <svg
        viewBox="0 0 900 500"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Ocean background */}
        <rect width="900" height="500" fill="#0f172a" />

        {/* Continents */}
        <g fill="#1e293b" stroke="#334155" strokeWidth="1">
          {/* North America */}
          <path d="M50,60 L280,60 L300,180 L200,220 L100,200 L40,140 Z" />
          {/* South America */}
          <path d="M200,240 L280,240 L300,380 L220,420 L180,340 Z" />
          {/* Europe */}
          <path d="M420,80 L540,80 L550,160 L480,180 L410,140 Z" />
          {/* Africa */}
          <path d="M420,200 L540,200 L560,360 L480,400 L400,320 Z" />
          {/* Asia */}
          <path d="M560,60 L800,60 L820,220 L620,260 L560,180 Z" />
          {/* Oceania */}
          <path d="M680,320 L820,320 L840,420 L720,440 Z" />
        </g>

        {/* Grid lines */}
        <g stroke="#1e293b" strokeWidth="0.5" opacity="0.5">
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`v${i}`} x1={(i + 1) * 100} y1="0" x2={(i + 1) * 100} y2="500" />
          ))}
          {Array.from({ length: 5 }, (_, i) => (
            <line key={`h${i}`} x1="0" y1={(i + 1) * 100} x2="900" y2={(i + 1) * 100} />
          ))}
        </g>
      </svg>

      {/* Region Bubbles */}
      <svg
        viewBox="0 0 900 500"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid slice"
      >
        {regionData.map((region) => (
          <g key={region.region}>
            {/* Glow effect */}
            <circle
              cx={region.position.x}
              cy={region.position.y}
              r={getBubbleSize(region.totalNodes) * 1.5}
              fill={getStatusColor(region.status)}
              opacity="0.2"
            >
              <animate
                attributeName="r"
                values={`${getBubbleSize(region.totalNodes) * 1.5};${getBubbleSize(region.totalNodes) * 2};${getBubbleSize(region.totalNodes) * 1.5}`}
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
            
            {/* Main bubble */}
            <motion.circle
              cx={region.position.x}
              cy={region.position.y}
              r={getBubbleSize(region.totalNodes)}
              fill={getStatusColor(region.status)}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: Math.random() * 0.5, type: 'spring' }}
              className="cursor-pointer"
            />
            
            {/* Node count label */}
            {region.totalNodes > 50 && (
              <text
                x={region.position.x}
                y={region.position.y + 4}
                textAnchor="middle"
                fill="white"
                fontSize="10"
                fontWeight="bold"
                className="pointer-events-none"
              >
                {region.totalNodes > 999 ? '999+' : region.totalNodes}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-gray-900/90 backdrop-blur rounded-lg p-4 border border-gray-800">
        <h4 className="text-white font-medium mb-2 text-sm">Region Status</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-gray-400 text-xs">Healthy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-gray-400 text-xs">Degraded</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-gray-400 text-xs">Critical</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-800">
          <h4 className="text-white font-medium mb-2 text-sm">Node Count</h4>
          <div className="flex items-center gap-2">
            <div className="flex items-end gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <div className="w-4 h-4 rounded-full bg-blue-500" />
            </div>
            <span className="text-gray-400 text-xs">Low → High</span>
          </div>
        </div>
      </div>

      {/* Stats overlay */}
      <div className="absolute top-4 right-4 bg-gray-900/90 backdrop-blur rounded-lg p-4 border border-gray-800">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-gray-500 text-xs">Regions</p>
            <p className="text-white font-bold">{regionData.length}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Total Nodes</p>
            <p className="text-white font-bold">
              {regionData.reduce((sum, r) => sum + r.totalNodes, 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Total GPUs</p>
            <p className="text-white font-bold">
              {regionData.reduce((sum, r) => sum + r.totalGPUs, 0).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">Avg Utilization</p>
            <p className="text-white font-bold">
              {(
                regionData.reduce((sum, r) => sum + r.avgUtilization, 0) / (regionData.length || 1)
              ).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
