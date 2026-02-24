import { useRef, useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { LifecycleBadge } from './LifecycleBadge';
import { SystemEventMessage } from './SystemEvent';
import type { Job, SystemEvent } from './useJobLifecycle';

interface JobStreamProps {
  jobs: Job[];
  systemEvents: SystemEvent[];
  selectedJobId: string | null;
  onSelectJob: (jobId: string | null) => void;
  onSendMessage: (content: string) => void;
}

export function JobStream({ 
  jobs, 
  systemEvents, 
  selectedJobId, 
  onSelectJob,
  onSendMessage 
}: JobStreamProps) {
  const [input, setInput] = useState('');
  const streamEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [jobs, systemEvents]);

  const handleSubmit = () => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };

  // Merge jobs and system events chronologically
  const streamItems = [...jobs, ...systemEvents]
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return (
    <>
      <div className="job-stream">
        {streamItems.map((item) => {
          if ('role' in item) {
            // It's a job
            const job = item as Job;
            const isSelected = selectedJobId === job.id;
            
            return (
              <div
                key={job.id}
                className={`job-message ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectJob(isSelected ? null : job.id)}
              >
                <div className="job-message-header">
                  <span className="job-role">
                    {job.role === 'user' ? '>' : job.role === 'assistant' ? '<' : '$'} {job.role}
                  </span>
                  
                  {job.role === 'assistant' && (
                    <div className="job-lifecycle">
                      <LifecycleBadge state={job.state} />
                    </div>
                  )}
                </div>
                
                <div className={`job-content ${job.isStreaming ? 'streaming' : ''}`}>
                  {job.content}
                </div>
                
                {job.metadata && job.role === 'assistant' && (
                  <div className="job-meta-bar">
                    {job.metadata.nodeId && (
                      <div className="job-meta-item">
                        <span className="job-meta-label">node:</span>
                        <span className="job-meta-value">{job.metadata.nodeId.slice(0, 8)}</span>
                      </div>
                    )}
                    {job.metadata.provider && (
                      <div className="job-meta-item">
                        <span className="job-meta-label">provider:</span>
                        <span className="job-meta-value">{job.metadata.provider}</span>
                      </div>
                    )}
                    {job.metadata.latency && (
                      <div className="job-meta-item">
                        <span className="job-meta-label">latency:</span>
                        <span className="job-meta-value">{job.metadata.latency}ms</span>
                      </div>
                    )}
                    {job.metadata.retryAttempts > 0 && (
                      <div className="job-meta-item">
                        <span className="job-meta-label">retries:</span>
                        <span className="job-meta-value" style={{ color: '#f90' }}>
                          {job.metadata.retryAttempts}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          } else {
            // It's a system event
            return <SystemEventMessage key={item.id} event={item as SystemEvent} />;
          }
        })}
        <div ref={streamEndRef} />
      </div>

      <div className="job-input-container">
        <div className="job-input-wrapper">
          <span style={{ color: '#333' }}>$</span>
          <input
            type="text"
            className="job-input"
            placeholder="Enter prompt to initiate inference job..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
          />
          <button
            className="job-submit"
            onClick={handleSubmit}
            disabled={!input.trim()}
          >
            <Send size={12} />
          </button>
        </div>
      </div>
    </>
  );
}
