import { useState, useEffect, useRef } from 'react';
import { Terminal, Maximize2, Minimize2 } from 'lucide-react';

interface ActivityLog {
  id: number;
  timestamp: Date;
  type: 'job' | 'node' | 'settlement';
  message: string;
}

const generateMockActivity = (id: number): ActivityLog => {
  const types: ActivityLog['type'][] = ['job', 'node', 'settlement'];
  const type = types[Math.floor(Math.random() * types.length)];
  
  const models = ['deepseek-v3', 'claude-opus', 'gpt-4', 'llama-3-70b'];
  const nodes = ['a7f3', 'b2e1', 'c8d9', 'e4f2', 'g1h5'];
  
  let message = '';
  switch (type) {
    case 'job':
      message = `Job #${8900 + id} → ${models[Math.floor(Math.random() * models.length)]} → node_${nodes[Math.floor(Math.random() * nodes.length)]}... [${Math.floor(Math.random() * 100 + 20)}ms]`;
      break;
    case 'node':
      message = `Node joined: 0x${Math.random().toString(16).slice(2, 6)}... (RTX ${['4090', '3090', 'A100'][Math.floor(Math.random() * 3)]})`;
      break;
    case 'settlement':
      message = `Settlement batch #${400 + id} confirmed (${Math.floor(Math.random() * 50 + 10)} HSK distributed)`;
      break;
  }
  
  return {
    id,
    timestamp: new Date(),
    type,
    message,
  };
};

export function LiveActivityFeed() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(1);

  useEffect(() => {
    // Generate initial logs
    const initialLogs = Array.from({ length: 5 }, (_, i) => 
      generateMockActivity(i)
    );
    setLogs(initialLogs);
    logIdRef.current = 5;

    // Add new log every 3-8 seconds
    const addLog = () => {
      setLogs(prev => {
        const newLog = generateMockActivity(logIdRef.current++);
        const newLogs = [...prev, newLog].slice(-20); // Keep last 20
        return newLogs;
      });
      
      // Random next log time
      const nextDelay = Math.random() * 5000 + 3000;
      setTimeout(addLog, nextDelay);
    };

    const timer = setTimeout(addLog, 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-6 left-[220px] z-50 flex items-center gap-2 px-3 py-2 bg-[#111] border border-[#222] rounded-lg text-xs text-[#555] hover:text-[#888] hover:border-[#333] transition-all"
      >
        <Terminal size={12} />
        Show Activity
      </button>
    );
  }

  return (
    <div 
      className={`fixed left-[220px] bottom-6 z-50 bg-[#0a0a0a] border border-[#222] rounded-lg overflow-hidden transition-all duration-300 ${
        isExpanded ? 'w-[500px] h-[300px]' : 'w-[350px] h-[180px]'
      }`}
      style={{
        boxShadow: '0 0 30px rgba(0,0,0,0.5)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a1a1a] bg-[#111]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
          <span className="text-xs text-[#666] font-mono">Network Activity</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-[#1a1a1a] rounded text-[#444] hover:text-[#888]"
          >
            {isExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-[#1a1a1a] rounded text-[#444] hover:text-[#888]"
          >
            ×
          </button>
        </div>
      </div>

      {/* Log content */}
      <div 
        ref={scrollRef}
        className="p-3 font-mono text-xs space-y-1 overflow-y-auto"
        style={{ height: isExpanded ? 'calc(100% - 36px)' : 'calc(100% - 36px)' }}
      >
        {logs.map((log, index) => (
          <div 
            key={log.id}
            className="flex items-start gap-2 opacity-80 hover:opacity-100 transition-opacity"
            style={{
              animation: index === logs.length - 1 ? 'fadeIn 0.3s ease-out' : undefined,
            }}
          >
            <span className="text-[#333] shrink-0">
              {log.timestamp.toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
            <span className="text-[#444]">{'>'}</span>
            <span 
              className={`${
                log.type === 'job' ? 'text-[#888]' :
                log.type === 'node' ? 'text-[#00ff88]' :
                'text-[#ffaa00]'
              }`}
            >
              {log.message}
            </span>
          </div>
        ))}
        
        {/* Typing indicator */}
        <div className="flex items-center gap-2 text-[#333]">
          <span>{'>'}</span>
          <span className="animate-pulse">_</span>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 0.8; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
