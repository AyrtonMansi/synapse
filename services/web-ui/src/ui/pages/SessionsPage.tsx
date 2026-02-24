import { useState, useEffect } from 'react';
import { History, MessageSquare, Clock, ChevronRight, AlertCircle, Trash2, X } from 'lucide-react';
import { useToast } from '../../lib/toast';

interface Session {
  id: string;
  title: string;
  messageCount: number;
  model: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'completed' | 'error';
}

export function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    // Load from localStorage (in production, would fetch from API)
    const loadSessions = async () => {
      try {
        setLoading(true);
        
        // Check localStorage for sessions
        const stored = localStorage.getItem('synapse_sessions');
        if (stored) {
          setSessions(JSON.parse(stored));
        } else {
          setSessions([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sessions');
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, []);

  const deleteSession = (id: string) => {
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    localStorage.setItem('synapse_sessions', JSON.stringify(updated));
    showToast('Session deleted', 'success');
    if (selectedSession?.id === id) {
      setSelectedSession(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: Session['status']) => {
    switch (status) {
      case 'active':
        return 'bg-synapse-500/10 text-synapse-400';
      case 'completed':
        return 'bg-charcoal-800 text-charcoal-400';
      case 'error':
        return 'bg-red-500/10 text-red-400';
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-charcoal-100">Sessions</h1>
          <p className="text-charcoal-400">View and manage your chat history</p>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-4 animate-pulse">
              <div className="h-5 bg-charcoal-800 rounded w-1/3 mb-2" />
              <div className="h-4 bg-charcoal-800 rounded w-1/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-charcoal-100">Sessions</h1>
          <p className="text-charcoal-400">View and manage your chat history</p>
        </div>
        <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-8 text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-400 mb-2">Failed to load sessions</h3>
          <p className="text-red-400/80 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-charcoal-100">Sessions</h1>
          <p className="text-charcoal-400">View and manage your chat history</p>
        </div>
        <div className="bg-charcoal-900 border border-charcoal-800 rounded-xl p-12 text-center">
          <History size={48} className="text-charcoal-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-charcoal-300 mb-2">No sessions yet</h3>
          <p className="text-charcoal-500 mb-6 max-w-md mx-auto">
            Start a new chat to create your first session. Sessions are stored locally in your browser.
          </p>
          <a 
            href="/gateway/chat"
            className="inline-flex items-center gap-2 px-4 py-2 bg-synapse-600 hover:bg-synapse-500 text-white rounded-lg transition-colors"
          >
            <MessageSquare size={18} />
            Start Chat
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-charcoal-100">Sessions</h1>
        <p className="text-charcoal-400">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="space-y-3">
        {sessions.map(session => (
          <div 
            key={session.id}
            onClick={() => setSelectedSession(session)}
            className="bg-charcoal-900 border border-charcoal-800 hover:border-charcoal-700 rounded-xl p-4 cursor-pointer transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-charcoal-800 rounded-lg">
                  <MessageSquare size={18} className="text-charcoal-400" />
                </div>
                <div>
                  <h3 className="font-medium text-charcoal-100">{session.title}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-charcoal-500">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {formatDate(session.updatedAt)}
                    </span>
                    <span>•</span>
                    <span>{session.messageCount} messages</span>
                    <span>•</span>
                    <span className="text-charcoal-400">{session.model}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 text-xs rounded ${getStatusColor(session.status)}`}>
                  {session.status}
                </span>
                <ChevronRight size={18} className="text-charcoal-600 group-hover:text-charcoal-400" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Session Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-charcoal-900 rounded-xl border border-charcoal-800 w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-charcoal-800">
              <h3 className="font-medium text-charcoal-100">Session Details</h3>
              <button 
                onClick={() => setSelectedSession(null)}
                className="p-1 text-charcoal-400 hover:text-charcoal-100"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-charcoal-500 uppercase tracking-wider">Title</label>
                <p className="text-charcoal-200 mt-1">{selectedSession.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-charcoal-500 uppercase tracking-wider">ID</label>
                  <p className="text-charcoal-200 mt-1 font-mono text-sm">{selectedSession.id}</p>
                </div>
                <div>
                  <label className="text-xs text-charcoal-500 uppercase tracking-wider">Model</label>
                  <p className="text-charcoal-200 mt-1">{selectedSession.model}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-charcoal-500 uppercase tracking-wider">Created</label>
                  <p className="text-charcoal-200 mt-1">{formatDate(selectedSession.createdAt)}</p>
                </div>
                <div>
                  <label className="text-xs text-charcoal-500 uppercase tracking-wider">Messages</label>
                  <p className="text-charcoal-200 mt-1">{selectedSession.messageCount}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 border-t border-charcoal-800">
              <button
                onClick={() => deleteSession(selectedSession.id)}
                className="flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
                Delete
              </button>
              <a 
                href={`/gateway/chat?session=${selectedSession.id}`}
                className="px-4 py-2 bg-synapse-600 hover:bg-synapse-500 text-white rounded-lg transition-colors"
              >
                Open Chat
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
