import { Routes, Route, Navigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Suspense, lazy } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import PageLoader from './components/PageLoader';

// Lazy load pages for code splitting
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NodeOperator = lazy(() => import('./pages/NodeOperator'));
const NodeSetup = lazy(() => import('./pages/NodeSetup'));
const NodeDashboard = lazy(() => import('./pages/NodeDashboard'));
const SetupWizard = lazy(() => import('./pages/SetupWizard'));
const Governance = lazy(() => import('./pages/Governance'));
const ProposalDetails = lazy(() => import('./pages/ProposalDetails'));
const Documentation = lazy(() => import('./pages/Documentation'));
const DocsPage = lazy(() => import('./pages/docs/Documentation'));
const ApiReference = lazy(() => import('./pages/ApiReference'));
const SdkGuide = lazy(() => import('./pages/SdkGuide'));
const QuickStart = lazy(() => import('./pages/QuickStart'));
const Pricing = lazy(() => import('./pages/Pricing'));
const NotFound = lazy(() => import('./pages/NotFound'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  
  if (!isConnected) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/docs" element={<Documentation />} />
            <Route path="/docs/support" element={<DocsPage />} />
            <Route path="/docs/api" element={<ApiReference />} />
            <Route path="/docs/sdk" element={<SdkGuide />} />
            <Route path="/docs/quickstart" element={<QuickStart />} />
            <Route path="/docs/node-setup" element={<NodeSetup />} />
            <Route path="/setup" element={<SetupWizard />} />
            <Route path="/governance" element={<Governance />} />
            <Route path="/pricing" element={<Pricing />} />
            
            {/* Protected Routes */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/nodes" 
              element={
                <ProtectedRoute>
                  <NodeOperator />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/node-dashboard" 
              element={
                <ProtectedRoute>
                  <NodeDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/governance/:id" 
              element={
                <ProtectedRoute>
                  <ProposalDetails />
                </ProtectedRoute>
              } 
            />
            
            {/* Legacy redirects */}
            <Route path="/operator" element={<Navigate to="/nodes" replace />} />
            <Route path="/wizard" element={<Navigate to="/setup" replace />} />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Layout>
    </ErrorBoundary>
  );
}

export default App;
