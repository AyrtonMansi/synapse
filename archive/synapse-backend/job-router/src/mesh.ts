import { createLibp2p, Libp2pOptions } from 'libp2p';
import { tcp } from '@libp2p/tcp';
import { webSockets } from '@libp2p/websockets';
import { noise } from '@libp2p/noise';
import { mplex } from '@libp2p/mplex';
import { gossipsub, GossipSub } from '@libp2p/gossipsub';
import { kadDHT } from '@libp2p/kad-dht';
import { bootstrap } from '@libp2p/bootstrap';
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery';
import type { Libp2p } from '@libp2p/interface';
import { Multiaddr } from '@multiformats/multiaddr';
import { CID } from 'multiformats/cid';
import * as json from 'multiformats/codecs/json';
import { sha256 } from 'multiformats/hashes/sha2';
import EventEmitter from 'events';

// Types
export interface JobMessage {
  type: 'job_request' | 'job_offer' | 'job_accept' | 'job_result' | 'heartbeat' | 'reputation_update';
  jobId?: string;
  payload: any;
  timestamp: number;
  signature?: string;
  from: string; // peer id
}

export interface MeshNode {
  id: string;
  multiaddrs: string[];
  capabilities: string[];
  reputation: number;
  lastSeen: number;
  activeJobs: number;
  version: string;
}

export interface JobOffer {
  jobId: string;
  jobType: string;
  inputCid: string;
  payment: string;
  timeout: number;
  requirements: {
    minReputation: number;
    capabilities: string[];
  };
}

export class P2PMesh extends EventEmitter {
  private node: Libp2p | null = null;
  private gossip: GossipSub | null = null;
  private knownNodes: Map<string, MeshNode> = new Map();
  private activeJobs: Map<string, any> = new Map();
  private reputationScores: Map<string, number> = new Map();
  private readonly bootstrapPeers: string[];
  private readonly networkId: string;
  
  constructor(options: {
    bootstrapPeers?: string[];
    networkId?: string;
  } = {}) {
    super();
    this.bootstrapPeers = options.bootstrapPeers || [];
    this.networkId = options.networkId || 'synapse-mainnet-v1';
  }

  /**
   * Initialize and start the P2P node
   */
  async start(listenAddrs: string[] = ['/ip4/0.0.0.0/tcp/0']): Promise<void> {
    const config: Libp2pOptions = {
      addresses: {
        listen: listenAddrs
      },
      transports: [tcp(), webSockets()],
      connectionEncryption: [noise()],
      streamMuxers: [mplex()],
      peerDiscovery: [
        pubsubPeerDiscovery({
          interval: 5000,
          topics: [`synapse-${this.networkId}-peer-discovery`]
        }),
        ...(this.bootstrapPeers.length > 0 ? [bootstrap({ list: this.bootstrapPeers })] : [])
      ],
      services: {
        pubsub: gossipsub({
          emitSelf: false,
          gossipIncoming: true,
          fallbackToFloodsub: true,
          allowedTopics: [
            `synapse-${this.networkId}-jobs`,
            `synapse-${this.networkId}-reputation`,
            `synapse-${this.networkId}-heartbeat`
          ]
        }),
        dht: kadDHT({
          clientMode: false
        })
      }
    };

    this.node = await createLibp2p(config);
    this.gossip = this.node.services.pubsub as GossipSub;

    // Set up event handlers
    this.setupEventHandlers();

    // Start the node
    await this.node.start();

    // Subscribe to topics
    await this.subscribeToTopics();

    this.emit('started', {
      peerId: this.node.peerId.toString(),
      multiaddrs: this.node.getMultiaddrs().map(ma => ma.toString())
    });

    console.log(`[Mesh] Node started: ${this.node.peerId.toString()}`);
  }

  /**
   * Stop the P2P node
   */
  async stop(): Promise<void> {
    if (this.node) {
      await this.node.stop();
      this.emit('stopped');
      console.log('[Mesh] Node stopped');
    }
  }

  /**
   * Set up libp2p event handlers
   */
  private setupEventHandlers(): void {
    if (!this.node) return;

    // Handle new peer connections
    this.node.addEventListener('peer:connect', (evt) => {
      const peerId = evt.detail.toString();
      console.log(`[Mesh] Peer connected: ${peerId}`);
      this.emit('peer:connect', peerId);
      this.requestNodeInfo(peerId);
    });

    // Handle peer disconnections
    this.node.addEventListener('peer:disconnect', (evt) => {
      const peerId = evt.detail.toString();
      console.log(`[Mesh] Peer disconnected: ${peerId}`);
      this.emit('peer:disconnect', peerId);
      
      // Update node status
      const node = this.knownNodes.get(peerId);
      if (node) {
        node.activeJobs = 0;
        this.knownNodes.set(peerId, node);
      }
    });

    // Handle pubsub messages
    if (this.gossip) {
      this.gossip.addEventListener('message', (evt) => {
        this.handleGossipMessage(evt.detail);
      });
    }
  }

