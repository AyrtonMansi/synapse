const ROUTER_URL = process.env.ROUTER_URL || 'http://localhost:3002';
const ROUTER_TIMEOUT = parseInt(process.env.ROUTER_TIMEOUT || '30000'); // 30s default
const ROUTER_SECRET = process.env.ROUTER_SECRET; // Optional auth secret

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
  job_id?: string;
  prompt_hash?: string;
  output_hash?: string;
  ts?: number;
}

/**
 * Dispatch a job to the router with timeout and optional auth
 */
export async function dispatchJob(input: DispatchJobInput): Promise<DispatchJobResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ROUTER_TIMEOUT);
  
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Add auth header if router secret is configured
    if (ROUTER_SECRET) {
      headers['X-Router-Secret'] = ROUTER_SECRET;
    }
    
    const response = await fetch(`${ROUTER_URL}/dispatch`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      let errorMessage = 'Job dispatch failed';
      try {
        const error = await response.json();
        errorMessage = error.message || error.error || errorMessage;
      } catch {
        // Response body wasn't valid JSON
        errorMessage = `${errorMessage} (HTTP ${response.status})`;
      }
      throw new Error(errorMessage);
    }
    
    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`Router request timed out after ${ROUTER_TIMEOUT}ms`);
      }
      throw error;
    }
    throw new Error('Unknown error dispatching job');
  }
}