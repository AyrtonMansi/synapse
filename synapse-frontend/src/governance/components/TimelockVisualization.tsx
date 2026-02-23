import { useState } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Play, 
  AlertTriangle,
  Calendar,
  Hourglass,
  Zap,
  Shield
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { TimelockOperation, TimelockState } from '../types';

interface TimelockVisualizationProps {
  operations: TimelockOperation[];
  onExecute?: (id: string) => void;
  onCancel?: (id: string) => void;
  isProcessing?: boolean;
}

export function TimelockVisualization({
  operations,
  onExecute,
  onCancel,
  isProcessing,
}: TimelockVisualizationProps) {
  const [filter, setFilter] = useState<TimelockState | 'all'>('all');
  const [expandedOp, setExpandedOp] = useState<string | null>(null);

  const filteredOperations = filter === 'all' 
    ? operations 
    : operations.filter(op => op.state === filter);

  const getStateIcon = (state: TimelockState) => {
    switch (state) {
      case 'Pending':
        return <Hourglass className="w-5 h-5 text-yellow-500" />;
      case 'Ready':
        return <Zap className="w-5 h-5 text-green-500" />;
      case 'Executed':
        return <CheckCircle2 className="w-5 h-5 text-blue-500" />;
      case 'Canceled':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'Expired':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStateColor = (state: TimelockState) => {
    switch (state) {
      case 'Pending':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'Ready':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'Executed':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'Canceled':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'Expired':
        return 'bg-orange-50 border-orange-200 text-orange-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return 'Ready now';
    if (seconds === Number.MAX_SAFE_INTEGER) return 'Expired';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Timelock Operations</h3>
          <p className="text-sm text-gray-500">Track and manage delayed governance operations</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Shield className="w-4 h-4" />
          <span>{operations.length} total operations</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {(['all', TimelockState.Pending, TimelockState.Ready, TimelockState.Executed, TimelockState.Canceled] as const).map((status) => {
          const count = status === 'all' 
            ? operations.length 
            : operations.filter(op => op.state === status).length;
          
          return (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`p-3 rounded-lg border text-left transition-all ${
                filter === status
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl font-bold text-gray-900">{count}</div>
              <div className="text-xs text-gray-500 capitalize">{status}</div>
            </button>
          );
        })}
      </div>

      {/* Operations List */}
      <div className="space-y-3">
        {filteredOperations.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl">
            <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No timelock operations found</p>
          </div>
        ) : (
          filteredOperations.map((operation) => (
            <div
              key={operation.id}
              className={`border rounded-xl overflow-hidden transition-all ${getStateColor(operation.state)}`}
            >
              {/* Summary Row */}
              <button
                onClick={() => setExpandedOp(expandedOp === operation.id ? null : operation.id)}
                className="w-full p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  {getStateIcon(operation.state)}
                  <div className="text-left">
                    <div className="font-medium">{operation.description}</div>
                    <div className="text-xs opacity-75 mt-0.5">
                      ID: {operation.id.slice(0, 10)}...{operation.id.slice(-6)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {operation.state === 'Pending' && (
                    <div className="flex items-center gap-2 text-sm">
                      <Hourglass className="w-4 h-4" />
                      {formatDuration(operation.timeUntilExecution)}
                    </div>
                  )}
                  {operation.state === 'Ready' && (
                    <span className="flex items-center gap-1 text-sm font-medium">
                      <Zap className="w-4 h-4" />
                      Ready to execute
                    </span>
                  )}
                  {operation.progressPercent > 0 && operation.progressPercent < 100 && (
                    <div className="w-24">
                      <div className="h-2 bg-black/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-current rounded-full transition-all"
                          style={{ width: `${operation.progressPercent}%` }}
                        />
                      </div>
                      <div className="text-xs text-center mt-1">{operation.progressPercent}%</div>
                    </div>
                  )}
                </div>
              </button>

              {/* Expanded Details */}
              {expandedOp === operation.id && (
                <div className="px-4 pb-4 border-t border-current border-opacity-20">
                  <div className="pt-4 space-y-4">
                    {/* Timeline */}
                    <div className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-current opacity-20" />
                      
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-current flex items-center justify-center">
                            <Calendar className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <div className="font-medium">Created</div>
                            <div className="text-sm opacity-75">
                              {format(operation.createdAt * 1000, 'PPpp')}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            operation.state === 'Pending' ? 'bg-yellow-500' : 'bg-current'
                          }`}>
                            <Clock className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <div className="font-medium">Executable</div>
                            <div className="text-sm opacity-75">
                              {format(operation.eta * 1000, 'PPpp')}
                            </div>
                            <div className="text-xs opacity-60">
                              Delay: {formatDistanceToNow((operation.createdAt + operation.delay) * 1000)}
                            </div>
                          </div>
                        </div>

                        {operation.state === 'Executed' && (
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                              <CheckCircle2 className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <div className="font-medium">Executed</div>
                              <div className="text-sm opacity-75">Successfully completed</div>
                            </div>
                          </div>
                        )}

                        {operation.state === 'Canceled' && (
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                              <XCircle className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <div className="font-medium">Canceled</div>
                              <div className="text-sm opacity-75">Operation was canceled</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Technical Details */}
                    <div className="p-3 bg-black/5 rounded-lg">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="opacity-60">Target:</span>
                          <div className="font-mono">{operation.target}</div>
                        </div>
                        <div>
                          <span className="opacity-60">Value:</span>
                          <div>{operation.value} ETH</div>
                        </div>
                        <div className="col-span-2">
                          <span className="opacity-60">Calldata:</span>
                          <div className="font-mono text-xs break-all">{operation.data}</div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {operation.state === 'Ready' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => onExecute?.(operation.id)}
                          disabled={isProcessing}
                          className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          <Play className="w-4 h-4" />
                          Execute Operation
                        </button>
                        <button
                          onClick={() => onCancel?.(operation.id)}
                          disabled={isProcessing}
                          className="px-4 py-2 border-2 border-red-300 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {operation.state === 'Pending' && (
                      <button
                        onClick={() => onCancel?.(operation.id)}
                        disabled={isProcessing}
                        className="w-full py-2 border-2 border-red-300 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        Cancel Operation
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}