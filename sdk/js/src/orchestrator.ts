/**
 * Synapse Agent Orchestration Template
 * High-throughput async agent processing
 */

import { Synapse } from '@synapse/sdk';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

interface AgentTask {
  id: string;
  prompt: string;
  model: string;
  maxTokens: number;
  priority: number;
  retries: number;
}

interface AgentConfig {
  synapseApiKey: string;
  redisUrl: string;
  concurrency: number;
  maxQueueSize: number;
}

/**
 * High-throughput agent orchestrator
 * Processes thousands of tasks through Synapse Network
 */
export class SynapseAgentOrchestrator {
  private synapse: Synapse;
  private redis: IORedis;
  private taskQueue: Queue<AgentTask>;
  private worker: Worker<AgentTask>;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    
    this.synapse = new Synapse({
      apiKey: config.synapseApiKey,
      maxRetries: 3
    });
    
    this.redis = new IORedis(config.redisUrl);
    
    this.taskQueue = new Queue<AgentTask>('synapse-tasks', {
      connection: this.redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      }
    });

    this.worker = new Worker<AgentTask>(
      'synapse-tasks',
      async (job) => this.processTask(job.data),
      {
        connection: this.redis,
        concurrency: config.concurrency,
        limiter: {
          max: 100,
          duration: 1000
        }
      }
    );

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      console.log(`✓ Task ${job.data.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`✗ Task ${job?.data.id} failed:`, err.message);
    });
  }

  private async processTask(task: AgentTask): Promise<string> {
    const startTime = Date.now();
    
    try {
      const response = await this.synapse.chat.completions.create({
        model: task.model,
        messages: [{ role: 'user', content: task.prompt }],
        max_tokens: task.maxTokens
      });

      const latency = Date.now() - startTime;
      const content = response.choices[0]?.message?.content || '';

      // Store result
      await this.redis.setex(
        `result:${task.id}`,
        3600, // 1 hour TTL
        JSON.stringify({
          content,
          latency,
          tokens: response.usage.total_tokens,
          model: response.model,
          timestamp: Date.now()
        })
      );

      return content;
    } catch (error) {
      console.error(`Task ${task.id} failed:`, error);
      throw error;
    }
  }

  /**
   * Submit a batch of tasks
   */
  async submitBatch(tasks: Omit<AgentTask, 'id'>[]): Promise<string[]> {
    const jobIds: string[] = [];
    
    for (const task of tasks) {
      const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const job = await this.taskQueue.add(
        'process',
        { ...task, id },
        { priority: task.priority }
      );
      
      jobIds.push(id);
    }
    
    return jobIds;
  }

  /**
   * Get results for completed tasks
   */
  async getResults(taskIds: string[]): Promise<Array<{
    id: string;
    content?: string;
    error?: string;
    pending: boolean;
  }>> {
    const pipeline = this.redis.pipeline();
    
    for (const id of taskIds) {
      pipeline.get(`result:${id}`);
    }
    
    const results = await pipeline.exec();
    
    return results?.map((result, index) => {
      const [err, value] = result;
      const id = taskIds[index];
      
      if (err || !value) {
        return { id, pending: true };
      }
      
      try {
        const parsed = JSON.parse(value as string);
        return { id, content: parsed.content, pending: false };
      } catch {
        return { id, pending: true };
      }
    }) || [];
  }

  /**
   * Wait for all tasks to complete
   */
  async waitForCompletion(
    taskIds: string[],
    timeoutMs: number = 60000
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const results = await this.getResults(taskIds);
      const pending = results.filter(r => r.pending).length;
      
      if (pending === 0) {
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('Timeout waiting for task completion');
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.taskQueue.getWaitingCount(),
      this.taskQueue.getActiveCount(),
      this.taskQueue.getCompletedCount(),
      this.taskQueue.getFailedCount()
    ]);
    
    return { waiting, active, completed, failed };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    await this.worker.close();
    await this.taskQueue.close();
    await this.redis.quit();
  }
}

// Example usage
async function main() {
  const orchestrator = new SynapseAgentOrchestrator({
    synapseApiKey: process.env.SYNAPSE_API_KEY || '',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    concurrency: 50,
    maxQueueSize: 10000
  });

  // Submit 1000 tasks
  const prompts = Array.from({ length: 1000 }, (_, i) => ({
    prompt: `Task ${i}: Analyze the following data...`,
    model: 'deepseek-v3',
    maxTokens: 500,
    priority: 5,
    retries: 3
  }));

  console.log('Submitting batch...');
  const taskIds = await orchestrator.submitBatch(prompts);
  
  console.log(`Submitted ${taskIds.length} tasks`);
  
  // Wait for completion
  await orchestrator.waitForCompletion(taskIds, 120000);
  
  // Get results
  const results = await orchestrator.getResults(taskIds);
  const completed = results.filter(r => !r.pending).length;
  
  console.log(`Completed: ${completed}/${taskIds.length}`);
  
  await orchestrator.shutdown();
}

if (require.main === module) {
  main().catch(console.error);
}
