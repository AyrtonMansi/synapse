/**
 * Multi-node IPFS client with redundancy and external pinning
 * Replaces single-node IPFS dependency
 */

const { create } = require('ipfs-http-client');
const axios = require('axios');

class DecentralizedIPFS {
  constructor(config = {}) {
    // Primary and fallback IPFS nodes
    this.nodes = (process.env.IPFS_NODES || 'http://localhost:5001').split(',').map(url => ({
      url: url.trim(),
      client: null,
      healthy: false,
      lastCheck: 0,
    }));

    // External pinning services
    this.pinningServices = [
      {
        name: 'pinata',
        enabled: !!process.env.PINATA_API_KEY,
        apiKey: process.env.PINATA_API_KEY,
        secret: process.env.PINATA_SECRET_KEY,
        endpoint: 'https://api.pinata.cloud/pinning/pinFileToIPFS',
      },
      {
        name: 'nftstorage',
        enabled: !!process.env.NFT_STORAGE_KEY,
        token: process.env.NFT_STORAGE_KEY,
        endpoint: 'https://api.nft.storage/upload',
      },
      {
        name: 'filebase',
        enabled: !!process.env.FILEBASE_TOKEN,
        token: process.env.FILEBASE_TOKEN,
        endpoint: 'https://pin.filebase.io/api/v0/pin/add',
      },
    ].filter(s => s.enabled);

    this.healthCheckInterval = config.healthCheckInterval || 30000;
    this.currentNodeIndex = 0;
    
    // Initialize clients
    this.initializeClients();
    
    // Start health checks
    this.startHealthChecks();
  }

  initializeClients() {
    for (const node of this.nodes) {
      try {
        node.client = create({ url: node.url });
        console.log(`IPFS client initialized: ${node.url}`);
      } catch (error) {
        console.error(`Failed to initialize IPFS client for ${node.url}:`, error.message);
      }
    }
  }

  async startHealthChecks() {
    const checkHealth = async () => {
      for (const node of this.nodes) {
        try {
          await node.client.id();
          node.healthy = true;
          node.lastCheck = Date.now();
        } catch (error) {
          node.healthy = false;
          console.warn(`IPFS node unhealthy: ${node.url}`);
        }
      }
    };

    // Initial check
    await checkHealth();
    
    // Periodic checks
    setInterval(checkHealth, this.healthCheckInterval);
  }

  /**
   * Get a healthy IPFS client
   */
  getHealthyClient() {
    // Try nodes in round-robin fashion
    for (let i = 0; i < this.nodes.length; i++) {
      const index = (this.currentNodeIndex + i) % this.nodes.length;
      const node = this.nodes[index];
      
      if (node.healthy && node.client) {
        this.currentNodeIndex = (index + 1) % this.nodes.length;
        return node.client;
      }
    }

    throw new Error('No healthy IPFS nodes available');
  }

  /**
   * Upload content to IPFS with multi-node redundancy
   */
  async upload(content, options = {}) {
    const healthyClient = this.getHealthyClient();
    
    // Add to primary IPFS
    const result = await healthyClient.add(content, {
      pin: true,
      ...options,
    });

    const cid = result.cid.toString();

    // Replicate to other healthy nodes
    this.replicateToOtherNodes(cid).catch(err => {
      console.warn('Replication to other nodes failed:', err.message);
    });

    // Pin to external services
    this.pinToExternalServices(cid, content).catch(err => {
      console.warn('External pinning failed:', err.message);
    });

    return {
      cid,
      size: result.size,
      path: result.path,
      replicated: true,
    };
  }

  /**
   * Replicate CID to other healthy IPFS nodes
   */
  async replicateToOtherNodes(cid) {
    const replicationPromises = this.nodes
      .filter(n => n.healthy && n.client)
      .map(async (node) => {
        try {
          // Get content from one node and add to another
          const chunks = [];
          for await (const chunk of this.getHealthyClient().cat(cid)) {
            chunks.push(chunk);
          }
          const content = Buffer.concat(chunks);
          
          await node.client.add(content, { pin: true });
          console.log(`Replicated ${cid} to ${node.url}`);
        } catch (error) {
          console.warn(`Failed to replicate to ${node.url}:`, error.message);
        }
      });

    await Promise.allSettled(replicationPromises);
  }

