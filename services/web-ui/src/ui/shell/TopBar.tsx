import { ChevronDown, Settings, Copy, Check, Wifi, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../lib/toast';

interface TopBarProps {
  isOnline?: boolean;
  nodesCount?: number;
  latency?: number;
  apiKey?: string;
}

export function TopBar({ 
  isOnline = true, 
  nodesCount = 47, 
  latency = 89,
  apiKey 
}: TopBarProps) {
  const [copied, setCopied] = useState(false);
  const [showKeyDropdown, setShowKeyDropdown] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const maskedKey = apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : 'No key';
  
  const copyKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      showToast('API key copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const goToKeys = () => {
    navigate('/gateway/keys');
    setShowKeyDropdown(false);
  };

  const goToSettings = () => {
    navigate('/gateway/settings');
  };
  
  return (
    <header className="h-14 bg-charcoal-950 border-b border-charcoal-800 flex items-center justify-between px-4">
      {/* Left - could be breadcrumb or title */}
      <div />
      
      {/* Center - Connection status */}
      <div className="flex items-center gap-6">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors ${
          isOnline 
            ? 'bg-synapse-500/10 border-synapse-500/30' 
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          {isOnline ? (
            <Wifi size={14} className="text-synapse-500" />
          ) : (
            <WifiOff size={14} className="text-red-500" />
          )}
          <span className={`text-sm ${isOnline ? 'text-synapse-400' : 'text-red-400'}`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-charcoal-400">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-synapse-500" />
            {nodesCount} nodes
          </span>
          <span className="text-charcoal-600">|</span>
          <span>{latency}ms</span>
        </div>
      </div>
      
      {/* Right - API Key selector */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <button 
            onClick={() => setShowKeyDropdown(!showKeyDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 bg-charcoal-900 hover:bg-charcoal-800 rounded-lg border border-charcoal-800 transition-colors"
          >
            <span className="text-sm text-charcoal-300 font-mono">{maskedKey}</span>
            <ChevronDown size={14} className="text-charcoal-500" />
          </button>
          
          {showKeyDropdown && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowKeyDropdown(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-56 bg-charcoal-900 border border-charcoal-800 rounded-lg shadow-xl z-50 py-1">
                <button
                  onClick={copyKey}
                  className="w-full px-4 py-2 text-left text-sm text-charcoal-300 hover:bg-charcoal-800 flex items-center gap-2"
                >
                  {copied ? <Check size={14} className="text-synapse-500" /> : <Copy size={14} />}
                  Copy API Key
                </button>
                <div className="border-t border-charcoal-800 my-1" />
                <button
                  onClick={goToKeys}
                  className="w-full px-4 py-2 text-left text-sm text-charcoal-300 hover:bg-charcoal-800"
                >
                  Manage Keys
                </button>
              </div>
            </>
          )}
        </div>
        
        <button 
          onClick={goToSettings}
          className="p-2 text-charcoal-400 hover:text-charcoal-100 hover:bg-charcoal-800 rounded-lg transition-colors"
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
