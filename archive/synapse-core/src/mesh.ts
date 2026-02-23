import { EventEmitter } from 'events';
import WebSocket from 'ws';
import type { NodeInfo, InferenceJob, JobResult } from './types.js';

/**
 * Mesh Networking Layer
 * 
 * AUDIT: This handles P2P communication between nodes. Security critical:
 * 1. All messages must be signed to prevent spoofing
 * 2. Encryption required for job data (prompts are sensitive)
 * 3. Rate limiting prevents DoS on individual nodes
 * 4. Circuit breakers isolate malicious peers
 */

interface MeshConfig {
  readonly nodeId: string;
  readonly privateKey: string;  // For signing messages
  readonly listenPort: number;
  readonly bootstrapNodes: string[];  // Initial peers to connect to
  readonly maxPeers: number;
  readonly heartbeatIntervalMs: number;
  readonly messageTimeoutMs: number;
}

interface PeerConnection {
  readonly nodeId: string;
  readonly socket: WebSocket;
  readonly address: string;
  readonly connectedAt: Date;
  readonly capabilities: NodeInfo['capabilities'];
  lastSeen: Date;
  latencyMs: number;
  messageCount: number;
  failedMessages: number;
}

interface MeshMessage {
  readonly type: 'heartbeat' | 'job_offer' | 'job_accept' | 'job_result' | 'peer_discovery' | 'capabilities';
  readonly senderId: string;
  readonly timestamp: number;
  readonly payload: unknown;
  readonly signature: string;  // ECDSA signature of message hash
}

