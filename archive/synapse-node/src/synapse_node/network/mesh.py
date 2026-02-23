"""
True P2P mesh networking via libp2p with DHT discovery.
No centralized WebSocket relay required.
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Callable, Any, Set
from enum import Enum

# libp2p imports for true P2P
from libp2p import new_host
from libp2p.crypto.secp256k1 import create_new_key_pair
from libp2p.network.stream.net_stream_interface import INetStream
from libp2p.peer.id import ID as PeerID
from libp2p.protocols.pubsub.pubsub import Pubsub
from libp2p.protocols.pubsub.gossipsub import Gossipsub
from libp2p.routing.kademlia.kademlia_peer_router import KademliaPeerRouter
from libp2p.routing.interfaces import IPeerRouting

logger = logging.getLogger(__name__)


class MessageType(Enum):
    """Message types for mesh communication."""
    HELLO = "hello"
    HEARTBEAT = "heartbeat"
    HEARTBEAT_ACK = "heartbeat_ack"
    INFERENCE_REQUEST = "inference_request"
    INFERENCE_RESPONSE = "inference_response"
    PROOF_SUBMIT = "proof_submit"
    PROOF_VERIFY = "proof_verify"
    PEER_DISCOVERY = "peer_discovery"
    PEER_ANNOUNCE = "peer_announce"
    DIRECT_MESSAGE = "direct_message"
    ERROR = "error"


@dataclass
class MeshMessage:
    """Message structure for mesh network."""
    msg_type: str
    payload: Dict[str, Any]
    sender_id: str
    timestamp: float
    message_id: str
    signature: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return {
            "type": self.msg_type,
            "payload": self.payload,
            "sender_id": self.sender_id,
            "timestamp": self.timestamp,
            "message_id": self.message_id,
            "signature": self.signature
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "MeshMessage":
        return cls(
            msg_type=data.get("type", "unknown"),
            payload=data.get("payload", {}),
            sender_id=data.get("sender_id", "unknown"),
            timestamp=data.get("timestamp", time.time()),
            message_id=data.get("message_id", ""),
            signature=data.get("signature")
        )


@dataclass
class PeerInfo:
    """Information about a peer node."""
    node_id: str
    node_name: str
    multiaddrs: List[str]
    capabilities: List[str]
    models: List[str]
    gpu_count: int
    gpu_memory_gb: float
    reputation: int
    last_seen: float
    supported_tokens: List[str]
    price_per_token: Dict[str, float]


class DecentralizedMeshClient:
    """
    True P2P mesh client using libp2p.
    No centralized WebSocket relay required.
    Uses DHT for peer discovery and pubsub for broadcasting.
    """
    
    # Protocol identifiers
    PROTOCOL_DIRECT = "/synapse/1.0.0/direct"
    PROTOCOL_DISCOVERY = "/synapse/1.0.0/discovery"
    
    # Pubsub topics
    TOPIC_JOBS = "synapse-jobs"
    TOPIC_HEARTBEAT = "synapse-heartbeat"
    TOPIC_DISCOVERY = "synapse-discovery"
    
    def __init__(
        self,
        node_id: Optional[str] = None,
        node_name: Optional[str] = None,
        listen_addrs: Optional[List[str]] = None,
        bootstrap_peers: Optional[List[str]] = None
    ):
        self.node_id = node_id or self._generate_node_id()
        self.node_name = node_name or f"synapse-node-{self.node_id[:8]}"
        self.listen_addrs = listen_addrs or ["/ip4/0.0.0.0/tcp/0", "/ip4/0.0.0.0/udp/0/quic"]
        self.bootstrap_peers = bootstrap_peers or []
        
        self.host = None
        self.pubsub: Optional[Gossipsub] = None
        self.dht: Optional[KademliaPeerRouter] = None
        
        self._peers: Dict[str, PeerInfo] = {}
        self._handlers: Dict[MessageType, List[Callable]] = {}
        self._pending_requests: Dict[str, asyncio.Future] = {}
        
        self._running = False
        self._tasks: List[asyncio.Task] = []
        
        # Node capabilities
        self.capabilities = ["inference", "proof_generation"]
        self.supported_models: List[str] = []
        self.supported_tokens = ["HSK"]
        self.price_per_token = {"HSK": 0.001}
        
        # Reputation
        self.reputation = 100
        
    def _generate_node_id(self) -> str:
        """Generate a unique node ID using libp2p keypair."""
        key_pair = create_new_key_pair()
        return key_pair.public_key.to_peer_id().pretty()
    
    async def connect(self) -> bool:
        """
        Initialize and start the P2P node.
        Connects to bootstrap peers and joins the DHT.
        """
        try:
            logger.info(f"Starting decentralized P2P node: {self.node_id}")
            
            # Create libp2p host
            self.host = new_host(
                key_pair=create_new_key_pair(),
                listen_addrs=self.listen_addrs
            )
            
            # Initialize DHT for peer discovery
            self.dht = KademliaPeerRouter(
                self.host.get_network(),
                self.host.get_peerstore()
            )
            
            # Initialize pubsub with gossipsub
            self.pubsub = Gossipsub(
                self.host,
                self.host.get_network(),
                degree=6,
                degree_low=4,
                degree_high=12,
                time_to_live=30
            )
            
            # Start host
            await self.host.start()
            
            # Subscribe to topics
            await self._subscribe_to_topics()
            
            # Connect to bootstrap peers
            await self._connect_bootstrap_peers()
            
            # Start DHT bootstrap
            await self.dht.bootstrap(self.bootstrap_peers)
            
            self._running = True
            
            # Start background tasks
            self._tasks.append(asyncio.create_task(self._heartbeat_loop()))
            self._tasks.append(asyncio.create_task(self._discovery_loop()))
            self._tasks.append(asyncio.create_task(self._cleanup_loop()))
            
            # Set up stream handlers
            self.host.set_stream_handler(self.PROTOCOL_DIRECT, self._handle_direct_stream)
            self.host.set_stream_handler(self.PROTOCOL_DISCOVERY, self._handle_discovery_stream)
            
            # Announce presence
            await self._announce_presence()
            
            logger.info(f"P2P node started successfully")
            logger.info(f"Peer ID: {self.host.get_id().pretty()}")
            logger.info(f"Listen addrs: {[str(a) for a in self.host.get_addrs()]}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to start P2P node: {e}")
            return False
    
    async def disconnect(self):
        """Gracefully shut down the P2P node."""
        logger.info("Shutting down P2P node...")
        self._running = False
        
        # Cancel all tasks
        for task in self._tasks:
            task.cancel()
        
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        
        if self.host:
            await self.host.stop()
        
        logger.info("P2P node stopped")
    
    async def _subscribe_to_topics(self):
        """Subscribe to pubsub topics."""
        topics = [self.TOPIC_JOBS, self.TOPIC_HEARTBEAT, self.TOPIC_DISCOVERY]
        
        for topic in topics:
            await self.pubsub.subscribe(topic, self._handle_pubsub_message)
            logger.info(f"Subscribed to topic: {topic}")
    
    async def _connect_bootstrap_peers(self):
        """Connect to bootstrap peers for initial network join."""
        for peer_addr in self.bootstrap_peers:
            try:
                # Parse multiaddr and extract peer ID
                # Format: /ip4/x.x.x.x/tcp/port/p2p/peerid
                parts = peer_addr.split("/")
                peer_id = parts[-1]
                
                logger.info(f"Connecting to bootstrap: {peer_addr}")
                await self.host.connect(peer_id, [peer_addr])
                
            except Exception as e:
                logger.warning(f"Failed to connect to bootstrap {peer_addr}: {e}")
    
    async def _handle_pubsub_message(self, msg_data: bytes, msg_id: str, topic: str):
        """Handle incoming pubsub message."""
        try:
            data = json.loads(msg_data.decode())
            message = MeshMessage.from_dict(data)
            
            logger.debug(f"Received {message.msg_type} on {topic}")
            
            # Verify sender is not self
            if message.sender_id == self.node_id:
                return
            
            await self._process_message(message)
            
        except Exception as e:
            logger.error(f"Error handling pubsub message: {e}")
    
    async def _handle_direct_stream(self, stream: INetStream):
        """Handle direct P2P stream."""
        try:
            data = await stream.read()
            message = MeshMessage.from_dict(json.loads(data.decode()))
            
            logger.debug(f"Received direct message: {message.msg_type}")
            await self._process_message(message)
            
            # Send acknowledgment
            ack = {"status": "ok", "message_id": message.message_id}
            await stream.write(json.dumps(ack).encode())
            
        except Exception as e:
            logger.error(f"Error handling direct stream: {e}")
        finally:
            await stream.close()
    
    async def _handle_discovery_stream(self, stream: INetStream):
        """Handle peer discovery requests."""
        try:
            # Send our peer info
            info = self._get_self_peer_info()
            await stream.write(json.dumps(asdict(info)).encode())
            
        except Exception as e:
            logger.error(f"Error handling discovery: {e}")
        finally:
            await stream.close()
    
    async def _process_message(self, message: MeshMessage):
        """Process incoming message based on type."""
        # Update peer info
        if message.sender_id not in self._peers:
            await self._request_peer_info(message.sender_id)
        
        # Check for pending request responses
        if message.message_id in self._pending_requests:
            future = self._pending_requests.pop(message.message_id)
            if not future.done():
                future.set_result(message)
        
        # Handle based on type
        try:
            msg_type = MessageType(message.msg_type)
        except ValueError:
            logger.warning(f"Unknown message type: {message.msg_type}")
            return
        
        if msg_type == MessageType.HEARTBEAT:
            self._update_peer_timestamp(message.sender_id)
        
        elif msg_type == MessageType.PEER_ANNOUNCE:
            self._update_peer_from_announcement(message.sender_id, message.payload)
        
        elif msg_type == MessageType.INFERENCE_REQUEST:
            await self._handle_inference_request(message)
        
        # Call registered handlers
        if msg_type in self._handlers:
            for handler in self._handlers[msg_type]:
                try:
                    asyncio.create_task(handler(message))
                except Exception as e:
                    logger.error(f"Handler error: {e}")
    
    async def send_message(
        self, 
        msg_type: MessageType, 
        payload: Dict,
        topic: Optional[str] = None
    ) -> str:
        """Send a message to the network via pubsub."""
        if not self.pubsub:
            raise RuntimeError("Pubsub not initialized")
        
        message_id = f"{self.node_id}-{int(time.time() * 1000)}"
        
        msg = MeshMessage(
            msg_type=msg_type.value,
            payload=payload,
            sender_id=self.node_id,
            timestamp=time.time(),
            message_id=message_id
        )
        
        target_topic = topic or self.TOPIC_JOBS
        await self.pubsub.publish(target_topic, json.dumps(msg.to_dict()).encode())
        
        return message_id
    
    async def send_direct_message(self, peer_id: str, message: MeshMessage) -> bool:
        """Send direct message to specific peer."""
        try:
            # Open stream to peer
            stream = await self.host.new_stream(peer_id, [self.PROTOCOL_DIRECT])
            
            # Send message
            await stream.write(json.dumps(message.to_dict()).encode())
            
            # Wait for acknowledgment
            response = await stream.read()
            ack = json.loads(response.decode())
            
            await stream.close()
            return ack.get("status") == "ok"
            
        except Exception as e:
            logger.error(f"Failed to send direct message to {peer_id}: {e}")
            return False
    
    async def request(
        self,
        peer_id: str,
        msg_type: MessageType,
        payload: Dict,
        timeout: float = 30.0
    ) -> Optional[MeshMessage]:
        """Send request and wait for response."""
        message_id = f"{self.node_id}-{int(time.time() * 1000)}"
        
        msg = MeshMessage(
            msg_type=msg_type.value,
            payload=payload,
            sender_id=self.node_id,
            timestamp=time.time(),
            message_id=message_id
        )
        
        # Create future for response
        future = asyncio.get_event_loop().create_future()
        self._pending_requests[message_id] = future
        
        # Send message
        success = await self.send_direct_message(peer_id, msg)
        if not success:
            self._pending_requests.pop(message_id, None)
            return None
        
        try:
            return await asyncio.wait_for(future, timeout=timeout)
        except asyncio.TimeoutError:
            self._pending_requests.pop(message_id, None)
            return None
    
    def on(self, msg_type: MessageType):
        """Decorator to register a message handler."""
        def decorator(func: Callable):
            if msg_type not in self._handlers:
                self._handlers[msg_type] = []
            self._handlers[msg_type].append(func)
            return func
        return decorator
    
    def _get_self_peer_info(self) -> PeerInfo:
        """Get information about this node."""
        return PeerInfo(
            node_id=self.node_id,
            node_name=self.node_name,
            multiaddrs=[str(a) for a in self.host.get_addrs()] if self.host else [],
            capabilities=self.capabilities,
            models=self.supported_models,
            gpu_count=0,  # Will be updated by GPU manager
            gpu_memory_gb=0.0,
            reputation=self.reputation,
            last_seen=time.time(),
            supported_tokens=self.supported_tokens,
            price_per_token=self.price_per_token
        )
    
    async def _announce_presence(self):
        """Announce presence to the network."""
        info = self._get_self_peer_info()
        
        await self.send_message(
            MessageType.PEER_ANNOUNCE,
            asdict(info),
            topic=self.TOPIC_DISCOVERY
        )
    
    async def _heartbeat_loop(self):
        """Send periodic heartbeats."""
        while self._running:
            try:
                await self.send_message(
                    MessageType.HEARTBEAT,
                    {"timestamp": time.time(), "reputation": self.reputation},
                    topic=self.TOPIC_HEARTBEAT
                )
                await asyncio.sleep(30)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Heartbeat error: {e}")
                await asyncio.sleep(5)
    
    async def _discovery_loop(self):
        """Periodic discovery of new peers."""
        while self._running:
            try:
                await asyncio.sleep(60)
                
                # Query DHT for peers
                # This is simplified - real implementation would use DHT routing
                
                # Announce presence again
                await self._announce_presence()
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Discovery error: {e}")
    
    async def _cleanup_loop(self):
        """Clean up stale peers."""
        while self._running:
            try:
                await asyncio.sleep(300)  # 5 minutes
                
                now = time.time()
                cutoff = now - 600  # 10 minutes
                
                stale_peers = [
                    peer_id for peer_id, info in self._peers.items()
                    if info.last_seen < cutoff
                ]
                
                for peer_id in stale_peers:
                    del self._peers[peer_id]
                    logger.info(f"Removed stale peer: {peer_id}")
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Cleanup error: {e}")
    
    async def _request_peer_info(self, peer_id: str):
        """Request information from a peer."""
        try:
            stream = await self.host.new_stream(peer_id, [self.PROTOCOL_DISCOVERY])
            data = await stream.read()
            info = PeerInfo(**json.loads(data.decode()))
            self._peers[peer_id] = info
            await stream.close()
        except Exception as e:
            logger.debug(f"Failed to get peer info for {peer_id}: {e}")
    
    def _update_peer_timestamp(self, peer_id: str):
        """Update last seen timestamp for peer."""
        if peer_id in self._peers:
            self._peers[peer_id].last_seen = time.time()
    
    def _update_peer_from_announcement(self, peer_id: str, payload: Dict):
        """Update peer info from announcement."""
        try:
            info = PeerInfo(**payload)
            info.last_seen = time.time()
            self._peers[peer_id] = info
        except Exception as e:
            logger.debug(f"Failed to parse peer announcement: {e}")
    
    async def _handle_inference_request(self, message: MeshMessage):
        """Handle inference request from peer."""
        # This would be implemented by the inference engine
        pass
    
    def get_peers(self) -> List[PeerInfo]:
        """Get list of known peers."""
        return list(self._peers.values())
    
    def get_peer_count(self) -> int:
        """Get number of connected peers."""
        return len(self._peers)
    
    def is_connected(self) -> bool:
        """Check if connected to mesh network."""
        return self._running and self.host is not None
    
    def get_node_info(self) -> Dict[str, Any]:
        """Get node information."""
        return {
            "node_id": self.node_id,
            "node_name": self.node_name,
            "peer_count": self.get_peer_count(),
            "capabilities": self.capabilities,
            "reputation": self.reputation,
            "addresses": [str(a) for a in self.host.get_addrs()] if self.host else []
        }


# Global instance
_mesh_client: Optional[DecentralizedMeshClient] = None


def get_mesh_client() -> DecentralizedMeshClient:
    """Get global mesh client instance."""
    global _mesh_client
    if _mesh_client is None:
        _mesh_client = DecentralizedMeshClient()
    return _mesh_client
