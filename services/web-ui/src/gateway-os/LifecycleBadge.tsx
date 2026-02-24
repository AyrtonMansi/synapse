import type { JobState } from './useJobLifecycle';

interface LifecycleBadgeProps {
  state: JobState;
}

export function LifecycleBadge({ state }: LifecycleBadgeProps) {
  const stateConfig: Record<JobState, { label: string; icon: string }> = {
    queued: { label: 'QUEUED', icon: '◉' },
    routing: { label: 'ROUTING', icon: '→' },
    executing: { label: 'EXECUTING', icon: '▶' },
    verifying: { label: 'VERIFYING', icon: '◈' },
    completed: { label: 'COMPLETED', icon: '✓' },
    fallback: { label: 'FALLBACK', icon: '⚠' },
    retry: { label: 'RETRY', icon: '↻' },
  };

  const config = stateConfig[state];

  return (
    <span className={`lifecycle-badge lifecycle-${state}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
