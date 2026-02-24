import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import type { ChatMessage, CompletionResponse } from '../types';

interface ChatProps {
  apiKey: string;
  apiUrl: string;
}

export function Chat({ apiKey, apiUrl }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'system-1',
      role: 'system',
      content: 'Connected to Synapse mesh. Type to initiate inference.',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

    const assistantId = `assistant-${Date.now()}`;
    
    // Add placeholder message that will stream
    const placeholderMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      metadata: {
        model: 'deepseek-v3',
        nodeId: 'a7f3e9d2',
        isFallback: false,
        receiptVerified: 'pending',
      },
    };
    
    setMessages(prev => [...prev, placeholderMessage]);
    setStreamingId(assistantId);

    const startTime = Date.now();

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
        }),
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: CompletionResponse = await response.json();
      
      const content = data.choices[0]?.message?.content || 'No response';
      
      // Simulate token streaming
      const tokens = content.split(' ');
      let currentContent = '';
      
      for (let i = 0; i < tokens.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 30));
        currentContent += (i > 0 ? ' ' : '') + tokens[i];
        
        setMessages(prev => prev.map(msg => 
          msg.id === assistantId 
            ? { 
                ...msg, 
                content: currentContent,
                metadata: {
                  model: data.synapse_meta?.model_served || data.model,
                  nodeId: data.synapse_meta?.node_id || 'a7f3e9d2',
                  latency,
                  receiptId: `rcpt_${Math.random().toString(36).slice(2, 10)}`,
                  verified: data.synapse_meta?.receipt_verified === 'valid',
                }
              }
            : msg
        ));
      }
      
    } catch (err) {
      setMessages(prev => prev.map(msg => 
        msg.id === assistantId 
          ? { ...msg, content: `Error: ${err instanceof Error ? err.message : 'Failed'}` }
          : msg
      ));
    } finally {
      setLoading(false);
      setStreamingId(null);
    }
  };

  const isStreaming = (msgId: string) => streamingId === msgId;

  return (
    <div className="terminal-window" style={{ height: '100%' }}>
      <div className="terminal-header">
        <div className="terminal-dots">
          <div className="terminal-dot red" />
          <div className="terminal-dot yellow" />
          <div className="terminal-dot green" />
        </div>
        <span>inference.stream</span>
      </div>
      
      <div className="terminal-body" style={{ flex: 1, overflowY: 'auto' }}>
        {messages.map((message) => (
          <div key={message.id} className="message">
            <div className="message-header">
              <span className="message-role">
                {message.role === 'assistant' ? '>' : '$'} {message.role}
              </span>
              
              {message.metadata && (
                <div className="message-badges">
                  {message.metadata.model && (
                    <span className="badge badge-model">
                      {message.metadata.model}
                    </span>
                  )}
                  {message.metadata.nodeId && (
                    <span className="badge badge-node">
                      {message.metadata.nodeId.slice(0, 8)}
                    </span>
                  )}
                  {message.metadata.latency && message.metadata.latency > 0 && (
                    <span className="badge badge-latency">
                      {message.metadata.latency}ms
                    </span>
                  )}
                  {message.metadata.receiptId && (
                    <span className="badge badge-receipt">
                      {message.metadata.receiptId}
                    </span>
                  )}
                  {message.metadata.verified && (
                    <span className="badge badge-verified">
                      ✓ verified
                    </span>
                  )}
                </div>
              )}
            </div>
            
            <div className={`message-content ${isStreaming(message.id) ? 'streaming' : ''}`}>
              {message.content}
            </div>
          </div>
        ))}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="terminal-input-wrapper">
        <span style={{ color: '#333' }}>$</span>
        <input
          type="text"
          className="terminal-input"
          placeholder="Enter prompt..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          disabled={loading}
        />
        <button
          className="terminal-submit"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}
