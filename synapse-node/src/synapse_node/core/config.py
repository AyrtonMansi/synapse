"""Configuration management for Synapse Node."""

import os
from pathlib import Path
from typing import Optional, List

from pydantic import Field, validator
from pydantic_settings import BaseSettings


class NodeConfig(BaseSettings):
    """Node configuration settings."""
    
    # Node identification
    node_id: Optional[str] = Field(default=None, description="Unique node identifier")
    node_name: str = Field(default="synapse-node", description="Human-readable node name")
    
    # Network settings - Decentralized P2P (no centralized relay)
    bootstrap_peers: List[str] = Field(
        default_factory=lambda: [
            "/dns4/bootstrap-1.synapse.network/tcp/443/wss",
            "/dns4/bootstrap-2.synapse.network/tcp/443/wss",
            "/dns4/bootstrap-3.synapse.network/tcp/443/wss",
        ],
        description="Bootstrap peers for P2P mesh (multiaddrs)"
    )
    enable_dht: bool = Field(default=True, description="Enable DHT for peer discovery")
    enable_local_discovery: bool = Field(default=True, description="Enable mDNS local discovery")
    
    # API settings
    api_host: str = Field(default="0.0.0.0", description="API server bind address")
    api_port: int = Field(default=8080, description="API server port")
    api_tls_enabled: bool = Field(default=True, description="Enable TLS for API")
    
    # GPU settings
    gpu_devices: Optional[List[int]] = Field(
        default=None, 
        description="Specific GPU devices to use (None = all available)"
    )
    gpu_memory_fraction: float = Field(
        default=0.9, 
        description="Fraction of GPU memory to allocate per device"
    )
    
    # Model settings
    model_cache_dir: Path = Field(
        default=Path("/app/models"),
        description="Directory for model caching"
    )
    default_models: List[str] = Field(
        default=[
            "deepseek-ai/deepseek-coder-6.7b-instruct",
            "meta-llama/Llama-2-7b-chat-hf",
            "mistralai/Mistral-7B-Instruct-v0.2"
        ],
        description="Default models to preload"
    )
    max_model_memory_gb: float = Field(
        default=14.0,
        description="Maximum memory per model in GB"
    )
    
    # Inference settings
    max_concurrent_requests: int = Field(default=32, description="Max concurrent inference requests")
    request_timeout_seconds: int = Field(default=120, description="Request timeout")
    max_tokens_default: int = Field(default=2048, description="Default max tokens")
    
    # Proof generation settings
    proof_enabled: bool = Field(default=True, description="Enable ZK proof generation")
    proof_circuit_path: Path = Field(
        default=Path("/app/circuits"),
        description="Path to ZK circuit files"
    )
    
    # Wallet settings
    wallet_private_key: Optional[str] = Field(
        default=None, 
        description="Ethereum private key for node wallet"
    )
    wallet_address: Optional[str] = Field(
        default=None,
        description="Ethereum wallet address"
    )
    
    # Blockchain settings
    chain_id: int = Field(default=133, description="Chain ID for HSK network")
    rpc_urls: List[str] = Field(
        default_factory=lambda: [
            "https://rpc.mainnet.haskey.com",
            "https://hsk-mainnet.public.blastapi.io",
        ],
        description="RPC endpoints with failover"
    )
    
    # Contract addresses
    token_contract: Optional[str] = Field(default=None, description="HSK token contract")
    registry_contract: Optional[str] = Field(default=None, description="Job registry contract")
    staking_contract: Optional[str] = Field(default=None, description="Staking contract")
    
    # Monitoring
    prometheus_port: int = Field(default=9090, description="Prometheus metrics port")
    health_check_interval: int = Field(default=30, description="Health check interval seconds")
    log_level: str = Field(default="INFO", description="Logging level")
    
    # Docker/Container
    nvidia_visible_devices: Optional[str] = Field(
        default=None,
        description="NVIDIA_VISIBLE_DEVICES environment override"
    )
    
    class Config:
        env_prefix = "SYNAPSE_"
        env_file = ".env"
        case_sensitive = False
    
    @validator("model_cache_dir", "proof_circuit_path", pre=True)
    def expand_paths(cls, v):
        if isinstance(v, str):
            return Path(v).expanduser()
        return v
    
    @validator("wallet_private_key")
    def validate_private_key(cls, v):
        if v and not v.startswith("0x"):
            return f"0x{v}"
        return v
    
    @validator("bootstrap_peers", pre=True)
    def parse_bootstrap_peers(cls, v):
        if isinstance(v, str):
            return [p.strip() for p in v.split(",") if p.strip()]
        return v
    
    @validator("rpc_urls", pre=True)
    def parse_rpc_urls(cls, v):
        if isinstance(v, str):
            return [u.strip() for u in v.split(",") if u.strip()]
        return v
    
    def get_effective_gpu_devices(self) -> List[int]:
        """Get the list of GPU devices to use."""
        if self.nvidia_visible_devices:
            # Parse NVIDIA_VISIBLE_DEVICES
            if self.nvidia_visible_devices == "all":
                return []
            return [int(x.strip()) for x in self.nvidia_visible_devices.split(",")]
        return self.gpu_devices or []
    
    def validate_contracts(self) -> bool:
        """Validate that required contract addresses are configured."""
        required = ["token_contract", "registry_contract"]
        for field in required:
            value = getattr(self, field)
            if not value or value == "0x0000000000000000000000000000000000000000":
                return False
        return True
    
    def get_bootstrap_config(self) -> dict:
        """Get bootstrap configuration for P2P mesh."""
        return {
            "bootstrap_peers": self.bootstrap_peers,
            "enable_dht": self.enable_dht,
            "enable_local_discovery": self.enable_local_discovery,
        }


# Global config instance
_config: Optional[NodeConfig] = None


def get_config() -> NodeConfig:
    """Get or create global configuration instance."""
    global _config
    if _config is None:
        _config = NodeConfig()
    return _config


def set_config(config: NodeConfig) -> None:
    """Set global configuration instance."""
    global _config
    _config = config
