"""Decentralized bootstrap configuration for Synapse Node."""

import os
import json
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, asdict
from pathlib import Path


@dataclass
class BootstrapPeer:
    """Peer bootstrap configuration."""
    address: str
    priority: int = 0
    source: str = "manual"  # manual, dns, mdns, dht
    last_seen: Optional[float] = None
    latency_ms: Optional[int] = None


class BootstrapManager:
    """Manages multiple bootstrap methods for mesh connection."""
    
    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or Path.home() / ".synapse" / "bootstrap.json"
        self.peers: List[BootstrapPeer] = []
        self.dns_endpoints: List[str] = []
        self.dht_bootstrap: bool = True
        self.local_discovery: bool = True
        
        # Load saved configuration
        self.load_config()
    
    def load_config(self) -> None:
        """Load bootstrap configuration from disk."""
        if self.config_path.exists():
            try:
                with open(self.config_path) as f:
                    data = json.load(f)
                    self.peers = [BootstrapPeer(**p) for p in data.get("peers", [])]
                    self.dns_endpoints = data.get("dns_endpoints", [])
                    self.dht_bootstrap = data.get("dht_bootstrap", True)
                    self.local_discovery = data.get("local_discovery", True)
            except Exception as e:
                print(f"Failed to load bootstrap config: {e}")
    
    def save_config(self) -> None:
        """Save bootstrap configuration to disk."""
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "peers": [asdict(p) for p in self.peers],
            "dns_endpoints": self.dns_endpoints,
            "dht_bootstrap": self.dht_bootstrap,
            "local_discovery": self.local_discovery,
        }
        with open(self.config_path, "w") as f:
            json.dump(data, f, indent=2)
    
    def add_peer(self, address: str, priority: int = 0) -> None:
        """Add a manual bootstrap peer."""
        # Check for duplicates
        for peer in self.peers:
            if peer.address == address:
                return
        
        self.peers.append(BootstrapPeer(
            address=address,
            priority=priority,
            source="manual"
        ))
        self.save_config()
    
    def remove_peer(self, address: str) -> bool:
        """Remove a bootstrap peer."""
        for i, peer in enumerate(self.peers):
            if peer.address == address:
                self.peers.pop(i)
                self.save_config()
                return True
        return False
    
    def add_dns_endpoint(self, endpoint: str) -> None:
        """Add a DNS-based discovery endpoint."""
        if endpoint not in self.dns_endpoints:
            self.dns_endpoints.append(endpoint)
            self.save_config()
    
    def resolve_dns_peers(self) -> List[BootstrapPeer]:
        """Resolve peers from DNS endpoints."""
        import socket
        
        resolved = []
        for endpoint in self.dns_endpoints:
            try:
                # Try to resolve as DNS TXT record or A record
                result = socket.getaddrinfo(endpoint, None)
                for r in result:
                    ip = r[4][0]
                    # Assume default port 8080
                    address = f"/ip4/{ip}/tcp/8080"
                    resolved.append(BootstrapPeer(
                        address=address,
                        priority=1,
                        source="dns"
                    ))
            except Exception as e:
                print(f"Failed to resolve {endpoint}: {e}")
        
        return resolved
    
    def get_all_bootstrap_peers(self) -> List[str]:
        """Get all bootstrap peer addresses in priority order."""
        all_peers = list(self.peers)
        
        # Add DNS-resolved peers
        all_peers.extend(self.resolve_dns_peers())
        
        # Sort by priority
        all_peers.sort(key=lambda p: p.priority)
        
        return [p.address for p in all_peers]
    
    def get_bootstrap_config(self) -> Dict[str, Any]:
        """Get configuration for libp2p bootstrap."""
        return {
            "bootstrap_peers": self.get_all_bootstrap_peers(),
            "enable_dht": self.dht_bootstrap,
            "enable_local_discovery": self.local_discovery,
        }


def get_default_bootstrap_peers() -> List[str]:
    """Get default bootstrap peers for mainnet."""
    # These should be community-run bootstrap nodes
    return [
        # Primary bootstrap nodes (community operated)
        "/dns4/bootstrap-1.synapse.network/tcp/443/wss",
        "/dns4/bootstrap-2.synapse.network/tcp/443/wss",
        "/dns4/bootstrap-3.synapse.network/tcp/443/wss",
        
        # Fallback to IP addresses if DNS fails
        "/ip4/104.131.4.243/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ",
    ]


def get_testnet_bootstrap_peers() -> List[str]:
    """Get bootstrap peers for testnet."""
    return [
        "/dns4/bootstrap-testnet.synapse.network/tcp/443/wss",
    ]


class LocalPeerDiscovery:
    """Local network peer discovery via mDNS."""
    
    def __init__(self, port: int = 8080):
        self.port = port
        self.discovered_peers: List[str] = []
        self._running = False
    
    async def start(self) -> None:
        """Start mDNS discovery."""
        try:
            import zeroconf
            
            self._running = True
            
            # Register service
            self.zeroconf = zeroconf.Zeroconf()
            self.service_info = zeroconf.ServiceInfo(
                "_synapse._tcp.local.",
                f"synapse-node-{self.port}._synapse._tcp.local.",
                addresses=[self._get_local_ip()],
                port=self.port,
                properties={"version": "0.1.0"},
            )
            self.zeroconf.register_service(self.service_info)
            
            # Browse for other services
            self.browser = zeroconf.ServiceBrowser(
                self.zeroconf,
                "_synapse._tcp.local.",
                self._service_listener()
            )
            
        except ImportError:
            print("zeroconf not installed, local discovery disabled")
        except Exception as e:
            print(f"Failed to start mDNS discovery: {e}")
    
    async def stop(self) -> None:
        """Stop mDNS discovery."""
        self._running = False
        if hasattr(self, 'zeroconf'):
            self.zeroconf.unregister_all_services()
            self.zeroconf.close()
    
    def _get_local_ip(self) -> bytes:
        """Get local IP address."""
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
        finally:
            s.close()
        return socket.inet_aton(ip)
    
    def _service_listener(self):
        """Create service listener for zeroconf."""
        from zeroconf import ServiceListener
        
        class Listener(ServiceListener):
            def __init__(self, parent):
                self.parent = parent
            
            def add_service(self, zc, type_, name):
                info = zc.get_service_info(type_, name)
                if info:
                    for addr in info.addresses:
                        ip = ".".join(str(b) for b in addr)
                        peer_addr = f"/ip4/{ip}/tcp/{info.port}"
                        if peer_addr not in self.parent.discovered_peers:
                            self.parent.discovered_peers.append(peer_addr)
                            print(f"Discovered local peer: {peer_addr}")
            
            def remove_service(self, zc, type_, name):
                pass
            
            def update_service(self, zc, type_, name):
                pass
        
        return Listener(self)
    
    def get_discovered_peers(self) -> List[str]:
        """Get list of locally discovered peers."""
        return self.discovered_peers.copy()


# Global instance
_bootstrap_manager: Optional[BootstrapManager] = None


def get_bootstrap_manager() -> BootstrapManager:
    """Get global bootstrap manager instance."""
    global _bootstrap_manager
    if _bootstrap_manager is None:
        _bootstrap_manager = BootstrapManager()
    return _bootstrap_manager
