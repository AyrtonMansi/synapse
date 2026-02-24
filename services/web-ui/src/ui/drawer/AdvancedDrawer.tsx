import { X, RotateCcw, Copy, Terminal, Route, FileText, Clock } from 'lucide-react';
import type { Message } from '../chat/types';

interface AdvancedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
  activeTab: 'lifecycle' | 'routing' | 'logs' | 'replay';
  onTabChange: (tab: 'lifecycle' | 'routing' | 'logs' | 'replay') => void;
  onRetry: () => void;
  apiKey: string;
}

const tabs = [
  { id: 'lifecycle' as const, label: 'Lifecycle', icon: Clock },
  { id: 'routing' as const, label: 'Routing', icon: Route },
  { id: 'logs' as const, label: 'Logs', icon: FileText },
  { id: 'replay' as const, label: 'Replay', icon: Terminal },
];

export function AdvancedDrawer({
  isOpen,
  onClose,
  message,
  activeTab,
  onTabChange,
  onRetry,
  apiKey,
}: AdvancedDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="w-96 bg-charcoal-900 border-l border-charcoal-800 flex flex-col h-full">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-charcoal-800">
        <h3 className="font-medium text-charcoal-100">Advanced</h3>
        <button 
          onClick={onClose}
          className="p-1.5 text-charcoal-400 hover:text-charcoal-100 hover:bg-charcoal-800 rounded-lg transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-charcoal-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors ${
              activeTab === tab.id 
                ? 'text-synapse-400 border-b-2 border-synapse-500' 
                : 'text-charcoal-400 hover:text-charcoal-200'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!message ? (
          <EmptyState />
        ) : (
          <>
            {activeTab === 'lifecycle' && <LifecycleTab message={message} />}
            {activeTab === 'routing' && <RoutingTab message={message} />}
            {activeTab === 'logs' && <LogsTab message={message} />}
            {activeTab === 'replay' && <ReplayTab message={message} apiKey={apiKey} onRetry={onRetry} />}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-charcoal-500 text-center p-4">
      <Clock size={32} className="mb-3 opacity-50" />
      <p className="text-sm">Select an assistant message to view debug information</p>
    </div>
  );
}

function LifecycleTab({ message }: { message: Message }) {
  const steps = [
    { state: 'queued', label: 'Request queued', time: '0ms' },
    { state: 'routing', label: 'Node selected', time: '120ms' },
    { state: 'executing', label: 'Inference started', time: '250ms' },
    { state: 'streaming', label: 'Response streaming', time: '300ms' },
    { state: 'completed', label: 'Completed', time: `${message.metadata?.latency || 0}ms` },
  ];

  const currentIndex = steps.findIndex(s => s.state === message.state);

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-medium text-charcoal-400 uppercase tracking-wider mb-4">
        Request Timeline
      </h4>
      
      {steps.map((step, idx) => {
        const isCompleted = idx <= currentIndex || message.state === 'completed';
        const isCurrent = idx === currentIndex && message.state !== 'completed';
        
        return (
          <div 
            key={step.state}
            className={`flex items-center gap-3 p-3 rounded-lg ${
              isCurrent ? 'bg-synapse-900/20 border border-synapse-800' : 
              isCompleted ? 'bg-charcoal-800/50' : 'opacity-50'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${
              isCompleted ? 'bg-synapse-500' : 'bg-charcoal-600'
            }`} />
            <div className="flex-1">
              <div className="text-sm text-charcoal-200">{step.label}</div>
            </div>
            <div className="text-xs text-charcoal-500 font-mono">{step.time}</div>
          </div>
        );
      })}
    </div>
  );
}

