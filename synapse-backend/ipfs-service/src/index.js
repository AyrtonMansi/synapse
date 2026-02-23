const express = require('express');
const { create } = require('ipfs-http-client');
const winston = require('winston');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

const app = express();
app.use(express.json({ limit: '50mb' }));

// Multi-node IPFS configuration for decentralization
const IPFS_NODES = [
  process.env.IPFS_API_URL || 'http://localhost:5001',
  process.env.IPFS_BACKUP_URL_1,
  process.env.IPFS_BACKUP_URL_2,
  // Public gateways as fallback
  'https://ipfs.io',
  'https://cloudflare-ipfs.com',
  'https://gateway.pinata.cloud'
].filter(Boolean);

// Create IPFS clients for each node
const ipfsClients = IPFS_NODES.map(url => {
  try {
    return { url, client: create({ url }) };
  } catch (e) {
    logger.warn(`Failed to create IPFS client for ${url}`);
    return null;
  }
}).filter(Boolean);

// Get healthy IPFS client with round-robin
let currentClientIndex = 0;
function getHealthyClient() {
  if (ipfsClients.length === 0) {
    throw new Error('No IPFS clients available');
  }
  
  // Try each client until we find a healthy one
  for (let i = 0; i < ipfsClients.length; i++) {
    const idx = (currentClientIndex + i) % ipfsClients.length;
    const { client, url } = ipfsClients[idx];
    currentClientIndex = (idx + 1) % ipfsClients.length;
    return { client, url };
  }
  
  throw new Error('No healthy IPFS clients available');
}

// Try all clients for an operation
async function tryAllClients(operation) {
  const errors = [];
  
  for (const { client, url } of ipfsClients) {
    try {
      const result = await operation(client);
      return { result, url };
    } catch (error) {
      errors.push({ url, error: error.message });
    }
  }
  
  throw new Error(`All IPFS clients failed: ${JSON.stringify(errors)}`);
}

// Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Decentralized authentication via SIWE
async function verifySignature(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(); // Allow anonymous reads
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Verify EIP-191 signature
    const message = JSON.parse(Buffer.from(token, 'base64').toString());
    const recovered = ethers.verifyMessage(message.message, message.signature);
    
    if (recovered.toLowerCase() !== message.address.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    req.walletAddress = message.address;
    req.signatureExpiry = message.expiry;
    
    next();
  } catch (error) {
    logger.error('Auth verification failed:', error);
    return res.status(401).json({ error: 'Invalid authentication' });
  }
}

// Health check - reports status of all nodes
app.get('/health', async (req, res) => {
  const nodeStatuses = await Promise.all(
    ipfsClients.map(async ({ url, client }) => {
      try {
        const id = await client.id();
        return { url, status: 'healthy', peerId: id.id };
      } catch (error) {
        return { url, status: 'unhealthy', error: error.message };
      }
    })
  );
  
  const healthyCount = nodeStatuses.filter(n => n.status === 'healthy').length;
  
  res.status(healthyCount > 0 ? 200 : 503).json({
    status: healthyCount > 0 ? 'healthy' : 'degraded',
    nodes: nodeStatuses,
    healthyNodes: healthyCount,
    totalNodes: nodeStatuses.length
  });
});

