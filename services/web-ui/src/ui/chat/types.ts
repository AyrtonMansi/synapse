export type MessageState = 'queued' | 'routing' | 'executing' | 'streaming' | 'completed' | 'error' | 'fallback';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  state: MessageState;
  metadata?: {
    model?: string;
    nodeId?: string;
    latency?: number;
    receiptHash?: string;
    error?: string;
    errorCode?: string | number;
    retryCount?: number;
    fallbackReason?: string;
    requestId?: string;
    headers?: Record<string, string>;
  };
}
