import { useState, useEffect } from 'react';
import { Moon, Sun, Monitor, Globe, Trash2, AlertTriangle, Check } from 'lucide-react';
import { useToast } from '../../lib/toast';

type Theme = 'dark' | 'light' | 'system';
type ApiEnvironment = 'local' | 'staging' | 'production';

export function SettingsPage() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [apiEnv, setApiEnv] = useState<ApiEnvironment>('local');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [storageInfo, setStorageInfo] = useState({ used: 0, items: 0 });
  const { showToast } = useToast();

  useEffect(() => {
    // Load settings from localStorage
    const savedTheme = localStorage.getItem('synapse_theme') as Theme;
    const savedApiEnv = localStorage.getItem('synapse_api_env') as ApiEnvironment;
    
    if (savedTheme) setTheme(savedTheme);
    if (savedApiEnv) setApiEnv(savedApiEnv);

    // Calculate storage usage
    let totalSize = 0;
    let itemCount = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('synapse_')) {
        const value = localStorage.getItem(key) || '';
        totalSize += value.length * 2; // UTF-16 encoding
        itemCount++;
      }
    }
    setStorageInfo({ used: Math.round(totalSize / 1024), items: itemCount });
  }, []);

  const saveTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('synapse_theme', newTheme);
    showToast('Theme updated', 'success');
    // In a real app, this would trigger theme change
  };

  const saveApiEnv = (newEnv: ApiEnvironment) => {
    setApiEnv(newEnv);
    localStorage.setItem('synapse_api_env', newEnv);
    
    const urls = {
      local: 'http://localhost:3001',
      staging: 'https://api.staging.synapse.sh',
      production: 'https://api.synapse.sh',
    };
    
    localStorage.setItem('synapse_api_url', urls[newEnv]);
    showToast(`API environment set to ${newEnv}`, 'success');
  };

  const resetAllData = () => {
    // Clear all synapse-related localStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('synapse_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    setShowResetConfirm(false);
    showToast('All local data cleared', 'success');
    setStorageInfo({ used: 0, items: 0 });
  };

  const formatBytes = (kb: number) => {
    if (kb < 1024) return `${kb} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-charcoal-100">Settings</h1>
        <p className="text-charcoal-400">Configure your Synapse experience</p>
      </div>

      <div className="space-y-6">
        {/* Appearance */}
        <div className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-6">
          <h2 className="text-sm font-medium text-charcoal-400 uppercase tracking-wider mb-4">
            Appearance
          </h2>
          
          <div className="space-y-3">
            {[
              { value: 'dark', label: 'Dark', icon: Moon },
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'system', label: 'System', icon: Monitor },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => saveTheme(option.value as Theme)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  theme === option.value
                    ? 'bg-synapse-500/10 border-synapse-500/50'
                    : 'bg-charcoal-950 border-charcoal-800 hover:border-charcoal-700'
                }`}
              >
                <option.icon size={18} className={theme === option.value ? 'text-synapse-400' : 'text-charcoal-500'} />
                <span className={theme === option.value ? 'text-charcoal-200' : 'text-charcoal-400'}>
                  {option.label}
                </span>
                {theme === option.value && (
                  <Check size={16} className="text-synapse-500 ml-auto" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* API Configuration */}
        <div className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-6">
          <h2 className="text-sm font-medium text-charcoal-400 uppercase tracking-wider mb-4">
            API Configuration
          </h2>
          
          <div className="space-y-3">
            {[
              { value: 'local', label: 'Local', url: 'http://localhost:3001' },
              { value: 'staging', label: 'Staging', url: 'https://api.staging.synapse.sh' },
              { value: 'production', label: 'Production', url: 'https://api.synapse.sh' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => saveApiEnv(option.value as ApiEnvironment)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  apiEnv === option.value
                    ? 'bg-synapse-500/10 border-synapse-500/50'
                    : 'bg-charcoal-950 border-charcoal-800 hover:border-charcoal-700'
                }`}
              >
                <Globe size={18} className={apiEnv === option.value ? 'text-synapse-400' : 'text-charcoal-500'} />
                <div className="text-left">
                  <span className={apiEnv === option.value ? 'text-charcoal-200' : 'text-charcoal-400'}>
                    {option.label}
                  </span>
                  <p className="text-xs text-charcoal-600 font-mono">{option.url}</p>
                </div>
                {apiEnv === option.value && (
                  <Check size={16} className="text-synapse-500 ml-auto" />
                )}
              </button>
            ))}
          </div>
          
          <div className="mt-4 p-3 bg-charcoal-950 rounded-lg border border-charcoal-800">
            <p className="text-xs text-charcoal-500">
              Current API URL: <span className="text-charcoal-400 font-mono">{localStorage.getItem('synapse_api_url') || 'Not set'}</span>
            </p>
          </div>
        </div>

        {/* Storage */}
        <div className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-6">
          <h2 className="text-sm font-medium text-charcoal-400 uppercase tracking-wider mb-4">
            Local Storage
          </h2>
          
          <div className="flex items-center justify-between p-4 bg-charcoal-950 rounded-lg border border-charcoal-800">
            <div>
              <p className="text-sm text-charcoal-300">Storage Used</p>
              <p className="text-xs text-charcoal-500 mt-1">
                {storageInfo.items} items • {formatBytes(storageInfo.used)}
              </p>
            </div>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
            >
              <Trash2 size={16} />
              Reset
            </button>
          </div>
        </div>

        {/* About */}
        <div className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-6">
          <h2 className="text-sm font-medium text-charcoal-400 uppercase tracking-wider mb-4">
            About
          </h2>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-charcoal-500">Version</span>
              <span className="text-charcoal-300">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-charcoal-500">Build</span>
              <span className="text-charcoal-300 font-mono">{import.meta.env.VITE_BUILD_ID || 'dev'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-charcoal-500">Environment</span>
              <span className="text-charcoal-300">{import.meta.env.MODE}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-900/50 rounded-full flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-charcoal-100">Reset All Data?</h3>
            </div>
            
            <p className="text-charcoal-400 mb-6">
              This will permanently delete all your API keys, chat history, and settings from this browser. 
              This action cannot be undone.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={resetAllData}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
