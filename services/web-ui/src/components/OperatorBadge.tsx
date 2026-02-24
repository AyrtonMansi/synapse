import { Shield, Fingerprint, Calendar } from 'lucide-react';

interface OperatorBadgeProps {
  wallet: string;
  operatorNumber?: number;
  clearanceLevel?: 'ALPHA' | 'BETA' | 'GAMMA';
  joinedAt?: Date;
}

export function OperatorBadge({ 
  wallet, 
  operatorNumber = 47,
  clearanceLevel = 'ALPHA',
  joinedAt = new Date(),
}: OperatorBadgeProps) {
  // Generate fingerprint from wallet
  const fingerprint = wallet.length > 10 
    ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
    : wallet;
  
  // Hash-like visualization
  const hashVisual = Array.from({ length: 16 }, () => 
    Math.random() > 0.5 ? '█' : '░'
  ).join('');

  return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-[#00ff88]" />
          <span className="text-xs text-[#666] uppercase tracking-wider">Operator ID</span>
        </div>
        <span className="text-xs text-[#00ff88] font-mono">#{operatorNumber.toString().padStart(3, '0')}</span>
      </div>

      {/* Fingerprint */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Fingerprint size={12} className="text-[#444]" />
          <span className="text-[10px] text-[#444] uppercase tracking-wider">Identity Hash</span>
        </div>
        <code className="block font-mono text-xs text-[#888] bg-[#0a0a0a] px-3 py-2 rounded border border-[#222]">
          {fingerprint}
        </code>
        <div className="mt-2 font-mono text-[8px] text-[#333] tracking-widest">
          {hashVisual}
        </div>
      </div>

      {/* Clearance Level */}
      <div className="flex items-center justify-between py-3 border-t border-b border-[#1a1a1a]">
        <span className="text-xs text-[#555]">Clearance Level</span>
        <span 
          className="text-xs font-bold px-2 py-1 rounded"
          style={{
            background: clearanceLevel === 'ALPHA' ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 170, 0, 0.1)',
            color: clearanceLevel === 'ALPHA' ? '#00ff88' : '#ffaa00',
            border: `1px solid ${clearanceLevel === 'ALPHA' ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 170, 0, 0.3)'}`,
          }}
        >
          {clearanceLevel}
        </span>
      </div>

      {/* Joined Date */}
      <div className="flex items-center gap-2 mt-3 text-[10px] text-[#444]">
        <Calendar size={10} />
        <span>Joined {joinedAt.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        })}</span>
      </div>

      {/* Status indicator */}
      <div className="mt-4 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" 
          style={{ boxShadow: '0 0 8px #00ff88' }}
        />
        <span className="text-[10px] text-[#00ff88]">Active on Mesh</span>
      </div>
    </div>
  );
}
