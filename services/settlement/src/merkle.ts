/**
 * Merkle Tree Implementation for HSK Settlement
 * PHASE 4: Production-grade Merkle trees
 */

import { ethers } from 'ethers';

interface MerkleLeaf {
  wallet: string;
  amount: bigint;
  index: number;
  hash: string;
}

interface MerkleTree {
  root: string;
  leaves: MerkleLeaf[];
  layers: string[][];
}

/**
 * Create a complete Merkle tree from wallet->amount pairs
 */
export function createMerkleTree(distribution: Map<string, bigint>): MerkleTree {
  // Create sorted leaves
  const entries = Array.from(distribution.entries())
    .sort((a, b) => a[0].localeCompare(b[0]));
   
  const leaves: MerkleLeaf[] = entries.map(([wallet, amount], index) => ({
    wallet,
    amount,
    index,
    hash: hashLeaf(wallet, amount)
  }));

  if (leaves.length === 0) {
    return {
      root: ethers.ZeroHash,
      leaves: [],
      layers: []
    };
  }

  // Build tree layers bottom-up
  const layers: string[][] = [leaves.map(l => l.hash)];
  
  while (layers[layers.length - 1].length > 1) {
    const currentLayer = layers[layers.length - 1];
    const nextLayer: string[] = [];
    
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      const right = currentLayer[i + 1] || left;
      nextLayer.push(hashPair(left, right));
    }
    
    layers.push(nextLayer);
  }

  return {
    root: layers[layers.length - 1][0],
    leaves,
    layers
  };
}

/**
 * Hash a leaf node
 */
export function hashLeaf(wallet: string, amount: bigint): string {
  return ethers.keccak256(
    ethers.solidityPacked(
      ['address', 'uint256'],
      [wallet, amount]
    )
  );
}

/**
 * Hash a pair of nodes (sorted for consistency)
 */
export function hashPair(left: string, right: string): string {
  // Sort to ensure consistent ordering
  const [a, b] = left < right ? [left, right] : [right, left];
  return ethers.keccak256(
    ethers.solidityPacked(['bytes32', 'bytes32'], [a, b])
  );
}

/**
 * Generate Merkle proof for a leaf
 */
export function getProof(tree: MerkleTree, wallet: string): string[] | null {
  const leaf = tree.leaves.find(l => l.wallet === wallet);
  if (!leaf) return null;

  const proof: string[] = [];
  let index = leaf.index;

  for (let layer = 0; layer < tree.layers.length - 1; layer++) {
    const currentLayer = tree.layers[layer];
    const isRightNode = index % 2 === 1;
    const siblingIndex = isRightNode ? index - 1 : index + 1;

    if (siblingIndex < currentLayer.length) {
      proof.push(currentLayer[siblingIndex]);
    }

    index = Math.floor(index / 2);
  }

  return proof;
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
  let hash = hashLeaf(wallet, amount);

  for (const proofElement of proof) {
    hash = hashPair(hash, proofElement);
  }

  return hash === root;
}

/**
 * Export tree data for contract submission
 */
export function exportTreeData(tree: MerkleTree): {
  root: string;
  leaves: Array<{ wallet: string; amount: string; index: number }>;
  proofs: Record<string, string[]>;
} {
  const proofs: Record<string, string[]> = {};
  
  for (const leaf of tree.leaves) {
    const proof = getProof(tree, leaf.wallet);
    if (proof) {
      proofs[leaf.wallet] = proof;
    }
  }

  return {
    root: tree.root,
    leaves: tree.leaves.map(l => ({
      wallet: l.wallet,
      amount: l.amount.toString(),
      index: l.index
    })),
    proofs
  };
}

/**
 * Multi-proof for batch claiming (gas optimization)
 */
export function getMultiProof(
  tree: MerkleTree,
  wallets: string[]
): {
  proof: string[];
  proofFlags: boolean[];
  leaves: Array<{ wallet: string; amount: bigint }>;
} | null {
  // Find all leaf indices
  const indices = wallets
    .map(w => tree.leaves.findIndex(l => l.wallet === w))
    .filter(i => i !== -1)
    .sort((a, b) => a - b);

  if (indices.length === 0) return null;

  // Build multi-proof (simplified - full implementation needs more logic)
  const proof: string[] = [];
  const proofFlags: boolean[] = [];
  const leaves = indices.map(i => ({
    wallet: tree.leaves[i].wallet,
    amount: tree.leaves[i].amount
  }));

  // This is a placeholder - actual multi-proof generation is complex
  return { proof, proofFlags, leaves };
}
