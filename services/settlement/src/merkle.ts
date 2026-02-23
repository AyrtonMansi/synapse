/**
 * PHASE 4: Merkle Tree Generator for HSK Settlement
 * Creates Merkle trees for epoch reward distribution
 */

import { ethers } from 'ethers';

interface MerkleLeaf {
  wallet: string;
  amount: bigint;
  hash: string;
}

interface MerkleTree {
  root: string;
  leaves: MerkleLeaf[];
  layers: string[][];
  proofs: Map<string, string[]>;
}

/**
 * Create a Merkle tree from wallet->amount pairs
 */
export function createMerkleTree(distribution: Map<string, bigint>): MerkleTree {
  // Create leaves
  const leaves: MerkleLeaf[] = Array.from(distribution.entries())
    .sort((a, b) => a[0].localeCompare(b[0])) // Deterministic ordering
    .map(([wallet, amount]) => ({
      wallet,
      amount,
      hash: ethers.keccak256(
        ethers.solidityPacked(['address', 'uint256'], [wallet, amount])
      )
    }));

  if (leaves.length === 0) {
    return {
      root: ethers.ZeroHash,
      leaves: [],
      layers: [],
      proofs: new Map()
    };
  }

  // Build tree layers
  const layers: string[][] = [leaves.map(l => l.hash)];
  
  while (layers[layers.length - 1].length > 1) {
    const currentLayer = layers[layers.length - 1];
    const nextLayer: string[] = [];
    
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      const right = currentLayer[i + 1] || left; // Duplicate last if odd
      // Sort to ensure consistent ordering
      const pair = left < right ? [left, right] : [right, left];
      nextLayer.push(ethers.keccak256(ethers.concat(pair)));
    }
    
    layers.push(nextLayer);
  }

  const root = layers[layers.length - 1][0];

  // Generate proofs
  const proofs = new Map<string, string[]>();
  
  for (let i = 0; i < leaves.length; i++) {
    const proof: string[] = [];
    let index = i;
    
    for (let layer = 0; layer < layers.length - 1; layer++) {
      const isRightNode = index % 2 === 1;
      const siblingIndex = isRightNode ? index - 1 : index + 1;
      
      if (siblingIndex < layers[layer].length) {
        proof.push(layers[layer][siblingIndex]);
      }
      
      index = Math.floor(index / 2);
    }
    
    proofs.set(leaves[i].wallet, proof);
  }

  return { root, leaves, layers, proofs };
}

/**
 * Verify a Merkle proof
 */
export function verifyProof(
  wallet: string,
  amount: bigint,
  proof: string[],
  root: string
): boolean {
  let hash = ethers.keccak256(
    ethers.solidityPacked(['address', 'uint256'], [wallet, amount])
  );

  for (const proofElement of proof) {
    // Sort to match tree construction
    const pair = hash < proofElement ? [hash, proofElement] : [proofElement, hash];
    hash = ethers.keccak256(ethers.concat(pair));
  }

  return hash === root;
}

/**
 * Export tree to JSON for contract submission
 */
export function exportTree(tree: MerkleTree): {
  root: string;
  distribution: Array<{ wallet: string; amount: string }>;
  proofs: Record<string, string[]>;
} {
  return {
    root: tree.root,
    distribution: tree.leaves.map(l => ({
      wallet: l.wallet,
      amount: l.amount.toString()
    })),
    proofs: Object.fromEntries(tree.proofs)
  };
}
