import { ChevronRight, ChevronLeft } from 'lucide-react';
import type { Job } from './useJobLifecycle';

interface InspectorPanelProps {
  job: Job | null;
  collapsed: boolean;
  onToggle: () => void;
}

export function InspectorPanel({ job, collapsed, onToggle }: InspectorPanelProps) {
  if (collapsed) {
    return (
      <div className="inspector-panel collapsed">
        <button className="inspector-toggle" onClick={onToggle}>
          <ChevronLeft size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="inspector-panel">
      <div className="inspector-header">
        <span className="inspector-title">Job Inspector</span>
        <button className="inspector-toggle" onClick={onToggle}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="inspector-content">
        {!job ? (
          <div className="inspector-empty">
            Select a job to view metadata
          </div>
        ) : (
          <>
            <div className="inspector-section">
              <div className="inspector-section-title">Identity</div>
              
              <div className="inspector-field">
                <div className="inspector-field-label">Job ID</div>
                <div className="inspector-field-value id">
                  {job.metadata.jobId || job.id}
                </div>
              </div>

              <div className="inspector-field">
                <div className="inspector-field-label">Role</div>
                <div className="inspector-field-value">
                  {job.role}
                </div>
              </div>

              <div className="inspector-field">
                <div className="inspector-field-label">State</div>
                <div className="inspector-field-value" style={{ 
                  color: job.state === 'completed' ? '#0f0' : 
                         job.state === 'fallback' ? '#f44' : 
                         job.state === 'retry' ? '#f90' : '#0ff'
                }}>
                  {job.state.toUpperCase()}
                </div>
              </div>
            </div>

            <div className="inspector-section">
              <div className="inspector-section-title">Routing</div>
              
              {job.metadata.nodeId && (
                <div className="inspector-field">
                  <div className="inspector-field-label">Node ID</div>
                  <div className="inspector-field-value">
                    {job.metadata.nodeId}
                  </div>
                </div>
              )}

              {job.metadata.provider && (
                <div className="inspector-field">
                  <div className="inspector-field-label">Provider</div>
                  <div className="inspector-field-value">
                    {job.metadata.provider}
                  </div>
                </div>
              )}

              {job.metadata.routingDecision && (
                <div className="inspector-field">
                  <div className="inspector-field-label">Routing Decision</div>
                  <div className="inspector-field-value">
                    {job.metadata.routingDecision}
                  </div>
                </div>
              )}

              {job.metadata.fallbackReason && (
                <div className="inspector-field">
                  <div className="inspector-field-label">Fallback Reason</div>
                  <div className="inspector-field-value" style={{ color: '#f44' }}>
                    {job.metadata.fallbackReason}
                  </div>
                </div>
              )}
            </div>

            <div className="inspector-section">
              <div className="inspector-section-title">Performance</div>
              
              {job.metadata.latency && (
                <div className="inspector-field">
                  <div className="inspector-field-label">Latency</div>
                  <div className="inspector-field-value latency">
                    {job.metadata.latency}ms
                  </div>
                </div>
              )}

              {job.metadata.retryAttempts > 0 && (
                <div className="inspector-field">
                  <div className="inspector-field-label">Retry Attempts</div>
                  <div className="inspector-field-value" style={{ color: '#f90' }}>
                    {job.metadata.retryAttempts}
                  </div>
                </div>
              )}
            </div>

            <div className="inspector-section">
              <div className="inspector-section-title">Verification</div>
              
              {job.metadata.receiptHash && (
                <div className="inspector-field">
                  <div className="inspector-field-label">Receipt Hash</div>
                  <div className="inspector-field-value hash">
                    {job.metadata.receiptHash.slice(0, 24)}...
                  </div>
                </div>
              )}

              {job.metadata.settlementEpoch && (
                <div className="inspector-field">
                  <div className="inspector-field-label">Settlement Epoch</div>
                  <div className="inspector-field-value">
                    #{job.metadata.settlementEpoch}
                  </div>
                </div>
              )}
            </div>

            <div className="inspector-section">
              <div className="inspector-section-title">Timestamp</div>
              <div className="inspector-field-value" style={{ fontSize: '10px' }}>
                {job.timestamp.toISOString()}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
