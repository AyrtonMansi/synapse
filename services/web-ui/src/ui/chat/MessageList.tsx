import { User, Bot } from 'lucide-react';
import type { Message } from './types';

interface MessageListProps {
  messages: Message[];
  onSelect: (msg: Message) => void;
  selectedId?: string;
}

export function MessageList({ messages, onSelect, selectedId }: MessageListProps) {
  return (
    <div className="py-6 space-y-6">
      {messages.map((msg) => (
        <MessageItem 
          key={msg.id} 
          message={msg} 
          onSelect={() => onSelect(msg)}
          isSelected={msg.id === selectedId}
        />
      ))}
    </div>
  );
}

function MessageItem({ 
  message, 
  onSelect, 
  isSelected 
}: { 
  message: Message; 
  onSelect: () => void;
  isSelected?: boolean;
}) {
  const isUser = message.role === 'user';
  const isError = message.state === 'error';
  
  return (
    <div 
      className={`group px-4 py-6 ${isUser ? 'bg-charcoal-950' : 'bg-charcoal-900'} ${isSelected ? 'ring-1 ring-synapse-600/50' : ''}`}
      onClick={!isUser ? onSelect : undefined}
      style={{ cursor: !isUser ? 'pointer' : 'default' }}
    >
      <div className="max-w-3xl mx-auto flex gap-4">
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-synapse-600' : isError ? 'bg-red-600' : 'bg-charcoal-700'
        }`}>
          {isUser ? (
            <User size={18} className="text-white" />
          ) : (
            <Bot size={18} className="text-charcoal-200" />
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-charcoal-200">
              {isUser ? 'You' : 'Synapse'}
            </span>
            
            {/* State indicator for assistant messages */}
            {!isUser && message.state !== 'completed' && message.state !== 'error' && (
              <StateIndicator state={message.state} />
            )}
            
            {isError && (
              <span className="text-xs text-red-400 bg-red-950/50 px-2 py-0.5 rounded">
                Error
              </span>
            )}
          </div>
          
          <div className={`text-charcoal-100 whitespace-pre-wrap leading-relaxed ${
            message.state === 'streaming' ? 'streaming-cursor' : ''
          }`}>
            {message.content || (message.state === 'queued' && 'Waiting...')}
          </div>
          
          {/* Error details link */}
          {isError && message.metadata?.error && (
            <button 
              onClick={(e) => { e.stopPropagation(); onSelect(); }}
              className="mt-2 text-xs text-charcoal-400 hover:text-synapse-400"
            >
              View details →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StateIndicator({ state }: { state: string }) {
  const labels: Record<string, string> = {
    queued: 'Queued',
    routing: 'Finding node',
    executing: 'Generating',
    streaming: 'Streaming',
  };
  
  return (
    <span className="text-xs text-charcoal-500 flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-synapse-500 animate-pulse" />
      {labels[state] || state}
    </span>
  );
}
