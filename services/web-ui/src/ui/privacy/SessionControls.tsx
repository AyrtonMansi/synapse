import { Download, Trash2, X } from 'lucide-react';
import { useState } from 'react';

interface SessionControlsProps {
  sessionId: string;
  onExport: () => string | null;
  onForget: () => void;
}

export function SessionControls({ sessionId, onExport, onForget }: SessionControlsProps) {
  const [showExport, setShowExport] = useState(false);
  const [exportedData, setExportedData] = useState<string | null>(null);
  const [showForget, setShowForget] = useState(false);

  const handleExport = () => {
    const data = onExport();
    if (data) {
      setExportedData(data);
      setShowExport(true);
    }
  };

  const downloadExport = () => {
    if (!exportedData) return;
    const blob = new Blob([exportedData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `synapse-session-${sessionId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-charcoal-400 hover:text-charcoal-200 bg-charcoal-900 hover:bg-charcoal-800 rounded-lg transition-colors"
          title="Export encrypted session"
        >
          <Download size={14} />
          Export
        </button>
        
        <button
          onClick={() => setShowForget(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-charcoal-400 hover:text-red-400 bg-charcoal-900 hover:bg-red-950/30 rounded-lg transition-colors"
          title="Delete session"
        >
          <Trash2 size={14} />
          Forget
        </button>
      </div>

      {/* Export Modal */}
      {showExport && exportedData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-charcoal-100">Export Session</h3>
              <button
                onClick={() => setShowExport(false)}
                className="p-1 text-charcoal-400 hover:text-charcoal-200"
              >
                <X size={20} />
              </button>
            </div>
            
            <p className="text-sm text-charcoal-400 mb-4">
              This file contains your encrypted session data. You can import it later using the same workspace key.
            </p>
            
            <div className="bg-charcoal-950 rounded-lg p-3 mb-4">
              <code className="text-xs text-charcoal-500 font-mono break-all">
                {exportedData.slice(0, 100)}...{exportedData.slice(-50)}
              </code>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(exportedData);
                }}
                className="flex-1 py-2.5 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-200 rounded-lg transition-colors"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={downloadExport}
                className="flex-1 py-2.5 bg-synapse-600 hover:bg-synapse-500 text-white rounded-lg transition-colors"
              >
                Download File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forget Confirmation */}
      {showForget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-charcoal-100 mb-2">Forget Session?</h3>
            <p className="text-charcoal-400 text-sm mb-6">
              This will permanently delete this session from your device. 
              {exportedData ? 'You have already exported a backup.' : 'Make sure to export first if you want to keep it.'}
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowForget(false)}
                className="flex-1 py-2.5 bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onForget();
                  setShowForget(false);
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                Forget
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
