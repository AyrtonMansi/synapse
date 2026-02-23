/**
 * Synapse Analytics & Monitoring Platform
 * 
 * A comprehensive analytics solution for the Synapse Protocol network
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { NetworkAnalyticsDashboard } from './analytics/components/NetworkAnalyticsDashboard';
import { EconomicMetricsDashboard } from './analytics/components/EconomicMetricsDashboard';
import { PerformanceMonitoringDashboard } from './analytics/components/PerformanceMonitoringDashboard';
import { LeaderboardsDashboard } from './analytics/components/LeaderboardsDashboard';
import { AnalyticsOverview } from './analytics/components/AnalyticsOverview';

/**
 * Example usage in your main App.tsx:
 * 
 * function App() {
 *   return (
 *     <Router>
 *       <Layout>
 *         <Routes>
 *           <Route path="/analytics" element={<AnalyticsOverview />} />
 *           <Route path="/analytics/network" element={<NetworkAnalyticsDashboard />} />
 *           <Route path="/analytics/economic" element={<EconomicMetricsDashboard />} />
 *           <Route path="/analytics/performance" element={<PerformanceMonitoringDashboard />} />
 *           <Route path="/analytics/leaderboards" element={<LeaderboardsDashboard />} />
 *         </Routes>
 *       </Layout>
 *     </Router>
 *   );
 * }
 */

export {
  NetworkAnalyticsDashboard,
  EconomicMetricsDashboard,
  PerformanceMonitoringDashboard,
  LeaderboardsDashboard,
  AnalyticsOverview,
};
