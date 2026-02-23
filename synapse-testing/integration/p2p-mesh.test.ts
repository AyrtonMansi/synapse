import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createLibp2p } from 'libp2p';
import { tcp } from '@libp2p/tcp';
import { webSockets } from '@libp2p/websockets';
import { P2PNetwork } from '../utils/p2p-network.js';
import { TestEnvironment } from '../utils/test-env.js';

const env = new TestEnvironment();

describe('P2P Mesh Network', () => {
  let network: P2PNetwork;
  let nodes: any[] = [];

  beforeAll(async () => {
    await env.start();
    network = new P2PNetwork();
  });

  afterAll(async () => {
    for (const node of nodes) {
      await node.stop();
    }
    await env.stop();
  });

  describe('Node Discovery', () => {
    it('should bootstrap a network with multiple nodes', async () => {
      // Create bootstrap node
      const bootstrap = await network.createNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        isBootstrap: true,
      });
      nodes.push(bootstrap);

      // Create peer nodes
      for (let i = 0; i < 4; i++) {
        const node = await network.createNode({
          listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
          bootstrapPeers: [bootstrap.getMultiaddrs()[0]],
        });
        nodes.push(node);
      }

      // Wait for discovery
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify each node has discovered peers
      for (const node of nodes.slice(1)) {
        const peers = node.getPeers();
        expect(peers.length).toBeGreaterThan(0);
      }
    });

    it('should handle node joins and leaves gracefully', async () => {
      const bootstrap = nodes[0];
      
      // Add new node
      const newNode = await network.createNode({
        listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        bootstrapPeers: [bootstrap.getMultiaddrs()[0]],
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify discovery
      expect(bootstrap.getPeers().map(p => p.toString())).toContain(
        newNode.peerId.toString()
      );

      // Remove node
      await newNode.stop();
      nodes = nodes.filter(n => n !== newNode);

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify removal
      expect(bootstrap.getPeers().map(p => p.toString())).not.toContain(
        newNode.peerId.toString()
      );
    });

    it('should support DHT-based peer discovery', async () => {
      const dhtNodes = [];
      
      for (let i = 0; i < 3; i++) {
        const node = await network.createNode({
          dht: true,
          listenAddresses: ['/ip4/127.0.0.1/tcp/0'],
        });
        dhtNodes.push(node);
      }

      // Connect nodes in a chain
      for (let i = 0; i < dhtNodes.length - 1; i++) {
        await dhtNodes[i].dial(dhtNodes[i + 1].getMultiaddrs()[0]);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Find providers via DHT
      const key = '/synapse/test-key';
      await dhtNodes[0].contentRouting.provide(Buffer.from(key));

      const providers = await dhtNodes[2].contentRouting.findProviders(Buffer.from(key));
      expect(providers.length).toBeGreaterThan(0);

      for (const node of dhtNodes) {
        await node.stop();
      }
    });
  });

  describe('Message Propagation', () => {
    it('should gossip messages across the network', async () => {
      const receivedMessages: Map<string, string[]> = new Map();
      
      // Set up message handlers
      for (const node of nodes) {
        receivedMessages.set(node.peerId.toString(), []);
        
        node.handle('/synapse/message/1.0.0', async ({ stream }) => {
          const message = await stream.source.next();
          const peerId = node.peerId.toString();
          receivedMessages.get(peerId)!.push(message.toString());
        });
      }

      // Publish message from first node
      const testMessage = JSON.stringify({
        type: 'chat',
        content: 'Hello P2P!',
        timestamp: Date.now(),
      });

      const stream = await nodes[0].dialProtocol(
        nodes[1].getMultiaddrs()[0],
        '/synapse/message/1.0.0'
      );
      await stream.sink([Buffer.from(testMessage)]);

      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify message received
      expect(receivedMessages.get(nodes[1].peerId.toString())).toContain(testMessage);
    });

    it('should handle pub/sub messaging', async () => {
      const topic = 'synapse-test-topic';
      const messages: any[] = [];

      // Subscribe all nodes to topic
      for (const node of nodes) {
        await node.pubsub.subscribe(topic);
        node.pubsub.addEventListener('message', (evt: any) => {
          messages.push({
            from: evt.detail.from.toString(),
            data: new TextDecoder().decode(evt.detail.data),
          });
        });
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      // Publish message
      const testData = JSON.stringify({ test: 'pubsub', time: Date.now() });
      await nodes[0].pubsub.publish(topic, new TextEncoder().encode(testData));

      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Verify all nodes received the message
      expect(messages.length).toBeGreaterThanOrEqual(nodes.length - 1);
    });

    it('should handle large message fragmentation', async () => {
      const largeMessage = 'x'.repeat(1024 * 1024); // 1MB
      const chunks: Buffer[] = [];
      const chunkSize = 64 * 1024; // 64KB chunks

      for (let i = 0; i < largeMessage.length; i += chunkSize) {
        chunks.push(Buffer.from(largeMessage.slice(i, i + chunkSize)));
      }

      let receivedChunks: Buffer[] = [];
      
      nodes[1].handle('/synapse/large/1.0.0', async ({ stream }) => {
        for await (const chunk of stream.source) {
          receivedChunks.push(chunk.slice());
        }
      });

      const stream = await nodes[0].dialProtocol(
        nodes[1].getMultiaddrs()[0],
        '/synapse/large/1.0.0'
      );
      
      await stream.sink(chunks);

      // Wait for transfer
      await new Promise(resolve => setTimeout(resolve, 2000));

      const received = Buffer.concat(receivedChunks).toString();
      expect(received).toBe(largeMessage);
    });
  });

  describe('Network Resilience', () => {
    it('should handle network partitions', async () => {
      // Create two separate partitions
      const partition1 = nodes.slice(0, 2);
      const partition2 = nodes.slice(2, 4);

      // Simulate partition by blocking connections
      for (const node of partition1) {
        for (const peer of partition2) {
          await node.hangUp(peer.peerId);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify partitions
      for (const node of partition1) {
        const peers = node.getPeers();
        expect(peers.length).toBeLessThan(nodes.length - 1);
      }

      // Heal partition
      for (let i = 0; i < partition1.length; i++) {
        await partition1[i].dial(partition2[i % partition2.length].getMultiaddrs()[0]);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify healed
      for (const node of nodes) {
        expect(node.getPeers().length).toBeGreaterThan(0);
      }
    });

    it('should handle node failures', async () => {
      const messageLog: string[] = [];
      
      // Set up handlers
      for (const node of nodes) {
        node.handle('/synapse/failover/1.0.0', async ({ stream, connection }) => {
          try {
            for await (const msg of stream.source) {
              messageLog.push(msg.toString());
            }
          } catch (e) {
            // Expected on node failure
          }
        });
      }

      // Simulate node failure
      const failedNode = nodes[nodes.length - 1];
      await failedNode.stop();

      // Send messages through remaining nodes
      for (let i = 0; i < 3; i++) {
        const stream = await nodes[0].dialProtocol(
          nodes[1].getMultiaddrs()[0],
          '/synapse/failover/1.0.0'
        );
        await stream.sink([Buffer.from(`message-${i}`)]);
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify messages still flow
      expect(messageLog.length).toBe(3);
    });
  });

  describe('Protocol Negotiation', () => {
    it('should negotiate compatible protocols', async () => {
      const supportedProtocols = ['/synapse/v1', '/synapse/v2'];
      
      nodes[0].handle(supportedProtocols, async ({ protocol }) => {
        expect(supportedProtocols).toContain(protocol);
      });

      const { stream, protocol } = await nodes[1].dialProtocol(
        nodes[0].getMultiaddrs()[0],
        supportedProtocols
      );

      expect(protocol).toBe('/synapse/v2'); // Should negotiate highest version
    });

    it('should handle protocol version mismatches', async () => {
      const result = await nodes[0].dialProtocol(
        nodes[1].getMultiaddrs()[0],
        ['/unsupported/protocol']
      ).catch(e => e);

      expect(result).toBeInstanceOf(Error);
    });
  });
});
