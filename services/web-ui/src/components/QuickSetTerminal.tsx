import { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';

interface QuickSetTerminalProps {
  wallet?: string;
}

export function QuickSetTerminal({ wallet }: QuickSetTerminalProps) {
  const [copied, setCopied] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  
  const command = wallet 
    ? `curl -sSL https://synapse.sh/install | bash -s -- --wallet ${wallet}`
    : 'curl -sSL https://synapse.sh/install | bash';

  // Typing animation
  useEffect(() => {
    let index = 0;
    setDisplayedText('');
    
    const typeChar = () => {
      if (index < command.length) {
        setDisplayedText(command.slice(0, index + 1));
        index++;
        setTimeout(typeChar, 30);
      }
    };
    
    const timer = setTimeout(typeChar, 500);
    return () => clearTimeout(timer);
  }, [command]);

  // Blinking cursor
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="terminal-window glow-accent">
      <div className="terminal-header">
        <div className="terminal-dot red" />
        <div className="terminal-dot yellow" />
        <div className="terminal-dot green" />
        <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          Quick Set
        </span>
      </div>
      
      <div className="terminal-body">
        <div style={{ marginBottom: '12px', color: 'var(--text-muted)', fontSize: '11px' }}>
          # Run this on your GPU server to join the network
        </div>
        
        <div style={{ position: 'relative' }}>
          <code style={{ 
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--accent-primary)',
            wordBreak: 'break-all',
            lineHeight: '1.8'
          }}>
            $ {displayedText}
            <span 
              style={{ 
                opacity: showCursor ? 1 : 0,
                color: 'var(--accent-primary)'
              }}
            >
              ▋
            </span>
          </code>
          
          <button
            onClick={handleCopy}
            className="btn btn-secondary"
            style={{ 
              position: 'absolute',
              right: 0,
              top: 0,
              padding: '4px 8px',
              fontSize: '11px'
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        
        <div style={{ 
          marginTop: '16px', 
          paddingTop: '16px',
          borderTop: '1px solid var(--border-color)',
          fontSize: '11px',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>• Auto-detects GPU</span>
            <span>• Connects to router</span>
            <span>• Starts earning</span>
          </div>
        </div>
      </div>
    </div>
  );
}
