import { useState, useEffect } from 'react';

type EventType = 'job' | 'select' | 'fallback' | 'verify';

interface RoutingEvent {
  id: string;
  timestamp: Date;
  type: EventType;
  message: string;
}

export function RoutingEvents() {
  const [events, setEvents] = useState<RoutingEvent[]>([]);

  useEffect(() => {
    // Generate initial events
    const initial: RoutingEvent[] = [
      { id: '1', timestamp: new Date(Date.now() - 5000), type: 'job', message: 'Job #8923 queued → deepseek-v3' },
      { id: '2', timestamp: new Date(Date.now() - 4500), type: 'select', message: 'Selected node_a7f3 (RTX 4090, 94% health)' },
      { id: '3', timestamp: new Date(Date.now() - 4200), type: 'job', message: 'Job #8923 routed → node_a7f3' },
      { id: '4', timestamp: new Date(Date.now() - 3800), type: 'verify', message: 'Challenge response verified (ZK proof valid)' },
    ];
    setEvents(initial);

    // Generate new events
    const eventTemplates: { type: EventType; messages: string[] }[] = [
      {
        type: 'job',
        messages: [
          'Job #{id} queued → deepseek-v3',
          'Job #{id} queued → claude-opus',
          'Job #{id} queued → gpt-4',
          'Job #{id} routed → {node}',
          'Job #{id} completed [{tokens} tokens]',
        ]
      },
      {
        type: 'select',
        messages: [
          'Selected {node} (RTX 4090, {health}% health)',
          'Selected {node} (A100, {health}% health)',
          'Load balancing: {node} (lowest latency: {lat}ms)',
        ]
      },
      {
        type: 'fallback',
        messages: [
          'Node {node} timeout → fallback to echo-stub',
          'Node {node} rejected challenge → routing to backup',
          'High latency on {node} → redistributing load',
        ]
      },
      {
        type: 'verify',
        messages: [
          'Challenge response verified (ZK proof valid)',
          'Receipt signature validated',
          'Settlement batch confirmed on-chain',
        ]
      },
    ];

    let jobId = 8924;

    const generateEvent = (): RoutingEvent => {
      const template = eventTemplates[Math.floor(Math.random() * eventTemplates.length)];
      const message = template.messages[Math.floor(Math.random() * template.messages.length)]
        .replace('{id}', (jobId++).toString())
        .replace('{node}', `node_${Math.random().toString(16).slice(2, 6)}`)
        .replace('{health}', Math.floor(Math.random() * 30 + 70).toString())
        .replace('{lat}', Math.floor(Math.random() * 100 + 20).toString())
        .replace('{tokens}', Math.floor(Math.random() * 500 + 50).toString());

      return {
        id: `evt_${Date.now()}_${Math.random()}`,
        timestamp: new Date(),
        type: template.type,
        message,
      };
    };

    const interval = setInterval(() => {
      setEvents(prev => {
        const newEvent = generateEvent();
        return [newEvent, ...prev].slice(0, 50);
      });
    }, 2000 + Math.random() * 2000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getEventColor = (type: EventType) => {
    switch (type) {
      case 'job': return '#0ff';
      case 'select': return '#666';
      case 'fallback': return '#f33';
      case 'verify': return '#0f0';
    }
  };

  return (
    <div className="terminal-window" style={{ height: '100%' }}>
      <div className="terminal-header">
        <span>routing.events</span>
        <span style={{ marginLeft: 'auto', color: '#666' }}>
          {events.length} events
        </span>
      </div>
      
      <div className="terminal-body">
        <div className="log-stream">
          {events.map((event, index) => (
            <div 
              key={event.id}
              className="log-entry"
              style={{
                animation: index === 0 ? 'fadeIn 0.2s ease-out' : undefined,
              }}
            >
              <span className="log-timestamp">{formatTime(event.timestamp)}</span>
              <span 
                className="log-event"
                style={{ color: getEventColor(event.type) }}
              >
                [{event.type}]
              </span>
              <span className="log-detail">{event.message}</span>
            </div>
          ))}
        </div>
      </div>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