function RoutingTab({ message }: { message: Message }) {
  const fields = [
    { label: 'Model', value: message.metadata?.model || '—' },
    { label: 'Node ID', value: message.metadata?.nodeId || '—' },
    { label: 'Latency', value: message.metadata?.latency ? `${message.metadata.latency}ms` : '—' },
    { label: 'Retries', value: message.metadata?.retryCount?.toString() || '0' },
    { label: 'Fallback', value: message.metadata?.fallbackReason || 'No' },
    { label: 'Receipt', value: message.metadata?.receiptHash ? `${message.metadata.receiptHash.slice(0, 16)}...` : '—' },
    { label: 'Verified', value: message.metadata?.receiptHash ? 'Yes' : 'Pending' },
  ];

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-medium text-charcoal-400 uppercase tracking-wider">
        Routing Metadata
      </h4>
      
      <div className="bg-charcoal-950 rounded-lg border border-charcoal-800 divide-y divide-charcoal-800">
        {fields.map((field) => (
          <div key={field.label} className="flex justify-between items-center px-4 py-3">
            <span className="text-sm text-charcoal-400">{field.label}</span>
            <span className="text-sm text-charcoal-200 font-mono">{field.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogsTab({ message }: { message: Message }) {
  const logs = [
    { time: '12:34:56', level: 'info', msg: `Request ${message.id} initiated` },
    { time: '12:34:56', level: 'info', msg: `Routing to node ${message.metadata?.nodeId || 'pending'}` },
    { time: '12:34:57', level: 'info', msg: 'Connection established' },
    { time: '12:34:57', level: 'info', msg: 'Streaming response' },
    message.metadata?.error && { time: '12:34:58', level: 'error', msg: message.metadata.error },
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-medium text-charcoal-400 uppercase tracking-wider">
        Request Logs
      </h4>
      
      <div className="bg-charcoal-950 rounded-lg border border-charcoal-800 p-3 font-mono text-xs space-y-2">
        {logs.map((log: any, idx) => (
          <div key={idx} className="flex gap-3">
            <span className="text-charcoal-600">{log.time}</span>
            <span className={log.level === 'error' ? 'text-red-400' : 'text-synapse-400'}>
              {log.level}
            </span>
            <span className="text-charcoal-300">{log.msg}</span>
          </div>
        ))}
      </div>

      {/* Headers */}
      <div className="mt-4">
        <h5 className="text-xs text-charcoal-500 mb-2">Response Headers</h5>
        <div className="bg-charcoal-950 rounded-lg border border-charcoal-800 p-3 font-mono text-xs space-y-1">
          <div className="text-charcoal-400">x-request-id: {message.id}</div>
          <div className="text-charcoal-400">x-node-id: {message.metadata?.nodeId || 'unknown'}</div>
          <div className="text-charcoal-400">content-type: application/json</div>
        </div>
      </div>
    </div>
  );
}

function ReplayTab({ message, apiKey, onRetry }: { message: Message; apiKey: string; onRetry: () => void }) {
  const curlCmd = `curl https://api.synapse.sh/v1/chat/completions \\
  -H "Authorization: Bearer ${apiKey.slice(0, 8)}..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${message.metadata?.model || 'gpt-4'}",
    "messages": [{"role": "user", "content": "..."}]
  }'`;

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-medium text-charcoal-400 uppercase tracking-wider">
        Replay Request
      </h4>
      
      {/* Retry button */}
      <button
        onClick={onRetry}
        className="w-full flex items-center justify-center gap-2 py-3 bg-synapse-600 hover:bg-synapse-500 text-white rounded-lg transition-colors"
      >
        <RotateCcw size={18} />
        Retry Request
      </button>

      {/* Copy curl */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h5 className="text-xs text-charcoal-500">cURL</h5>
          <button 
            onClick={() => navigator.clipboard.writeText(curlCmd)}
            className="flex items-center gap-1 text-xs text-synapse-400 hover:text-synapse-300"
          >
            <Copy size={12} />
            Copy
          </button>
        </div>
        <pre className="bg-charcoal-950 rounded-lg border border-charcoal-800 p-3 font-mono text-xs text-charcoal-300 overflow-x-auto whitespace-pre-wrap">
          {curlCmd}
        </pre>
      </div>

      <p className="text-xs text-charcoal-500">
        Retry will send the same request again and append the new response to the conversation.
      </p>
    </div>
  );
}
