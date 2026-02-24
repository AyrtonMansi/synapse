import { useState, useEffect } from 'react';
import { Terminal } from 'lucide-react';

interface BootSequenceProps {
  onComplete: () => void;
}

const bootLogs = [
  { text: 'Initializing Synapse Protocol v2.1.0...', delay: 100 },
  { text: 'Loading cryptographic modules...', delay: 200 },
  { text: 'Connecting to decentralized mesh network...', delay: 400 },
  { text: 'Handshake with bootstrap nodes...', delay: 300 },
  { text: 'Discovered 47 active nodes', delay: 200 },
  { text: 'Verifying network consensus...', delay: 400 },
  { text: 'Consensus achieved ✓', delay: 200 },
  { text: 'Loading operator interface...', delay: 300 },
  { text: 'ACCESS GRANTED', delay: 500, highlight: true },
];

export function BootSequence({ onComplete }: BootSequenceProps) {
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [showCursor, setShowCursor] = useState(true);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    // Check if already booted
    const hasBooted = localStorage.getItem('synapse_booted');
    if (hasBooted) {
      onComplete();
      return;
    }

    let currentLine = 0;
    
    const showNextLine = () => {
      if (currentLine < bootLogs.length) {
        setVisibleLines(currentLine + 1);
        const delay = bootLogs[currentLine].delay;
        currentLine++;
        setTimeout(showNextLine, delay);
      } else {
        setCompleted(true);
        localStorage.setItem('synapse_booted', 'true');
        setTimeout(onComplete, 1000);
      }
    };

    // Start sequence
    setTimeout(showNextLine, 500);

    // Blinking cursor
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);

    return () => clearInterval(cursorInterval);
  }, [onComplete]);

  return (
    <div 
      className="fixed inset-0 bg-[#0a0a0a] z-[100] flex items-center justify-center p-8"
      style={{
        animation: completed ? 'fadeOut 0.5s ease-out 0.5s forwards' : undefined,
      }}
    >
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Terminal size={24} className="text-[#00ff88]" />
          <span className="text-lg font-semibold tracking-wider">SYNAPSE</span>
        </div>

        {/* Terminal */}
        <div className="font-mono text-sm space-y-1">
          {bootLogs.slice(0, visibleLines).map((log, index) => (
            <div 
              key={index}
              className="flex items-center gap-2"
              style={{
                animation: 'fadeIn 0.2s ease-out',
              }}
            >
              <span className="text-[#00ff88]">{'>'}</span>
              <span 
                className={log.highlight ? 'text-[#00ff88] font-bold glow-text' : 'text-[#888]'}
                style={log.highlight ? {
                  textShadow: '0 0 20px rgba(0,255,136,0.5)',
                  animation: 'pulse 1s ease-in-out 3',
                } : undefined}
              >
                {log.text}
              </span>
              {index === visibleLines - 1 && !completed && (
                <span 
                  className="text-[#00ff88]"
                  style={{ opacity: showCursor ? 1 : 0 }}
                >
                  ▋
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-8">
          <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#00ff88] transition-all duration-300"
              style={{ 
                width: `${(visibleLines / bootLogs.length) * 100}%`,
                boxShadow: '0 0 10px rgba(0,255,136,0.5)',
              }}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeOut {
          to { opacity: 0; visibility: hidden; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
