import { useState } from 'react';
import { Shield, Lock, Eye, Download, Trash2, AlertTriangle, Check } from 'lucide-react';
import type { PrivacyTier } from '../../privacy/crypto';
import { privacyDescriptions } from '../../privacy/crypto';

interface PrivacyPanelProps {
  currentTier: PrivacyTier;
  keyId?: string;
  onTierChange: (tier: PrivacyTier) => void;
  onExportKey: () => Promise<string | null>;
  onImportKey: (key: string) => Promise<string | null>;
  onForgetAll: () => void;
}

export function PrivacyPanel({
  currentTier,
  keyId,
  onTierChange,
  onExportKey,
  onImportKey,
  onForgetAll,
}: PrivacyPanelProps) {
  const [showKeyBackup, setShowKeyBackup] = useState(false);
  const [keyBackup, setKeyBackup] = useState('');
  const [showForgetConfirm, setShowForgetConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleExport = async () => {
    const key = await onExportKey();
    if (key) {
      setKeyBackup(key);
      setShowKeyBackup(true);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(keyBackup);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const key = e.target.value.trim();
    if (key.length > 20) {
      await onImportKey(key);
      e.target.value = '';
    }
  };

  const tiers: PrivacyTier[] = ['standard', 'encrypted', 'e2ee'];
  const icons: Record<PrivacyTier, typeof Eye> = {
    standard: Eye,
    encrypted: Lock,
    e2ee: Shield,
  };

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-charcoal-100 mb-2">
          Privacy Settings
        </h1>
        <p className="text-charcoal-400">
          Control how your data is stored and who can access it.
        </p>
      </div>

      {/* Privacy Tier Selector */}
      <div className="space-y-4">
        <h2 className="text-sm font-medium text-charcoal-400 uppercase tracking-wider">
          Privacy Level
        </h2>
        
        <div className="space-y-3">
          {tiers.map((tier) => {
            const Icon = icons[tier];
            const isActive = currentTier === tier;
            const desc = privacyDescriptions[tier];
            
            return (
              <button
                key={tier}
                onClick={() => onTierChange(tier)}
                className={`w-full text-left p-5 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-synapse-900/20 border-synapse-600/50 ring-1 ring-synapse-600/30'
                    : 'bg-charcoal-900 border-charcoal-800 hover:border-charcoal-700'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${
                    isActive ? 'bg-synapse-600/20' : 'bg-charcoal-800'
                  }`}>
                    <Icon size={20} className={isActive ? 'text-synapse-400' : 'text-charcoal-400'} />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-medium text-charcoal-100">{desc.title}</h3>
                      {isActive && (
                        <span className="text-xs bg-synapse-600/20 text-synapse-400 px-2 py-0.5 rounded">
                          Active
                        </span>
                      )}
                      {tier === 'e2ee' && (
                        <span className="text-xs bg-charcoal-800 text-charcoal-400 px-2 py-0.5 rounded">
                          Preview
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm text-charcoal-400 mb-3">{desc.description}</p>
                    
                    <ul className="space-y-1">
                      {desc.warnings.map((warning: string, i: number) => (
                        <li key={i} className="text-xs text-charcoal-500 flex items-start gap-2">
                          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Encrypted Mode Controls */}
      {currentTier === 'encrypted' && (
        <div className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-6 space-y-6">
          <h2 className="text-sm font-medium text-charcoal-400 uppercase tracking-wider">
            Workspace Key
          </h2>
          
          {keyId ? (
            <>
              <div className="flex items-center justify-between p-4 bg-charcoal-950 rounded-lg border border-charcoal-800">
                <div>
                  <div className="text-sm text-charcoal-300">Active Key ID</div>
                  <div className="text-xs text-charcoal-500 font-mono mt-1">{keyId}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-synapse-500 animate-pulse" />
                  <span className="text-xs text-synapse-400">Ready</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleExport}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-200 rounded-lg transition-colors"
                >
                  <Download size={16} />
                  Backup Key
                </button>
              </div>

              {showKeyBackup && (
                <div className="p-4 bg-amber-950/30 border border-amber-900/50 rounded-lg">
                  <div className="flex items-start gap-3 mb-3">
                    <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-amber-200 font-medium">Save this key somewhere safe</p>
                      <p className="text-xs text-amber-400/80 mt-1">
                        If you lose this key, your encrypted history cannot be recovered.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <code className="flex-1 bg-charcoal-950 rounded px-3 py-2 text-xs text-charcoal-300 font-mono break-all">
                      {keyBackup.slice(0, 40)}...{keyBackup.slice(-20)}
                    </code>
                    <button
                      onClick={copyKey}
                      className="px-3 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-300 rounded-lg transition-colors"
                    >
                      {copied ? <Check size={16} /> : <span className="text-xs">Copy</span>}
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-charcoal-800">
                <label className="text-sm text-charcoal-400 mb-2 block">Restore from backup</label>
                <textarea
                  placeholder="Paste your workspace key here..."
                  onChange={handleImport}
                  className="w-full h-24 bg-charcoal-950 border border-charcoal-800 rounded-lg px-3 py-2 text-xs text-charcoal-300 font-mono placeholder-charcoal-600 focus:outline-none focus:border-synapse-600 resize-none"
                />
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-charcoal-400 mb-4">Initializing encryption...</p>
              <div className="w-8 h-8 border-2 border-synapse-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          )}
        </div>
      )}

      {/* Danger Zone */}
      <div className="bg-red-950/20 rounded-xl border border-red-900/50 p-6">
        <h2 className="text-sm font-medium text-red-400 uppercase tracking-wider mb-4">
          Danger Zone
        </h2>
        
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-charcoal-200 font-medium">Delete All Sessions</h3>
            <p className="text-sm text-charcoal-500">
              Permanently delete all encrypted sessions and keys
            </p>
          </div>
          <button
            onClick={() => setShowForgetConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-900/50 hover:bg-red-900 text-red-300 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
            Delete All
          </button>
        </div>
      </div>

      {/* Forget Confirmation Modal */}
      {showForgetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-900/50 rounded-full flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-charcoal-100">Delete Everything?</h3>
            </div>
            
            <p className="text-charcoal-400 mb-6">
              This will permanently delete all your encrypted chat sessions and workspace keys. 
              This action cannot be undone.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowForgetConfirm(false)}
                className="flex-1 py-2.5 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onForgetAll();
                  setShowForgetConfirm(false);
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
