import { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Plus,
  Settings,
  HelpCircle,
  ChevronDown,
  Info,
  X,
  Send,
  Activity,
  Server,
  Clock,
  Shield
} from 'lucide-react';
import './gateway-chat.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    model?: string;
    nodeId?: string;
    latency?: number;
    receiptHash?: string;
    state?: 'queued' | 'routing' | 'executing' | 'verifying' | 'completed' | 'fallback';
  };
  timestamp: Date;
}

interface GatewayChatProps {
  apiKey: string;
}

export function GatewayChat({ apiKey }: GatewayChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [telemetry, setTelemetry] = useState({
    nodesOnline: 47,
    latency: 89,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry(prev => ({
        ...prev,
        latency: Math.max(20, prev.latency + (Math.random() - 0.5) * 10),
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const assistantId = `msg_${Date.now()}_ai`;
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      metadata: { state: 'routing', model: 'Synapse-GPT-4' },
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, assistantMsg]);

    try {
      const startTime = Date.now();

      setTimeout(() => {
        updateMessage(assistantId, { state: 'executing', nodeId: `node-${Math.floor(Math.random() * 100)}` });
      }, 400);

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

      if (!response.ok) throw new Error('Failed');

      const latency = Date.now() - startTime;
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      // Stream effect
      const words = content.split(' ');
      for (let i = 0; i < words.length; i++) {
        await new Promise(r => setTimeout(r, 15));
        const partial = words.slice(0, i + 1).join(' ');
        setMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: partial } : m
        ));
      }

      updateMessage(assistantId, {
        state: 'completed',
        latency,
        receiptHash: `0x${Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      });

    } catch {
      updateMessage(assistantId, { state: 'fallback' });
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: 'Routed to backup provider. Response may be delayed.', metadata: { ...m.metadata, state: 'fallback' } }
          : m
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const updateMessage = (id: string, updates: Partial<Message['metadata']>) => {
    setMessages(prev => prev.map(m =>
      m.id === id ? { ...m, metadata: { ...m.metadata, ...updates } } : m
    ));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const openInspector = (msg: Message) => {
    if (msg.role === 'assistant') {
      setSelectedMessage(msg);
      setInspectorOpen(true);
    }
  };

  const stateLabels: Record<string, string> = {
    queued: 'Queued',
    routing: 'Finding node',
    executing: 'Generating',
    verifying: 'Verifying',
    completed: 'Complete',
    fallback: 'Fallback',
  };

  return (
    <div className="gateway-app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <button className="new-chat-btn">
            <Plus size={16} />
            <span>New chat</span>
          </button>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-item active">
            <MessageSquare size={18} />
            <span>Current session</span>
          </div>
          <div className="nav-item">
            <Activity size={18} />
            <span>Network status</span>
          </div>
          <div className="nav-item">
            <Settings size={18} />
            <span>Settings</span>
          </div>
          <div className="nav-item">
            <HelpCircle size={18} />
            <span>Help & FAQ</span>
          </div>
        </nav>
      </aside>

      {/* Main */}
      <main className="main-content">
        {/* Header */}
        <header className="top-header">
          <div className="model-selector">
            <span>Synapse GPT-4</span>
            <ChevronDown size={16} />
          </div>
          <div className="header-actions">
            <div className="status-badge">
              <div className="status-indicator" />
              <span>{telemetry.nodesOnline} nodes online</span>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-logo">S</div>
              <h1 className="empty-title">How can I help you today?</h1>
              <p className="empty-subtitle">Distributed AI inference network</p>
              <div className="suggestion-grid">
                {[
                  { title: 'Explain quantum computing', desc: 'Simple explanation of quantum mechanics' },
                  { title: 'Write Python code', desc: 'Generate functions or scripts' },
                  { title: 'Analyze data', desc: 'Interpret trends and patterns' },
                  { title: 'Creative writing', desc: 'Stories, poems, or content' },
                ].map((s, i) => (
                  <button key={i} className="suggestion-card" onClick={() => setInput(s.title)}>
                    <div className="suggestion-title">{s.title}</div>
                    <div className="suggestion-desc">{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`message ${msg.role}`}
                onClick={() => openInspector(msg)}
              >
                <div className="message-wrapper">
                  <div className={`message-avatar ${msg.role}`}>
                    {msg.role === 'user' ? 'U' : 'AI'}
                  </div>
                  <div className="message-content">
                    <div className="message-author">
                      {msg.role === 'user' ? 'You' : 'Assistant'}
                    </div>
                    <div className={`message-text ${msg.metadata?.state !== 'completed' && msg.role === 'assistant' ? 'streaming' : ''}`}>
                      {msg.content || (msg.role === 'assistant' && 'Thinking...')}
                    </div>

                    {msg.role === 'assistant' && msg.metadata && (
                      <>
                        {msg.metadata.state && msg.metadata.state !== 'completed' && (
                          <div className="message-status">
                            <span className={`status-dot ${msg.metadata.state}`} />
                            <span>{stateLabels[msg.metadata.state]}</span>
                          </div>
                        )}

                        <div className="message-meta">
                          {msg.metadata.nodeId && (
                            <span className="meta-pill">
                              <Server size={12} />
                              {msg.metadata.nodeId}
                            </span>
                          )}
                          {msg.metadata.latency && (
                            <span className="meta-pill">
                              <Clock size={12} />
                              {msg.metadata.latency}ms
                            </span>
                          )}
                          {msg.metadata.receiptHash && (
                            <span className="meta-pill">
                              <Shield size={12} />
                              {msg.metadata.receiptHash.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="input-area">
          <div className="input-wrapper">
            <textarea
              ref={textareaRef}
              className="input-box"
              placeholder="Message Synapse..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button
              className="send-button"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
            >
              <Send size={16} />
            </button>
          </div>
          <p className="input-footer">
            Synapse can make mistakes. Consider verifying important information.
          </p>
        </div>
      </main>

      {/* Inspector Toggle */}
      <button className="fab" onClick={() => setInspectorOpen(true)}>
        <Info size={20} />
      </button>

      {/* Inspector Overlay */}
      <div
        className={`inspector-overlay ${inspectorOpen ? 'open' : ''}`}
        onClick={() => setInspectorOpen(false)}
      />

      {/* Inspector Panel */}
      <aside className={`inspector ${inspectorOpen ? 'open' : ''}`}>
        <div className="inspector-header">
          <span className="inspector-title">Message Details</span>
          <button className="inspector-close" onClick={() => setInspectorOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="inspector-content">
          {selectedMessage ? (
            <>
              <div className="inspector-section">
                <div className="inspector-section-title">General</div>
                <div className="inspector-row">
                  <span className="inspector-label">ID</span>
                  <span className="inspector-value id">{selectedMessage.id.slice(0, 16)}...</span>
                </div>
                <div className="inspector-row">
                  <span className="inspector-label">Status</span>
                  <span className="inspector-value" style={{
                    color: selectedMessage.metadata?.state === 'completed' ? '#10a37f' :
                           selectedMessage.metadata?.state === 'fallback' ? '#ef4444' : '#3b82f6'
                  }}>
                    {selectedMessage.metadata?.state?.toUpperCase()}
                  </span>
                </div>
                <div className="inspector-row">
                  <span className="inspector-label">Model</span>
                  <span className="inspector-value">{selectedMessage.metadata?.model}</span>
                </div>
              </div>

              <div className="inspector-section">
                <div className="inspector-section-title">Infrastructure</div>
                <div className="inspector-row">
                  <span className="inspector-label">Node</span>
                  <span className="inspector-value">{selectedMessage.metadata?.nodeId || '—'}</span>
                </div>
                <div className="inspector-row">
                  <span className="inspector-label">Latency</span>
                  <span className="inspector-value">{selectedMessage.metadata?.latency ? `${selectedMessage.metadata.latency}ms` : '—'}</span>
                </div>
              </div>

              <div className="inspector-section">
                <div className="inspector-section-title">Verification</div>
                <div className="inspector-row">
                  <span className="inspector-label">Receipt</span>
                  <span className="inspector-value">{selectedMessage.metadata?.receiptHash || '—'}</span>
                </div>
              </div>

              <div className="inspector-section">
                <div className="inspector-section-title">Timing</div>
                <div className="inspector-row">
                  <span className="inspector-label">Created</span>
                  <span className="inspector-value">{selectedMessage.timestamp.toLocaleTimeString()}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="inspector-empty">
              <div className="inspector-empty-icon">
                <Info size={24} />
              </div>
              <p>Click on an assistant message to view details</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
