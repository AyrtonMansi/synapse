import { Routes, Route, Navigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Suspense, lazy } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import PageLoader from './components/PageLoader';

// Pages
const Home = lazy(() => import('./pages/Home'));
const Connect = lazy(() => import('./pages/Connect'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Nodes = lazy(() => import('./pages/Nodes'));
const Wallet = lazy(() => import('./pages/Wallet'));
const Governance = lazy(() => import('./pages/Governance'));
const Documentation = lazy(() => import('./pages/Documentation'));
const NotFound = lazy(() => import('./pages/NotFound'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  return isConnected ? <>{children}</> : <Navigate to="/connect" replace />;
}

function App() {
  return (
    <ErrorBoundary>
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/connect" element={<Connect />} />
            <Route path="/docs" element={<Documentation />} />
            
            {/* Protected Routes - require wallet connection */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/nodes" element={<ProtectedRoute><Nodes /></ProtectedRoute>} />
            <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
            <Route path="/governance" element={<ProtectedRoute><Governance /></ProtectedRoute>} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Layout>
    </ErrorBoundary>
  );
}

export default App;