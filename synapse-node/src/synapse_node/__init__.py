"""
Synapse Node - Decentralized AI Inference Network

This package provides a complete node implementation for the Synapse Network,
enabling distributed AI model inference with GPU acceleration and ZK proof verification.
"""

__version__ = "0.1.0"
__author__ = "Synapse Network"
__license__ = "MIT"

from synapse_node.core.config import NodeConfig, get_config
from synapse_node.core.node import SynapseNode, create_app

__all__ = [
    "__version__",
    "NodeConfig",
    "get_config",
    "SynapseNode",
    "create_app",
]
