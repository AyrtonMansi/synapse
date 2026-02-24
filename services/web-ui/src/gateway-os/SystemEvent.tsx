import type { SystemEvent } from './useJobLifecycle';

interface SystemEventProps {
  event: SystemEvent;
}

export function SystemEventMessage({ event }: SystemEventProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const eventTypeLabels: Record<string, string> = {
    node_connected: 'NODE',
    routing_changed: 'ROUTING',
    fallback_engaged: 'FALLBACK',
    settlement_complete: 'SETTLEMENT',
    receipt_generated: 'RECEIPT',
  };

  return (
    <div className="system-event">
      <span className="system-event-time">{formatTime(event.timestamp)}</span>
      <span className="system-event-type">[{eventTypeLabels[event.type]}]</span>
      <span>{event.message}</span>
    </div>
  );
}
