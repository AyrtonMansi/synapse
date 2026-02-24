import { useState, useCallback } from 'react';

export type JobState = 
  | 'queued' 
  | 'routing' 
  | 'executing' 
  | 'verifying' 
  | 'completed' 
  | 'fallback' 
  | 'retry';

export interface JobMetadata {
  jobId: string;
  nodeId?: string;
  provider?: string;
  receiptHash?: string;
  latency?: number;
  retryAttempts: number;
  settlementEpoch?: number;
  routingDecision?: string;
  fallbackReason?: string;
}

export interface Job {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  state: JobState;
  metadata: JobMetadata;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface SystemEvent {
  id: string;
  type: 'node_connected' | 'routing_changed' | 'fallback_engaged' | 'settlement_complete' | 'receipt_generated';
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export function useJobLifecycle() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [systemEvents, setSystemEvents] = useState<SystemEvent[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Create a new job
  const createJob = useCallback((content: string): Job => {
    const job: Job = {
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content,
      state: 'queued',
      metadata: {
        jobId: `job_${Date.now()}`,
        retryAttempts: 0,
      },
      timestamp: new Date(),
    };
    
    setJobs(prev => [...prev, job]);
    
    // Simulate lifecycle progression
    setTimeout(() => updateJobState(job.id, 'routing'), 500);
    
    return job;
  }, []);

  // Update job state
  const updateJobState = useCallback((jobId: string, state: JobState, metadata?: Partial<JobMetadata>) => {
    setJobs(prev => prev.map(job => 
      job.id === jobId 
        ? { ...job, state, metadata: { ...job.metadata, ...metadata } }
        : job
    ));

    // Add system events for state changes
    if (state === 'fallback') {
      addSystemEvent('fallback_engaged', `Job ${jobId.slice(0, 8)}... routed to fallback provider`);
    } else if (state === 'retry') {
      addSystemEvent('routing_changed', `Retry initiated for job ${jobId.slice(0, 8)}...`);
    }
  }, []);

  // Update job content (for streaming)
  const updateJobContent = useCallback((jobId: string, content: string, isStreaming: boolean = false) => {
    setJobs(prev => prev.map(job => 
      job.id === jobId 
        ? { ...job, content, isStreaming }
        : job
    ));
  }, []);

  // Add system event
  const addSystemEvent = useCallback((type: SystemEvent['type'], message: string, metadata?: Record<string, any>) => {
    const event: SystemEvent = {
      id: `evt_${Date.now()}`,
      type,
      message,
      timestamp: new Date(),
      metadata,
    };
    setSystemEvents(prev => [event, ...prev].slice(0, 50));
  }, []);

  // Complete job with final metadata
  const completeJob = useCallback((jobId: string, finalMetadata: Partial<JobMetadata>) => {
    setJobs(prev => prev.map(job => 
      job.id === jobId 
        ? { 
            ...job, 
            state: 'completed', 
            metadata: { ...job.metadata, ...finalMetadata },
            isStreaming: false,
          }
        : job
    ));
    
    addSystemEvent('receipt_generated', `Receipt generated for job ${jobId.slice(0, 8)}...`, {
      receiptHash: finalMetadata.receiptHash,
    });
  }, [addSystemEvent]);

  // Handle error by mapping to lifecycle state
  const handleError = useCallback((jobId: string, error: any) => {
    const errorCode = error?.status || error?.code;
    
    // Map errors to lifecycle states
    if (errorCode === 500 || errorCode === 'NETWORK_ERROR') {
      updateJobState(jobId, 'retry', { retryAttempts: 1 });
    } else if (errorCode === 503 || errorCode === 'NO_NODE_AVAILABLE') {
      updateJobState(jobId, 'queued');
    } else if (errorCode === 'ROUTER_FAILURE') {
      updateJobState(jobId, 'fallback', { fallbackReason: 'router_timeout' });
    } else {
      updateJobState(jobId, 'fallback');
    }
  }, [updateJobState]);

  // Select a job for inspection
  const selectJob = useCallback((jobId: string | null) => {
    setSelectedJobId(jobId);
  }, []);

  // Get selected job
  const selectedJob = jobs.find(j => j.id === selectedJobId) || null;

  return {
    jobs,
    systemEvents,
    selectedJob,
    selectedJobId,
    createJob,
    updateJobState,
    updateJobContent,
    completeJob,
    handleError,
    selectJob,
    addSystemEvent,
  };
}
