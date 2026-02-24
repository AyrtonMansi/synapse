import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './ui/shell';
import { ChatView } from './ui/chat';
import { 
  KeysPage, 
  UsagePage, 
  RunNodePage, 
  HealthPage,
  NodesPage,
  SessionsPage,
  SettingsPage,
  DocsPage 
} from './ui/pages';
import { PrivacyPanel } from './ui/privacy';
import { usePrivacy } from './privacy/usePrivacy';
import { ToastProvider } from './lib/toast';
import { Landing } from './pages/Landing';
import './index.css';

function GatewayRoutes() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isAdmin] = useState(() =>
    import.meta.env.VITE_ADMIN_MODE === 'true' || localStorage.getItem('synapse_admin') === 'true'
  );
  const privacy = usePrivacy();

  useEffect(() => {
    const stored = localStorage.getItem('synapse_api_key');
    if (stored) setApiKey(stored);
  }, []);

  if (!apiKey) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppShell apiKey={apiKey} isAdmin={isAdmin}>
      <Routes>
        <Route path="chat" element={<ChatView apiKey={apiKey} privacy={privacy} />} />
        <Route path="sessions" element={<SessionsPage />} />
        <Route path="keys" element={<KeysPage />} />
        <Route path="usage" element={<UsagePage />} />
        <Route path="nodes" element={<NodesPage />} />
        <Route path="run-node" element={<RunNodePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="privacy" element={
          <PrivacyPanel
            currentTier={privacy.config.tier}
            keyId={privacy.config.keyId}
            onTierChange={privacy.setTier}
            onExportKey={privacy.exportKey}
            onImportKey={privacy.importKey}
            onForgetAll={privacy.forgetAll}
          />
        } />
        <Route path="*" element={<Navigate to="chat" replace />} />
      </Routes>
    </AppShell>
  );
}

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/health" element={<HealthPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/gateway" element={<Navigate to="/gateway/chat" replace />} />
          <Route path="/gateway/*" element={<GatewayRoutes />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