  /**
   * Subscribe to gossip topics
   */
  private async subscribeToTopics(): Promise<void> {
    if (!this.gossip) return;

    const topics = [
      `synapse-${this.networkId}-jobs`,
      `synapse-${this.networkId}-reputation`,
      `synapse-${this.networkId}-heartbeat`
    ];

    for (const topic of topics) {
      await this.gossip.subscribe(topic);
      console.log(`[Mesh] Subscribed to: ${topic}`);
    }
  }

  /**
   * Handle incoming gossip messages
   */
  private handleGossipMessage(message: any): void {
    try {
      const data = JSON.parse(new TextDecoder().decode(message.data));
      const msg: JobMessage = {
        ...data,
        from: message.from.toString()
      };

      console.log(`[Mesh] Received ${msg.type} from ${msg.from}`);

      switch (msg.type) {
        case 'job_request':
          this.handleJobRequest(msg);
          break;
        case 'job_offer':
          this.handleJobOffer(msg);
          break;
        case 'job_accept':
          this.handleJobAccept(msg);
          break;
        case 'job_result':
          this.handleJobResult(msg);
          break;
        case 'heartbeat':
          this.handleHeartbeat(msg);
          break;
        case 'reputation_update':
          this.handleReputationUpdate(msg);
          break;
      }

      this.emit('message', msg);
    } catch (error) {
      console.error('[Mesh] Error handling message:', error);
    }
  }

  /**
   * Broadcast job to the network
   */
  async broadcastJob(job: JobOffer): Promise<void> {
    const message: JobMessage = {
      type: 'job_request',
      jobId: job.jobId,
      payload: job,
      timestamp: Date.now(),
      from: this.node!.peerId.toString()
    };

    await this.publish(`synapse-${this.networkId}-jobs`, message);
    console.log(`[Mesh] Broadcasted job: ${job.jobId}`);
  }

  /**
   * Send job offer to specific peer
   */
  async sendJobOffer(peerId: string, job: JobOffer): Promise<void> {
    const message: JobMessage = {
      type: 'job_offer',
      jobId: job.jobId,
      payload: job,
      timestamp: Date.now(),
      from: this.node!.peerId.toString()
    };

    // Send directly via libp2p stream
    await this.sendDirectMessage(peerId, message);
  }

  /**
   * Accept a job offer
   */
  async acceptJob(jobId: string, to: string): Promise<void> {
    const message: JobMessage = {
      type: 'job_accept',
      jobId,
      payload: {
        acceptor: this.node!.peerId.toString(),
        estimatedTime: 300 // 5 minutes default
      },
      timestamp: Date.now(),
      from: this.node!.peerId.toString()
    };

    await this.sendDirectMessage(to, message);
    
    // Track active job
    this.activeJobs.set(jobId, {
      status: 'accepted',
      worker: this.node!.peerId.toString(),
      startedAt: Date.now()
    });
  }

  /**
   * Submit job result
   */
  async submitResult(jobId: string, resultCid: string, to: string): Promise<void> {
    const message: JobMessage = {
      type: 'job_result',
      jobId,
      payload: {
        resultCid,
        completedAt: Date.now()
      },
      timestamp: Date.now(),
      from: this.node!.peerId.toString()
    };

    await this.sendDirectMessage(to, message);
    
    this.activeJobs.delete(jobId);
    console.log(`[Mesh] Submitted result for job: ${jobId}`);
  }

  /**
   * Publish message to gossip topic
   */
  private async publish(topic: string, message: JobMessage): Promise<void> {
    if (!this.gossip) return;
    
    const data = new TextEncoder().encode(JSON.stringify(message));
    await this.gossip.publish(topic, data);
  }

  /**
   * Send direct message to peer
   */
  private async sendDirectMessage(peerId: string, message: JobMessage): Promise<void> {
    if (!this.node) return;

    const peer = await this.node.peerStore.get(new (await import('@libp2p/peer-id-factory')).createFromString(peerId));
    
    const stream = await this.node.dialProtocol(peer.id, '/synapse/1.0.0');
    
    const data = new TextEncoder().encode(JSON.stringify(message));
    await stream.sink([data]);
    
    await stream.close();
  }

