import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Terminal, Activity, Server, Zap, HelpCircle } from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ElementType;
  action: () => void;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const commands: CommandItem[] = [
    {
      id: 'status',
      label: 'View Network Status',
      shortcut: 'G S',
      icon: Activity,
      action: () => navigate('/gateway/overview'),
    },
    {
      id: 'chat',
      label: 'Open Chat',
      shortcut: 'G C',
      icon: Terminal,
      action: () => navigate('/gateway/chat'),
    },
    {
      id: 'nodes',
      label: 'View Nodes',
      shortcut: 'G N',
      icon: Server,
      action: () => navigate('/gateway/nodes'),
    },
    {
      id: 'mine',
      label: 'Start Mining',
      shortcut: 'G M',
      icon: Zap,
      action: () => navigate('/gateway/overview'),
    },
    {
      id: 'help',
      label: 'Documentation',
      shortcut: '?',
      icon: HelpCircle,
      action: () => navigate('/docs'),
    },
  ];

  const filteredCommands = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(search.toLowerCase()) ||
    cmd.id.includes(search.toLowerCase())
  );

  const handleSelect = useCallback((command: CommandItem) => {
    command.action();
    setIsOpen(false);
    setSearch('');
  }, [navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      // Escape to close
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
      // '>' key to open
      if (e.key === '>' && !isOpen && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 z-[200] flex items-start justify-center pt-[20vh]"
      onClick={() => setIsOpen(false)}
    >
      <div 
        className="w-full max-w-lg bg-[#111] border border-[#222] rounded-xl overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={{
          animation: 'slideDown 0.15s ease-out',
        }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-[#222]">
          <Search size={18} className="text-[#555]" />
          <input
            type="text"
            placeholder="Type a command or search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-[#e0e0e0] placeholder:text-[#444]"
            autoFocus
          />
          <kbd className="px-2 py-1 bg-[#1a1a1a] border border-[#333] rounded text-xs text-[#666]">
            ESC
          </kbd>
        </div>

        {/* Commands list */}
        <div className="max-h-[300px] overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-[#555] text-sm">
              No commands found
            </div>
          ) : (
            filteredCommands.map((command, index) => (
              <button
                key={command.id}
                onClick={() => handleSelect(command)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1a1a1a] transition-colors text-left group"
                style={{
                  animation: `fadeIn 0.1s ease-out ${index * 0.02}s both`,
                }}
              >
                <command.icon size={16} className="text-[#555] group-hover:text-[#00ff88]" />
                <span className="flex-1 text-sm text-[#888] group-hover:text-[#e0e0e0]">
                  {command.label}
                </span>
                {command.shortcut && (
                  <kbd className="px-2 py-0.5 bg-[#1a1a1a] border border-[#333] rounded text-xs text-[#666]">
                    {command.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#222] flex items-center justify-between text-xs text-[#444]">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] border border-[#333] rounded">↑↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] border border-[#333] rounded">↵</kbd>
              to select
            </span>
          </div>
          <span>Synapse Command Palette</span>
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
