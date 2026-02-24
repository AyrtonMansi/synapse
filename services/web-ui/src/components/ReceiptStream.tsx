import { useState, useEffect } from 'react';

interface Receipt {
  id: string;
  timestamp: Date;
  hash: string;
  nodeFingerprint: string;
  tokensProcessed: number;
  latency: number;
  verified: boolean;
}

export function ReceiptStream() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  useEffect(() => {
    // Generate initial receipts
    const initial: Receipt[] = Array.from({ length: 5 }, (_, i) => generateReceipt(i));
    setReceipts(initial);

    // Add new receipt periodically
    const interval = setInterval(() => {
      setReceipts(prev => {
        const newReceipt = generateReceipt(prev.length);
        return [newReceipt, ...prev].slice(0, 20); // Keep last 20
      });
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  const generateReceipt = (id: number): Receipt => ({
    id: `rcpt_${id}`,
    timestamp: new Date(),
    hash: `0x${Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`,
    nodeFingerprint: `node_${Array.from({ length: 8 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`,
    tokensProcessed: Math.floor(Math.random() * 1000) + 100,
    latency: Math.floor(Math.random() * 200) + 20,
    verified: Math.random() > 0.1,
  });

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const truncateHash = (hash: string) => {
    return `${hash.slice(0, 12)}...${hash.slice(-8)}`;
  };

  return (
    <div className="terminal-window" style={{ height: '100%' }}>
      <div className="terminal-header">
        <span>receipts.stream</span>
        <span style={{ marginLeft: 'auto', color: '#666' }}>
          {receipts.length} receipts
        </span>
      </div>
      
      <div className="terminal-body">
        <div className="log-stream">
          {receipts.map((receipt, index) => (
            <div 
              key={receipt.id}
              className="log-entry"
              style={{
                animation: index === 0 ? 'fadeIn 0.3s ease-out' : undefined,
              }}
            >
              <span className="log-timestamp">{formatTime(receipt.timestamp)}</span>
              <span className="log-detail">
                <span style={{ color: '#444' }}>hash:</span>
                <span style={{ color: '#666' }}>{truncateHash(receipt.hash)}</span>
              </span>
              <span className="log-detail">
                <span style={{ color: '#444' }}>node:</span>
                <span style={{ color: '#0ff' }}>{receipt.nodeFingerprint.slice(0, 12)}</span>
              </span>
              <span className="log-detail">
                <span style={{ color: '#444' }}>tok:</span>
                <span style={{ color: '#0f0' }}>{receipt.tokensProcessed}</span>
              </span>
              <span className="log-detail">
                <span style={{ color: '#444' }}>lat:</span>
                <span style={{ color: '#fb0' }}>{receipt.latency}ms</span>
              </span>
              <span className="log-detail">
                {receipt.verified ? (
                  <span style={{ color: '#0f0' }}>✓ verified</span>
                ) : (
                  <span style={{ color: '#f33' }}>pending</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
