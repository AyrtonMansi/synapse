import { useState, useRef, useEffect } from 'react';
import { Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { MessageList } from './MessageList';
import { Composer } from './Composer';
import { AdvancedDrawer } from '../drawer/AdvancedDrawer';
import type { Message, MessageState } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ChatViewProps {
  apiKey: string;
  privacy?: any;
}

export function ChatView({ apiKey, privacy: _privacy }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'lifecycle' | 'routing' | 'logs' | 'replay'>('lifecycle');
  const [isOffline, setIsOffline] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check network status
  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const res = await fetch(`${API_URL}/health`, { method: 'HEAD' });
        setIsOffline(!res.ok);
      } catch {
        setIsOffline(true);
      }
    };
    checkNetwork();
    const interval = setInterval(checkNetwork, 30000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || isLoading || isOffline) return;

    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
      state: 'completed',
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const assistantId = `msg_${Date.now()}_ai`;
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      state: 'queued',
      metadata: {
        model: 'deepseek-v3',
      },
    };

    setMessages(prev => [...prev, assistantMsg]);

    try {
      // Simulate lifecycle states
      await simulateLifecycle(assistantId);
      
      const response = await fetch(`${API_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-v3',
          messages: [{ role: 'user', content: input }],
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      // Stream content
      await streamContent(assistantId, content);

      // Complete
      updateMessage(assistantId, {
        state: 'completed',
        content,
        metadata: {
          ...assistantMsg.metadata,
          latency: Date.now() - assistantMsg.timestamp.getTime(),
          nodeId: `node-${Math.floor(Math.random() * 1000)}`,
          receiptHash: `0x${Array.from({length: 16}, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
        },
      });

    } catch (error: any) {
      const errorMsg = error.message || 'Request failed';
      updateMessage(assistantId, {
        state: 'error',
        content: `I encountered an issue processing your request. ${errorMsg}`,
        metadata: {
          ...assistantMsg.metadata,
          error: errorMsg,
          errorCode: error.status || 'UNKNOWN',
        },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const simulateLifecycle = async (msgId: string) => {
    const states: MessageState[] = ['queued', 'routing', 'executing'];
    for (const state of states) {
      await new Promise(r => setTimeout(r, 300));
      updateMessage(msgId, { state });
    }
  };

  const streamContent = async (msgId: string, content: string) => {
    const words = content.split(' ');
    for (let i = 0; i < words.length; i++) {
      await new Promise(r => setTimeout(r, 15));
      const partial = words.slice(0, i + 1).join(' ');
      setMessages(prev => prev.map(m => 
        m.id === msgId ? { ...m, content: partial, state: 'streaming' as MessageState } : m
      ));
    }
  };

  const updateMessage = (id: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(m => 
      m.id === id ? { ...m, ...updates } : m
    ));
  };

  const handleSelectMessage = (msg: Message) => {
    if (msg.role === 'assistant') {
      setSelectedMessage(msg);
      setDrawerOpen(true);
    }
  };

  const handleRetry = async () => {
    if (!selectedMessage) return;
    // Retry logic would go here
    console.log('Retrying message:', selectedMessage.id);
  };

  return (
    <div className="flex h-full relative">
      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${drawerOpen ? 'mr-96' : ''}`}>
        {/* Offline Banner */}
        {isOffline && (
          <div className="bg-red-900/30 border-b border-red-800 px-4 py-2 text-center">
            <span className="text-sm text-red-300">
              Network offline. Messages cannot be sent.
            </span>
          </div>
        )}
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState onSelect={(text) => setInput(text)} />
          ) : (
            <MessageList 
              messages={messages} 
              onSelect={handleSelectMessage}
              selectedId={selectedMessage?.id}
            />
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Composer */}
        <Composer
          value={input}
          onChange={setInput}
          onSend={sendMessage}
          isLoading={isLoading}
          isDisabled={isOffline}
        />
        
        {/* Advanced Toggle */}
        <button
          onClick={() => setDrawerOpen(!drawerOpen)}
          className="absolute top-4 right-4 flex items-center gap-1 px-3 py-1.5 text-xs text-charcoal-400 hover:text-charcoal-200 bg-charcoal-900/80 hover:bg-charcoal-800 rounded-lg border border-charcoal-800 transition-colors"
        >
          {drawerOpen ? (
            <><ChevronRight size={14} /> Hide Advanced</>
          ) : (
            <><ChevronLeft size={14} /> Advanced</>
          )}
        </button>
      </div>
      
      {/* Advanced Drawer */}
      <AdvancedDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        message={selectedMessage}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRetry={handleRetry}
        apiKey={apiKey}
      />
    </div>
  );
}

function EmptyState({ onSelect }: { onSelect: (text: string) => void }) {
  const suggestions = [
    { title: 'Explain quantum computing', desc: 'In simple terms' },
    { title: 'Write a Python function', desc: 'To parse JSON data' },
    { title: 'Help me debug', desc: 'An error in my code' },
    { title: 'Create a workout plan', desc: 'For building muscle' },
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center px-4">
      <div className="w-16 h-16 bg-synapse-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-synapse-600/20">
        <Send size={32} className="text-white" />
      </div>
      
      <h1 className="text-3xl font-semibold text-charcoal-100 mb-2">
        How can I help you today?
      </h1>
      
      <p className="text-charcoal-400 mb-8">
        Powered by distributed GPU network
      </p>
      
      <div className="grid grid-cols-2 gap-3 w-full max-w-2xl">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onSelect(s.title)}
            className="text-left p-4 bg-charcoal-900 hover:bg-charcoal-800 border border-charcoal-800 hover:border-charcoal-700 rounded-xl transition-all group"
          >
            <div className="text-charcoal-200 font-medium group-hover:text-charcoal-100">
              {s.title}
            </div>
            <div className="text-sm text-charcoal-500 group-hover:text-charcoal-400">
              {s.desc}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