  /**
   * Request node info from peer
   */
  private async requestNodeInfo(peerId: string): Promise<void> {
    // Implementation would request capabilities via direct message
  }

  /**
   * Handle job request (as a worker node)
   */
  private handleJobRequest(msg: JobMessage): void {
    const job: JobOffer = msg.payload;
    
    // Check if we can handle this job
    const canHandle = this.canHandleJob(job);
    
    if (canHandle) {
      // Send offer back to requester
      this.sendJobOffer(msg.from, job);
    }
  }

  /**
   * Handle job offer (as job creator)
   */
  private handleJobOffer(msg: JobMessage): void {
    // Validate offer and potentially accept
    this.emit('job:offer', {
      from: msg.from,
      job: msg.payload
    });
  }

  /**
   * Handle job acceptance
   */
  private handleJobAccept(msg: JobMessage): void {
    this.activeJobs.set(msg.jobId!, {
      status: 'assigned',
      worker: msg.from,
      acceptedAt: msg.timestamp
    });
    
    this.emit('job:accepted', {
      jobId: msg.jobId,
      worker: msg.from
    });
  }

  /**
   * Handle job result
   */
  private handleJobResult(msg: JobMessage): void {
    this.activeJobs.delete(msg.jobId!);
    
    this.emit('job:completed', {
      jobId: msg.jobId,
      resultCid: msg.payload.resultCid,
      worker: msg.from
    });
  }

  /**
   * Handle heartbeat from peers
   */
  private handleHeartbeat(msg: JobMessage): void {
    const nodeInfo: MeshNode = msg.payload;
    nodeInfo.lastSeen = Date.now();
    nodeInfo.id = msg.from;
    
    this.knownNodes.set(msg.from, nodeInfo);
  }

  /**
   * Handle reputation update
   */
  private handleReputationUpdate(msg: JobMessage): void {
    const { peerId, score, reason } = msg.payload;
    this.updateReputation(peerId, score, reason);
  }

  /**
   * Check if this node can handle a job
   */
  private canHandleJob(job: JobOffer): boolean {
    // Check capabilities, reputation requirements, etc.
    const myReputation = this.getMyReputation();
    
    if (myReputation < job.requirements.minReputation) {
      return false;
    }
    
    // Check active jobs limit
    if (this.activeJobs.size >= 5) {
      return false;
    }
    
    // Check capabilities (would be implemented based on node's actual capabilities)
    return true;
  }

  /**
   * Get this node's reputation score
   */
  getMyReputation(): number {
    const myId = this.node?.peerId.toString();
    return this.reputationScores.get(myId!) || 100; // Default starting reputation
  }

  /**
   * Get reputation for a peer
   */
  getReputation(peerId: string): number {
    return this.reputationScores.get(peerId) || 0;
  }

  /**
   * Update reputation score for a peer
   */
  updateReputation(peerId: string, delta: number, reason: string): void {
    const current = this.reputationScores.get(peerId) || 100;
    const updated = Math.max(0, Math.min(1000, current + delta));
    this.reputationScores.set(peerId, updated);
    
    console.log(`[Mesh] Reputation update: ${peerId} = ${updated} (${reason})`);
    
    // Broadcast reputation update
    this.publish(`synapse-${this.networkId}-reputation`, {
      type: 'reputation_update',
      payload: { peerId, score: updated, reason },
      timestamp: Date.now(),
      from: this.node!.peerId.toString()
    });
  }

  /**
   * Get list of known nodes
   */
  getKnownNodes(): MeshNode[] {
    return Array.from(this.knownNodes.values());
  }

  /**
   * Get best nodes for a job based on reputation and availability
   */
  getBestNodesForJob(job: JobOffer, limit: number = 5): MeshNode[] {
    return this.getKnownNodes()
      .filter(node => 
        node.reputation >= job.requirements.minReputation &&
        node.activeJobs < 5 &&
        Date.now() - node.lastSeen < 60000 // Seen in last minute
      )
      .sort((a, b) => b.reputation - a.reputation)
      .slice(0, limit);
  }

  /**
   * Get connected peers count
   */
  getPeerCount(): number {
    return this.node ? this.node.getPeers().length : 0;
  }

  /**
   * Get node info
   */
  getNodeInfo(): any {
    if (!this.node) return null;
    
    return {
      peerId: this.node.peerId.toString(),
      multiaddrs: this.node.getMultiaddrs().map(ma => ma.toString()),
      peers: this.getPeerCount(),
      knownNodes: this.knownNodes.size,
      activeJobs: this.activeJobs.size,
      reputation: this.getMyReputation()
    };
  }
}

export default P2PMesh;