import { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';

interface QuickInstallProps {
  wallet?: string;
}

export function QuickInstall({ wallet }: QuickInstallProps) {
  const [copied, setCopied] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);

  const command = wallet 
    ? `curl -sSL https://synapse.sh/install | bash -s -- --wallet ${wallet}`
    : 'curl -sSL https://synapse.sh/install | bash';

  // Typing animation
  useEffect(() => {
    let index = 0;
    const typeChar = () => {
      if (index < command.length) {
        setDisplayedText(command.slice(0, index + 1));
        index++;
        setTimeout(typeChar, 25);
      }
    };
    const timer = setTimeout(typeChar, 300);
    return () => clearTimeout(timer);
  }, [command]);

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="quick-install">
      <div className="quick-install-label">Node Install</div>
      
      <div 
        className={`install-command ${displayedText.length < command.length ? 'typing' : ''}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <code>{displayedText}</code>
        
        <button className="install-copy" onClick={handleCopy}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
        
        {/* Tooltip */}
        {showTooltip && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '0',
            marginBottom: '8px',
            padding: '8px 12px',
            background: '#111',
            border: '1px solid #333',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#888',
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}>
            <span style={{ color: '#0f0' }}>~$850/mo</span> est. earnings (RTX 4090)
          </div>
        )}
      </div>
      
      <div style={{ 
        marginTop: '12px', 
        display: 'flex', 
        gap: '16px',
        fontSize: '10px',
        color: '#444'
      }}>
        <span>• Auto-detect GPU</span>
        <span>• Connect to mesh</span>
        <span>• Start earning</span>
      </div>
    </div>
  );
}
