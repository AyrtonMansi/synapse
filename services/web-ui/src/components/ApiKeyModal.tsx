import { useState } from 'react';
import { Key, Copy, Check, Terminal, ArrowRight } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (input: string) => Promise<string>;
}

export function ApiKeyModal({ isOpen, onClose, onGenerate }: ApiKeyModalProps) {
  const [input, setInput] = useState('');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!input.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const key = await onGenerate(input);
      setApiKey(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate key');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setInput('');
    setApiKey(null);
    setError(null);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="sidebar-logo" style={{ marginBottom: '8px' }}>
            <Terminal size={20} className="icon" />
            <span className="modal-title">Synapse Gateway</span>
          </div>
          <p className="modal-subtitle">
            Generate an API key to access the network
          </p>
        </div>

        {!apiKey ? (
          <>
            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                className="input-terminal"
                placeholder="wallet address or email"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                autoFocus
              />
            </div>

            {error && (
              <div style={{ 
                color: 'var(--error)', 
                fontSize: '12px', 
                marginBottom: '16px' 
              }}>
                {error}
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={loading || !input.trim()}
              style={{ width: '100%' }}
            >
              {loading ? (
                <span className="typing">Generating</span>
              ) : (
                <>
                  <Key size={14} />
                  Generate API Key
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: '16px' }}>
              <div 
                className="code-block"
                style={{ 
                  fontSize: '11px',
                  wordBreak: 'break-all',
                  paddingRight: '70px'
                }}
              >
                {apiKey}
                <button className="copy-btn" onClick={handleCopy}>
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>
                Quick start:
              </p>
              <div className="code-block" style={{ fontSize: '11px' }}>
                {`curl -X POST https://api.synapse.sh/v1/chat/completions \\
  -H "Authorization: Bearer ${apiKey.slice(0, 20)}..." \\
  -d '{"model":"deepseek-v3","messages":[{"role":"user","content":"Hello"}]}'`}
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleClose}
              style={{ width: '100%' }}
            >
              <ArrowRight size={14} />
              Enter Gateway
            </button>
          </>
        )}

        <div style={{ 
          marginTop: '16px', 
          textAlign: 'center',
          fontSize: '11px',
          color: 'var(--text-muted)'
        }}>
          Your key is stored locally in your browser
        </div>
      </div>
    </div>
  );
}
