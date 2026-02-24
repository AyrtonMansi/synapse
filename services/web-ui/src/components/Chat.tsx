import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, AlertTriangle } from 'lucide-react';
import type { ChatMessage, CompletionResponse } from '../types';

interface ChatProps {
  apiKey: string;
  apiUrl: string;
  onApiCall?: () => void;
}

export function Chat({ apiKey, apiUrl, onApiCall }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'system-1',
      role: 'system',
      content: 'Connected to Synapse Network. Type a message to start inference.',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setStreamingContent('');

    try {
      const response = await fetch(`${apiUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-v3',
          messages: [{ role: 'user', content: input }],
          max_tokens: 500,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: CompletionResponse = await response.json();
      
      // Track achievement
      onApiCall?.();
      
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.choices[0]?.message?.content || 'No response',
        timestamp: new Date(),
        metadata: {
          model: data.synapse_meta?.model_served || data.model,
          nodeId: data.synapse_meta?.node_id,
          isFallback: data.synapse_meta?.fallback,
          receiptVerified: data.synapse_meta?.receipt_verified,
        },
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: `Error: ${err instanceof Error ? err.message : 'Request failed'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setStreamingContent('');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'assistant': return <Bot size={14} />;
      case 'user': return <User size={14} />;
      default: return <span style={{ fontSize: '10px' }}>$</span>;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'assistant': return 'var(--accent-primary)';
      case 'user': return 'var(--info)';
      default: return 'var(--text-muted)';
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      maxHeight: 'calc(100vh - 140px)'
    }}>
      {/* Messages */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        marginBottom: '16px',
        background: 'var(--bg-secondary)'
      }}>
        {messages.map((message) => (
          <div 
            key={message.id}
            className={`chat-message ${message.role}`}
            style={message.role === 'system' ? { background: 'var(--bg-tertiary)' } : {}}
          >
            <div className="chat-header">
              <span style={{ color: getRoleColor(message.role) }}>
                {getRoleIcon(message.role)}
              </span>
              <span className="chat-role" style={{ color: getRoleColor(message.role) }}>
                {message.role}
              </span>
              {message.metadata?.isFallback && (
                <span className="badge badge-warning">
                  <AlertTriangle size={10} style={{ marginRight: '4px' }} />
                  Fallback
                </span>
              )}
            </div>
            
            <div className="chat-content">
              {message.content}
            </div>
            
            {message.metadata && (
              <div className="chat-meta">
                {message.metadata.model && (
                  <span className="badge badge-secondary">
                    {message.metadata.model}
                  </span>
                )}
                {message.metadata.nodeId && (
                  <span className="badge badge-secondary">
                    node: {message.metadata.nodeId.slice(0, 8)}...
                  </span>
                )}
                {message.metadata.receiptVerified === 'valid' && (
                  <span className="badge badge-primary">verified</span>
                )}
              </div>
            )}
          </div>
        ))}
        
        {streamingContent && (
          <div className="chat-message assistant">
            <div className="chat-header">
              <span style={{ color: 'var(--accent-primary)' }}>
                <Bot size={14} />
              </span>
              <span className="chat-role" style={{ color: 'var(--accent-primary)' }}>
                assistant
              </span>
            </div>
            <div className="chat-content">
              {streamingContent}
              <span className="cursor-blink" />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          className="input-terminal"
          placeholder="Enter message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          disabled={loading}
          style={{ flex: 1 }}
        />
        <button
          className="btn btn-primary"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