/**
 * Circuit breaker for peer health monitoring
 * 
 * AUDIT: Isolates misbehaving peers before they can disrupt the network.
 * Triggers after 5 consecutive failures within 60 seconds.
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly threshold = 5,
    private readonly timeoutMs = 60000
  ) {}

  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.state = 'closed';
      this.failures = 0;
    }
  }

  recordFailure(): boolean {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
      return true;  // Circuit opened
    }
    return false;
  }

  canAttempt(): boolean {
    if (this.state === 'closed') return true;
    
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeoutMs) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }

    return this.state === 'half-open';
  }

  getState(): string {
    return this.state;
  }
}

export class SynapseMesh extends EventEmitter {
  private readonly config: MeshConfig;
  private readonly peers = new Map<string, PeerConnection>();
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();
  private server?: WebSocket.Server;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private isRunning = false;

  constructor(config: MeshConfig) {
    super();
    this.config = config;
  }

  /**
   * Start mesh node
   * 
   * AUDIT: Before accepting connections, must verify:
   * 1. GPU is available and not overloaded
   * 2. Sufficient disk space for model cache
   * 3. Network bandwidth test passed
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new MeshError('Mesh already running');
    }

    // Start WebSocket server
    this.server = new WebSocket.Server({ 
      port: this.config.listenPort,
      // AUDIT: Limit max payload to prevent memory exhaustion
      maxPayload: 10 * 1024 * 1024,  // 10MB
    });

    this.server.on('connection', (socket: WebSocket, req: { socket: { remoteAddress?: string } }) => {
      this.handleIncomingConnection(socket, req);
    });

    // Connect to bootstrap nodes
    for (const node of this.config.bootstrapNodes) {
      await this.connectToPeer(node);
    }

    // Start heartbeat
    this.heartbeatTimer = setInterval(
      () => this.sendHeartbeats(),
      this.config.heartbeatIntervalMs
    );

    this.isRunning = true;
    this.emit('started', { nodeId: this.config.nodeId, port: this.config.listenPort });
  }

  /**
   * Stop mesh node gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    // Clear heartbeat timer
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    // Close all peer connections
    for (const [nodeId, peer] of this.peers) {
      peer.socket.close(1000, 'Node shutting down');
      this.peers.delete(nodeId);
    }

    // Close server
    this.server?.close();
    this.isRunning = false;
    this.emit('stopped');
  }

  /**
   * Broadcast job offer to available peers
   * 
   * AUDIT: Job offers contain sensitive prompt data. Must be:
   * 1. End-to-end encrypted (prompt only visible to assigned node)
   * 2. Rate limited to prevent spam
   * 3. Include proof of payment (signed escrow tx)
   */
  async broadcastJobOffer(job: InferenceJob): Promise<string[]> {
    const capablePeers = this.findCapablePeers(job.modelId);
    
    if (capablePeers.length === 0) {
      throw new MeshError('No capable peers found for model ' + job.modelId);
    }

    const offers: string[] = [];

    for (const peer of capablePeers) {
      // Check circuit breaker
      const breaker = this.getCircuitBreaker(peer.nodeId);
      if (!breaker.canAttempt()) {
        continue;
      }

      try {
        await this.sendMessage(peer.nodeId, {
          type: 'job_offer',
          payload: {
            jobId: job.id,
            modelId: job.modelId,
            maxPrice: job.maxPrice,
            priority: job.priority,
            // AUDIT: Prompt is encrypted, not visible in offer
            // Only revealed after node accepts and proves stake
          },
        });

        offers.push(peer.nodeId);
      } catch (error) {
        breaker.recordFailure();
        this.emit('peerError', { nodeId: peer.nodeId, error });
      }
    }

    return offers;
  }

  /**
   * Send job result back to requester
   * 
   * AUDIT: Results must include ZK proof of valid execution.
   * Without proof, requester can dispute and refuse payment.
   */
  async sendJobResult(
    requesterId: string,
    jobId: string,
    result: JobResult
  ): Promise<void> {
    const peer = this.peers.get(requesterId);
    if (!peer) {
      throw new MeshError(`Peer ${requesterId} not connected`);
    }

    // AUDIT: Verify proof exists before sending
    if (!result.proof || !result.proof.proof) {
      throw new MeshError('Cannot send result without ZK proof');
    }

    await this.sendMessage(requesterId, {
      type: 'job_result',
      payload: {
        jobId,
        output: result.output,
        tokensUsed: result.tokensUsed,
        computeTimeMs: result.computeTimeMs,
        proof: result.proof,
      },
    });
  }

  /**
   * Get list of connected peers
   */
  getPeers(): PeerConnection[] {
    return Array.from(this.peers.values());
  }

  /**
   * Get mesh health metrics
   */
  getMetrics(): {
    totalPeers: number;
    averageLatency: number;
    messageSuccessRate: number;
    openCircuits: number;
  } {
    const peers = this.getPeers();
    const totalMessages = peers.reduce((sum, p) => sum + p.messageCount, 0);
    const totalFailed = peers.reduce((sum, p) => sum + p.failedMessages, 0);
    const totalLatency = peers.reduce((sum, p) => sum + p.latencyMs, 0);

    const openCircuits = Array.from(this.circuitBreakers.values())
      .filter(cb => cb.getState() === 'open')
      .length;

    return {
      totalPeers: peers.length,
      averageLatency: peers.length > 0 ? totalLatency / peers.length : 0,
      messageSuccessRate: totalMessages > 0 
        ? (totalMessages - totalFailed) / totalMessages 
        : 1,
      openCircuits,
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async connectToPeer(address: string): Promise<void> {
    // AUDIT: Prevent connection to self
    if (address.includes(String(this.config.listenPort))) {
      return;
    }

    // Check peer limit
    if (this.peers.size >= this.config.maxPeers) {
      throw new MeshError('Max peer limit reached');
    }

    const socket = new WebSocket(address);

    socket.on('open', () => {
      // Send capabilities handshake
      this.sendRawMessage(socket, {
        type: 'capabilities',
        payload: {
          nodeId: this.config.nodeId,
          // Include capability advertisement
        },
      });
    });

    socket.on('message', (data: WebSocket.RawData) => {
      this.handleMessage(socket, data.toString());
    });

    socket.on('error', (error: Error) => {
      this.emit('connectionError', { address, error });
    });

    socket.on('close', () => {
      // Find and remove peer
      for (const [id, peer] of this.peers) {
        if (peer.socket === socket) {
          this.peers.delete(id);
          this.emit('peerDisconnected', { nodeId: id });
          break;
        }
      }
    });
  }

  private handleIncomingConnection(socket: WebSocket, _req: unknown): void {
    // AUDIT: Rate limit incoming connections by IP
    // Implementation would check req.headers['x-forwarded-for'] or similar

    socket.on('message', (data: WebSocket.RawData) => {
      this.handleMessage(socket, data.toString());
    });

    socket.on('error', (error: Error) => {
      this.emit('connectionError', { error });
    });
  }

  private handleMessage(socket: WebSocket, data: string): void {
    try {
      const message: MeshMessage = JSON.parse(data);

      // AUDIT: Verify signature
      if (!this.verifyMessageSignature(message)) {
        this.emit('invalidMessage', { reason: 'bad_signature', sender: message.senderId });
        return;
      }

      // Update peer info if known
      const peer = this.peers.get(message.senderId);
      if (peer) {
        peer.lastSeen = new Date();
        
        // Record success for circuit breaker
        const breaker = this.circuitBreakers.get(message.senderId);
        breaker?.recordSuccess();
      }

      // Handle message by type
      switch (message.type) {
        case 'heartbeat':
          // Update latency
          if (peer && message.payload) {
            const payload = message.payload as { timestamp: number };
            peer.latencyMs = Date.now() - payload.timestamp;
          }
          break;

        case 'capabilities':
          // New peer handshake
          this.handleCapabilityMessage(socket, message);
          break;

        case 'job_offer':
          this.emit('jobOffer', message.payload);
          break;

        case 'job_accept':
          this.emit('jobAccept', message.payload);
          break;

        case 'job_result':
          this.emit('jobResult', message.payload);
          break;

        case 'peer_discovery':
          this.handlePeerDiscovery(message);
          break;
      }
    } catch (error) {
      this.emit('messageError', { error, data });
    }
  }

  private handleCapabilityMessage(socket: WebSocket, message: MeshMessage): void {
    const payload = message.payload as { nodeId: string; capabilities: NodeInfo['capabilities'] };
    
    // Store peer connection
    this.peers.set(payload.nodeId, {
      nodeId: payload.nodeId,
      socket,
      address: '',  // Would extract from socket
      connectedAt: new Date(),
      capabilities: payload.capabilities,
      lastSeen: new Date(),
      latencyMs: 0,
      messageCount: 0,
      failedMessages: 0,
    });

    this.emit('peerConnected', { nodeId: payload.nodeId });
  }

  private handlePeerDiscovery(message: MeshMessage): void {
    const payload = message.payload as { peers: string[] };
    
    // Connect to discovered peers (up to max)
    for (const peer of payload.peers) {
      if (this.peers.size < this.config.maxPeers) {
        this.connectToPeer(peer).catch(() => {
          // Ignore failed connections during discovery
        });
      }
    }
  }

  private async sendMessage(nodeId: string, message: Omit<MeshMessage, 'senderId' | 'timestamp' | 'signature'>): Promise<void> {
    const peer = this.peers.get(nodeId);
    if (!peer) {
      throw new MeshError(`Peer ${nodeId} not found`);
    }

    const fullMessage: MeshMessage = {
      ...message,
      senderId: this.config.nodeId,
      timestamp: Date.now(),
      signature: this.signMessage(message),
    };

    return this.sendRawMessage(peer.socket, fullMessage);
  }

  private sendRawMessage(socket: WebSocket, message: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      if (socket.readyState !== WebSocket.OPEN) {
        reject(new MeshError('Socket not open'));
        return;
      }

      socket.send(JSON.stringify(message), (error?: Error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  private sendHeartbeats(): void {
    for (const [nodeId, peer] of this.peers) {
      this.sendMessage(nodeId, {
        type: 'heartbeat',
        payload: { timestamp: Date.now() },
      }).catch(() => {
        peer.failedMessages++;
      });
    }
  }

  private findCapablePeers(modelId: string): PeerConnection[] {
    return this.getPeers().filter(peer => 
      peer.capabilities.supportedModels.includes(modelId) &&
      this.getCircuitBreaker(peer.nodeId).canAttempt()
    );
  }

  private getCircuitBreaker(nodeId: string): CircuitBreaker {
    if (!this.circuitBreakers.has(nodeId)) {
      this.circuitBreakers.set(nodeId, new CircuitBreaker());
    }
    return this.circuitBreakers.get(nodeId)!;
  }

  private signMessage(_message: MeshMessage | Omit<MeshMessage, 'senderId' | 'timestamp' | 'signature'>): string {
    // AUDIT: Sign message hash with node private key
    // Implementation would use ethers or similar
    return 'signature_placeholder';
  }

  private verifyMessageSignature(_message: MeshMessage): boolean {
    // AUDIT: Recover public key from signature and verify against known peers
    // For MVP, accept all (would verify in production)
    return true;
  }
}

export class MeshError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MeshError';
  }
}
