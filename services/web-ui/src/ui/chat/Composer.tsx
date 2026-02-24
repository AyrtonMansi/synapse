import { Send } from 'lucide-react';
import { useRef, useEffect } from 'react';

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading?: boolean;
  isDisabled?: boolean;
}

export function Composer({ 
  value, 
  onChange, 
  onSend, 
  isLoading,
  isDisabled 
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="border-t border-charcoal-800 bg-charcoal-950 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="relative flex items-end gap-2 bg-charcoal-900 border border-charcoal-700 rounded-2xl p-3 focus-within:border-charcoal-600 focus-within:ring-1 focus-within:ring-charcoal-600">
          {/* Model selector - placeholder */}
          <div className="flex-shrink-0 self-center">
            <button className="flex items-center gap-1 px-2 py-1 text-xs text-charcoal-400 hover:text-charcoal-200 bg-charcoal-800 hover:bg-charcoal-700 rounded-lg transition-colors">
              GPT-4
            </button>
          </div>
          
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isDisabled ? 'Network offline' : 'Message Synapse...'}
            disabled={isDisabled}
            rows={1}
            className="flex-1 bg-transparent text-charcoal-100 placeholder-charcoal-500 resize-none outline-none min-h-[24px] max-h-[200px] py-1"
          />
          
          {/* Send button */}
          <button
            onClick={onSend}
            disabled={!value.trim() || isLoading || isDisabled}
            className="flex-shrink-0 p-2 bg-synapse-600 hover:bg-synapse-500 disabled:bg-charcoal-800 disabled:text-charcoal-600 text-white rounded-xl transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
        
        <p className="text-center text-xs text-charcoal-500 mt-2">
          Synapse can make mistakes. Consider verifying important information.
        </p>
      </div>
    </div>
  );
}