// Upload content with multi-node replication
app.post('/upload', upload.single('file'), verifySignature, async (req, res) => {
  try {
    let content;
    
    if (req.file) {
      content = fs.readFileSync(req.file.path);
      fs.unlinkSync(req.file.path);
    } else if (req.body.content) {
      content = Buffer.from(JSON.stringify(req.body.content));
    } else {
      return res.status(400).json({ error: 'No content provided' });
    }
    
    // Upload to primary node
    const { result, url: primaryUrl } = await tryAllClients(async (client) => {
      return await client.add(content, { pin: true });
    });
    
    const cid = result.cid.toString();
    
    // Replicate to other nodes in background
    const replicationPromises = ipfsClients
      .filter(c => c.url !== primaryUrl)
      .map(async ({ client, url }) => {
        try {
          await client.pin.add(cid);
          logger.info(`Replicated ${cid} to ${url}`);
          return { url, success: true };
        } catch (error) {
          logger.error(`Replication failed to ${url}:`, error.message);
          return { url, success: false, error: error.message };
        }
      });
    
    // Don't await replication, return immediately
    Promise.all(replicationPromises).then(results => {
      logger.info(`Replication complete for ${cid}`, { results });
    });
    
    res.json({
      cid,
      size: result.size,
      path: result.path,
      replicated: ipfsClients.length,
      primary: primaryUrl
    });
  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload JSON directly
app.post('/upload/json', verifySignature, async (req, res) => {
  try {
    const content = Buffer.from(JSON.stringify(req.body));
    
    const { result } = await tryAllClients(async (client) => {
      return await client.add(content, { pin: true });
    });
    
    const cid = result.cid.toString();
    logger.info(`JSON uploaded: ${cid}`);
    
    res.json({ cid, size: result.size });
  } catch (error) {
    logger.error('JSON upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get content with multi-node fallback
app.get('/content/:cid', async (req, res) => {
  try {
    const { cid } = req.params;
    const errors = [];
    
    // Try each node
    for (const { client, url } of ipfsClients) {
      try {
        const chunks = [];
        for await (const chunk of client.cat(cid)) {
          chunks.push(chunk);
        }
        
        const content = Buffer.concat(chunks);
        res.set('Content-Type', 'application/octet-stream');
        res.set('X-IPFS-Source', url);
        return res.send(content);
      } catch (error) {
        errors.push({ url, error: error.message });
      }
    }
    
    // Try public gateways
    const gateways = [
      `https://ipfs.io/ipfs/${cid}`,
      `https://cloudflare-ipfs.com/ipfs/${cid}`,
      `https://gateway.pinata.cloud/ipfs/${cid}`
    ];
    
    for (const gateway of gateways) {
      try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(gateway);
        if (response.ok) {
          const content = await response.buffer();
          res.set('Content-Type', 'application/octet-stream');
          res.set('X-IPFS-Source', gateway);
          return res.send(content);
        }
      } catch (error) {
        errors.push({ url: gateway, error: error.message });
      }
    }
    
    throw new Error(`Content not found on any node: ${JSON.stringify(errors)}`);
  } catch (error) {
    logger.error('Content retrieval error:', error);
    res.status(404).json({ error: 'Content not found' });
  }
});

// Get JSON content
app.get('/json/:cid', async (req, res) => {
  try {
    const { cid } = req.params;
    const errors = [];
    
    for (const { client, url } of ipfsClients) {
      try {
        const chunks = [];
        for await (const chunk of client.cat(cid)) {
          chunks.push(chunk);
        }
        
        const content = Buffer.concat(chunks).toString();
        const json = JSON.parse(content);
        
        res.set('X-IPFS-Source', url);
        return res.json(json);
      } catch (error) {
        errors.push({ url, error: error.message });
      }
    }
    
    throw new Error('Content not found');
  } catch (error) {
    logger.error('JSON retrieval error:', error);
    res.status(404).json({ error: 'Content not found or invalid JSON' });
  }
});

// Pin CID across all nodes
app.post('/pin/:cid', verifySignature, async (req, res) => {
  try {
    const { cid } = req.params;
    const results = [];
    
    for (const { client, url } of ipfsClients) {
      try {
        await client.pin.add(cid);
        results.push({ url, success: true });
      } catch (error) {
        results.push({ url, success: false, error: error.message });
      }
    }
    
    logger.info(`CID pinned: ${cid}`, { results });
    
    res.json({ pinned: true, cid, nodes: results });
  } catch (error) {
    logger.error('Pin error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unpin CID
app.post('/unpin/:cid', verifySignature, async (req, res) => {
  try {
    const { cid } = req.params;
    const results = [];
    
    for (const { client, url } of ipfsClients) {
      try {
        await client.pin.rm(cid);
        results.push({ url, success: true });
      } catch (error) {
        results.push({ url, success: false, error: error.message });
      }
    }
    
    logger.info(`CID unpinned: ${cid}`, { results });
    
    res.json({ unpinned: true, cid, nodes: results });
  } catch (error) {
    logger.error('Unpin error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List pinned CIDs from all nodes
app.get('/pins', async (req, res) => {
  try {
    const allPins = new Map();
    
    for (const { client, url } of ipfsClients) {
      try {
        for await (const pin of client.pin.ls()) {
          const cid = pin.cid.toString();
          if (!allPins.has(cid)) {
            allPins.set(cid, { cid, type: pin.type, nodes: [] });
          }
          allPins.get(cid).nodes.push(url);
        }
      } catch (error) {
        logger.error(`Failed to list pins from ${url}:`, error.message);
      }
    }
    
    res.json({ pins: Array.from(allPins.values()) });
  } catch (error) {
    logger.error('List pins error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get aggregated stats from all nodes
app.get('/stats', async (req, res) => {
  try {
    const nodeStats = await Promise.all(
      ipfsClients.map(async ({ client, url }) => {
        try {
          const stats = await client.stats.repo();
          return {
            url,
            available: true,
            numObjects: stats.numObjects,
            repoSize: stats.repoSize,
            storageMax: stats.storageMax,
            version: stats.version
          };
        } catch (error) {
          return { url, available: false, error: error.message };
        }
      })
    );
    
    res.json({ nodes: nodeStats });
  } catch (error) {
    logger.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5002;

app.listen(PORT, () => {
  logger.info(`Decentralized IPFS Service listening on port ${PORT}`);
  logger.info(`Connected to ${ipfsClients.length} IPFS nodes`);
});
