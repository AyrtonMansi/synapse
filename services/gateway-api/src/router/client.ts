const ROUTER_URL = process.env.ROUTER_URL || 'http://localhost:3002';

interface DispatchJobInput {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

interface DispatchJobResult {
  content: string;
  node_id: string;
  model: string;
}

export async function dispatchJob(input: DispatchJobInput): Promise<DispatchJobResult> {
  // Call router to dispatch job to available node
  const response = await fetch(`${ROUTER_URL}/dispatch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Job dispatch failed');
  }
  
  return response.json();
}