import { createLibp2p } from 'libp2p';
import { tcp } from '@libp2p/tcp';
import { webSockets } from '@libp2p/websockets';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { kadDHT } from '@libp2p/kad-dht';
import { gossipsub } from '@libp2p/gossipsub';

interface NodeConfig {
  listenAddresses: string[];
  bootstrapPeers?: any[];
  isBootstrap?: boolean;
  dht?: boolean;
}

export class P2PNetwork {
  async createNode(config: NodeConfig): Promise<any> {
    const transports: any[] = [tcp()];
    
    if (config.listenAddresses.some(addr => addr.includes('ws'))) {
      transports.push(webSockets());
    }

    const services: any = {};
    
    if (config.dht) {
      services.dht = kadDHT({
        clientMode: !config.isBootstrap,
      });
    }

    services.pubsub = gossipsub({
      emitSelf: false,
    });

    const node = await createLibp2p({
      transports,
      connectionEncryption: [noise()],
      streamMuxers: [yamux()],
      addresses: {
        listen: config.listenAddresses,
      },
      peerDiscovery: config.bootstrapPeers?.map(addr => ({
        type: 'bootstrap',
        interval: 1000,
        list: [addr],
      })),
      services,
    });

    await node.start();
    return node;
  }

  async broadcast(nodes: any[], topic: string, message: any): Promise<void> {
    const data = new TextEncoder().encode(JSON.stringify(message));
    
    for (const node of nodes) {
      if (node.services.pubsub) {
        await node.services.pubsub.publish(topic, data);
      }
    }
  }

  async findPeers(nodes: any[], protocol: string): Promise<any[]> {
    const peers = [];
    
    for (const node of nodes) {
      const nodePeers = node.getPeers();
      peers.push(...nodePeers);
    }

    return peers;
  }
}
