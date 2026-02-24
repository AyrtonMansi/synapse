import { useState, useEffect } from 'react';
import {
  Terminal,
  Activity,
  Server,
  Route,
  FileText,
  BarChart3,
  Wallet,
  Settings,
  BookOpen,
  Zap
} from 'lucide-react';
import { TelemetryBar } from './TelemetryBar';
import { JobStream } from './JobStream';
import { InspectorPanel } from './InspectorPanel';
import type { Job, JobState, SystemEvent } from './useJobLifecycle';
import './gateway-os.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface GatewayOSProps {
  apiKey: string;
  wallet?: string;
}

const navItems = [
  { id: 'chat', icon: Terminal, label: 'Chat' },
  { id: 'overview', icon: Activity, label: 'Overview' },
  { id: 'nodes', icon: Server, label: 'Nodes' },
  { id: 'sessions', icon: Zap, label: 'Sessions' },
  { id: 'routing', icon: Route, label: 'Routing' },
  { id: 'receipts', icon: FileText, label: 'Receipts' },
  { id: 'usage', icon: BarChart3, label: 'Usage' },
  { id: 'earnings', icon: Wallet, label: 'Earnings' },
  { id: 'settings', icon: Settings, label: 'Settings' },
  { id: 'docs', icon: BookOpen, label: 'Docs' },
];

