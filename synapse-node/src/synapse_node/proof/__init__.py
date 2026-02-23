"""Proof generation module for work verification."""

from synapse_node.proof.zk import (
    ZKProofGenerator,
    ZKProof,
    ProofInput,
    ProofBatch,
    get_proof_generator
)

__all__ = [
    "ZKProofGenerator",
    "ZKProof",
    "ProofInput",
    "ProofBatch",
    "get_proof_generator"
]