  /**
   * Pin content to external pinning services
   */
  async pinToExternalServices(cid, content) {
    const pinPromises = this.pinningServices.map(async (service) => {
      try {
        switch (service.name) {
          case 'pinata':
            await this.pinToPinata(cid, content, service);
            break;
          case 'nftstorage':
            await this.pinToNFTStorage(cid, content, service);
            break;
          case 'filebase':
            await this.pinToFilebase(cid, service);
            break;
        }
        console.log(`Pinned ${cid} to ${service.name}`);
      } catch (error) {
        console.warn(`Failed to pin to ${service.name}:`, error.message);
      }
    });

    await Promise.allSettled(pinPromises);
  }

  async pinToPinata(cid, content, service) {
    const formData = new FormData();
    formData.append('file', new Blob([content]));
    formData.append('pinataMetadata', JSON.stringify({ name: `synapse-${cid}` }));

    await axios.post(service.endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'pinata_api_key': service.apiKey,
        'pinata_secret_api_key': service.secret,
      },
    });
  }

  async pinToNFTStorage(cid, content, service) {
    await axios.post(service.endpoint, content, {
      headers: {
        'Authorization': `Bearer ${service.token}`,
        'Content-Type': 'application/octet-stream',
      },
    });
  }

  async pinToFilebase(cid, service) {
    await axios.post(service.endpoint, null, {
      params: { arg: cid },
      headers: {
        'Authorization': `Bearer ${service.token}`,
      },
    });
  }

  /**
   * Get content from IPFS with fallback
   */
  async get(cid, options = {}) {
    const errors = [];

    // Try each node in order
    for (const node of this.nodes) {
      if (!node.healthy || !node.client) continue;

      try {
        const chunks = [];
        for await (const chunk of node.client.cat(cid, options)) {
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      } catch (error) {
        errors.push({ node: node.url, error: error.message });
      }
    }

    // Try public gateways as fallback
    const publicGateways = [
      'https://ipfs.io/ipfs/',
      'https://cloudflare-ipfs.com/ipfs/',
      'https://gateway.pinata.cloud/ipfs/',
    ];

    for (const gateway of publicGateways) {
      try {
        const response = await axios.get(`${gateway}${cid}`, {
          responseType: 'arraybuffer',
          timeout: 30000,
        });
        return Buffer.from(response.data);
      } catch (error) {
        errors.push({ gateway, error: error.message });
      }
    }

    throw new Error(`Failed to retrieve ${cid} from all sources: ${JSON.stringify(errors)}`);
  }

  /**
   * Get JSON content
   */
  async getJSON(cid) {
    const content = await this.get(cid);
    return JSON.parse(content.toString());
  }

  /**
   * Health check for all nodes
   */
  async healthCheck() {
    const results = await Promise.all(
      this.nodes.map(async (node) => {
        try {
          const id = await node.client.id();
          return {
            url: node.url,
            healthy: true,
            peerId: id.id,
            addresses: id.addresses,
          };
        } catch (error) {
          return {
            url: node.url,
            healthy: false,
            error: error.message,
          };
        }
      })
    );

    const healthyNodes = results.filter(r => r.healthy).length;
    
    return {
      status: healthyNodes > 0 ? 'healthy' : 'unhealthy',
      nodes: results,
      healthyCount: healthyNodes,
      totalCount: results.length,
      pinningServices: this.pinningServices.map(s => s.name),
    };
  }

  /**
   * List pinned content across all nodes
   */
  async listPins() {
    const client = this.getHealthyClient();
    const pins = [];
    
    for await (const pin of client.pin.ls()) {
      pins.push({
        cid: pin.cid.toString(),
        type: pin.type,
      });
    }
    
    return pins;
  }
}

// Singleton instance
let ipfsClient = null;

function getDecentralizedIPFS() {
  if (!ipfsClient) {
    ipfsClient = new DecentralizedIPFS();
  }
  return ipfsClient;
}

module.exports = {
  DecentralizedIPFS,
  getDecentralizedIPFS,
};