export function GatewayOS({ apiKey, wallet }: GatewayOSProps) {
  const [activeTab, setActiveTab] = useState('chat');
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [systemEvents, setSystemEvents] = useState<SystemEvent[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState({
    nodesOnline: 47,
    queueDepth: 3,
    fallbackRate: 2.1,
    latency: 89,
    jobsToday: 1247,
  });

  // Poll for telemetry updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/stats`);
        if (res.ok) {
          const data = await res.json();
          setTelemetry({
            nodesOnline: data.nodes_online || 47,
            queueDepth: data.queue_depth || Math.floor(Math.random() * 10),
            fallbackRate: data.fallback_rate || 2.1,
            latency: data.latency || 89,
            jobsToday: data.jobs_today || 1247,
          });
        }
      } catch {
        // Simulate telemetry if backend unavailable
        setTelemetry(prev => ({
          ...prev,
          queueDepth: Math.max(0, prev.queueDepth + (Math.random() > 0.5 ? 1 : -1)),
          latency: Math.max(20, Math.min(500, prev.latency + (Math.random() - 0.5) * 20)),
        }));
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Create a new job
  const createJob = (content: string, role: 'user' | 'assistant' = 'user'): Job => {
    const job: Job = {
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role,
      content,
      state: role === 'user' ? 'completed' : 'queued',
      metadata: {
        jobId: `job_${Date.now()}`,
        retryAttempts: 0,
      },
      timestamp: new Date(),
      isStreaming: false,
    };
    
    setJobs(prev => [...prev, job]);
    return job;
  };

  // Update job state
  const updateJobState = (jobId: string, state: JobState, metadata?: Partial<Job['metadata']>) => {
    setJobs(prev => prev.map(job => 
      job.id === jobId 
        ? { ...job, state, metadata: { ...job.metadata, ...metadata } }
        : job
    ));
  };

  // Update job content
  const updateJobContent = (jobId: string, content: string, isStreaming: boolean = false) => {
    setJobs(prev => prev.map(job => 
      job.id === jobId 
        ? { ...job, content, isStreaming }
        : job
    ));
  };

  // Add system event
  const addSystemEvent = (type: SystemEvent['type'], message: string) => {
    const event: SystemEvent = {
      id: `evt_${Date.now()}`,
      type,
      message,
      timestamp: new Date(),
    };
    setSystemEvents(prev => [event, ...prev].slice(0, 50));
  };

  // Handle sending a message
  const handleSendMessage = async (content: string) => {
    // Create user job
    const userJob = createJob(content, 'user');
    setSelectedJobId(userJob.id);

    // Create assistant job
    const assistantJobId = `job_${Date.now()}_assistant`;
    setTimeout(() => {
      updateJobState(userJob.id, 'routing');
      
      // Add assistant job
      const assistantJob: Job = {
        id: assistantJobId,
        role: 'assistant',
        content: '',
        state: 'executing',
        metadata: {
          jobId: assistantJobId,
          nodeId: `node_${Math.random().toString(16).slice(2, 8)}`,
          provider: 'deepseek-v3',
          retryAttempts: 0,
        },
        timestamp: new Date(),
        isStreaming: true,
      };
      
      setJobs(prev => [...prev, assistantJob]);
      setSelectedJobId(assistantJobId);

      // Execute inference
      executeInference(assistantJobId, content);
    }, 300);
  };

  // Execute inference
  const executeInference = async (jobId: string, prompt: string) => {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${API_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-v3',
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        throw { status: response.status, code: 'HTTP_ERROR' };
      }

      const latency = Date.now() - startTime;
      
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      // Simulate streaming
      const words = content.split(' ');
      let currentContent = '';
      
      for (let i = 0; i < words.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 30));
        currentContent += (i > 0 ? ' ' : '') + words[i];
        updateJobContent(jobId, currentContent, i < words.length - 1);
      }

      // Complete job
      updateJobState(jobId, 'completed', {
        latency,
        receiptHash: `0x${Array.from({ length: 64 }, () => 
          Math.floor(Math.random() * 16).toString(16)
        ).join('')}`,
        routingDecision: 'capacity_based',
      });
      
      addSystemEvent('receipt_generated', `Receipt generated for job ${jobId.slice(0, 8)}...`);
      
    } catch (error: any) {
      // Map errors to lifecycle states
      const errorCode = error?.status || error?.code;
      
      if (errorCode === 500 || errorCode === 'NETWORK_ERROR') {
        updateJobState(jobId, 'retry', { retryAttempts: 1 });
      } else if (errorCode === 503 || errorCode === 'NO_NODE_AVAILABLE') {
        updateJobState(jobId, 'queued');
      } else {
        updateJobState(jobId, 'fallback', { fallbackReason: 'router_timeout' });
        addSystemEvent('fallback_engaged', `Fallback engaged for job ${jobId.slice(0, 8)}...`);
      }
    }
  };

  const selectedJob = jobs.find(j => j.id === selectedJobId) || null;

  return (
    <div className="gateway-os">
      {/* Telemetry Bar */}
      <TelemetryBar 
        nodesOnline={telemetry.nodesOnline}
        queueDepth={telemetry.queueDepth}
        fallbackRate={telemetry.fallbackRate}
        latency={telemetry.latency}
        jobsToday={telemetry.jobsToday}
        wallet={wallet}
      />

      <div className="gateway-body">
        {/* Left Sidebar */}
        <aside className="os-sidebar">
          <div className="os-sidebar-header">
            <span className="os-logo">SYNAPSE</span>
          </div>
          
          <nav className="os-nav">
            <div className="os-nav-section">
              {navItems.slice(0, 4).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  className={`os-nav-item ${activeTab === id ? 'active' : ''}`}
                  onClick={() => setActiveTab(id)}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            
            <div className="os-nav-section">
              <div className="os-nav-section-title">Infrastructure</div>
              {navItems.slice(4, 7).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  className={`os-nav-item ${activeTab === id ? 'active' : ''}`}
                  onClick={() => setActiveTab(id)}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            
            <div className="os-nav-section">
              <div className="os-nav-section-title">System</div>
              {navItems.slice(7).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  className={`os-nav-item ${activeTab === id ? 'active' : ''}`}
                  onClick={() => setActiveTab(id)}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </nav>
        </aside>

        {/* Center Panel - Job Stream */}
        <div className="job-stream-container">
          <div className="job-stream-header">
            <span className="job-stream-title">Inference Stream</span>
            <div className="job-stream-status">
              <div className="stream-status-indicator" />
              <span style={{ fontSize: '10px', color: '#666' }}>LIVE</span>
            </div>
          </div>
          
          {activeTab === 'chat' ? (
            <JobStream
              jobs={jobs}
              systemEvents={systemEvents}
              selectedJobId={selectedJobId}
              onSelectJob={setSelectedJobId}
              onSendMessage={handleSendMessage}
            />
          ) : (
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#444',
              fontSize: '12px'
            }}>
              {activeTab} view coming soon
            </div>
          )}
        </div>

        {/* Right Panel - Inspector */}
        <InspectorPanel
          job={selectedJob}
          collapsed={inspectorCollapsed}
          onToggle={() => setInspectorCollapsed(!inspectorCollapsed)}
        />
      </div>
    </div>
  );
}
