/**
 * Challenge System for Node Fraud Detection
 * PHASE 5: Challenge jobs with known expected outputs
 */

import { db } from '../../gateway-api/src/db/index.js';
import { randomUUID, createHash } from 'crypto';

interface ChallengeJob {
  id: string;
  prompt: string;
  expectedPattern: string; // Pattern to match in output
  model: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tolerance: number; // Levenshtein distance tolerance
}

interface ChallengeResult {
  jobId: string;
  nodeId: string;
  passed: boolean;
  similarity: number;
  timestamp: number;
}

// Canary prompts with known expected behaviors
// These are carefully crafted to be non-sensitive but deterministic
const CHALLENGE_PROMPTS: ChallengeJob[] = [
  {
    id: 'canary-1',
    prompt: 'Repeat the exact word "SYNAPSE_CANARY_42" and nothing else.',
    expectedPattern: 'SYNAPSE_CANARY_42',
    model: 'deepseek-v3',
    difficulty: 'easy',
    tolerance: 2 // Allow minor variations
  },
  {
    id: 'canary-2', 
    prompt: 'Count from 1 to 5 separated by commas.',
    expectedPattern: '1,2,3,4,5',
    model: 'deepseek-v3',
    difficulty: 'easy',
    tolerance: 3
  },
  {
    id: 'canary-3',
    prompt: 'What is 2+2? Answer with just the number.',
    expectedPattern: '4',
    model: 'deepseek-v3',
    difficulty: 'easy',
    tolerance: 0
  },
  {
    id: 'canary-4',
    prompt: 'Complete the sentence: "The sky is"',
    expectedPattern: 'blue',
    model: 'deepseek-v3',
    difficulty: 'medium',
    tolerance: 10
  },
  {
    id: 'canary-5',
    prompt: 'List the first three letters of the alphabet.',
    expectedPattern: 'a,b,c',
    model: 'deepseek-v3',
    difficulty: 'easy',
    tolerance: 5
  }
];

// Challenge rate: 1% of traffic by default
const CHALLENGE_RATE = 0.01;

// Tracking for challenge results
const challengeResults = new Map<string, ChallengeResult[]>();

/**
 * Check if a job should be a challenge job
 */
export function shouldInsertChallenge(): boolean {
  return Math.random() < CHALLENGE_RATE;
}

/**
 * Get a random challenge job
 */
export function getRandomChallenge(): ChallengeJob {
  return CHALLENGE_PROMPTS[Math.floor(Math.random() * CHALLENGE_PROMPTS.length)];
}

/**
 * Calculate similarity between expected and actual output
 * Uses Levenshtein distance normalized by length
 */
export function calculateSimilarity(expected: string, actual: string): number {
  const distance = levenshteinDistance(expected.toLowerCase(), actual.toLowerCase());
  const maxLen = Math.max(expected.length, actual.length);
  return 1 - (distance / maxLen);
}

/**
 * Levenshtein distance algorithm
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Verify a challenge response
 */
export function verifyChallenge(
  challenge: ChallengeJob,
  actualOutput: string
): { passed: boolean; similarity: number } {
  const similarity = calculateSimilarity(challenge.expectedPattern, actualOutput);
  const passed = similarity >= (1 - challenge.tolerance / 100);
  
  return { passed, similarity };
}

/**
 * Record challenge result for a node
 */
export function recordChallengeResult(
  nodeId: string,
  jobId: string,
  passed: boolean,
  similarity: number
): void {
  const result: ChallengeResult = {
    jobId,
    nodeId,
    passed,
    similarity,
    timestamp: Date.now()
  };

  if (!challengeResults.has(nodeId)) {
    challengeResults.set(nodeId, []);
  }
  
  const results = challengeResults.get(nodeId)!;
  results.push(result);
  
  // Keep only last 100 results per node
  if (results.length > 100) {
    results.shift();
  }

  // Store in database for persistence
  const stmt = db.prepare(`
    INSERT INTO challenge_results (node_id, job_id, passed, similarity, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(nodeId, jobId, passed ? 1 : 0, similarity, Date.now());
}

/**
 * Get challenge statistics for a node
 */
export function getNodeChallengeStats(nodeId: string): {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  avgSimilarity: number;
  lastChallengeAt: number | null;
} {
  const results = challengeResults.get(nodeId) || [];
  
  if (results.length === 0) {
    return {
      total: 0,
      passed: 0,
      failed: 0,
      passRate: 1.0,
      avgSimilarity: 1.0,
      lastChallengeAt: null
    };
  }

  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const avgSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / total;
  
  return {
    total,
    passed,
    failed: total - passed,
    passRate: passed / total,
    avgSimilarity,
    lastChallengeAt: results[results.length - 1].timestamp
  };
}

/**
 * Check if node should be flagged for review based on challenge failures
 */
export function shouldFlagNode(nodeId: string): { flag: boolean; reason?: string } {
  const stats = getNodeChallengeStats(nodeId);
  
  if (stats.total < 5) {
    return { flag: false }; // Not enough data
  }
  
  if (stats.passRate < 0.5) {
    return { 
      flag: true, 
      reason: `Challenge pass rate ${(stats.passRate * 100).toFixed(1)}% below 50%` 
    };
  }
  
  if (stats.avgSimilarity < 0.7) {
    return {
      flag: true,
      reason: `Average similarity ${(stats.avgSimilarity * 100).toFixed(1)}% below 70%`
    };
  }
  
  return { flag: false };
}

/**
 * Mark a job as challenge in database
 */
export function markJobAsChallenge(jobId: string, challengeId: string): void {
  const stmt = db.prepare(`
    UPDATE usage_events SET is_challenge = 1, challenge_id = ? WHERE id = ?
  `);
  stmt.run(challengeId, jobId);
}

/**
 * Get all flagged nodes for admin review
 */
export function getFlaggedNodes(): Array<{
  nodeId: string;
  passRate: number;
  avgSimilarity: number;
  reason: string;
}> {
  const flagged: Array<{ nodeId: string; passRate: number; avgSimilarity: number; reason: string }> = [];
  
  for (const [nodeId] of challengeResults) {
    const check = shouldFlagNode(nodeId);
    if (check.flag) {
      const stats = getNodeChallengeStats(nodeId);
      flagged.push({
        nodeId,
        passRate: stats.passRate,
        avgSimilarity: stats.avgSimilarity,
        reason: check.reason!
      });
    }
  }
  
  return flagged;
}

// Database migration for challenge results
db.exec(`
  CREATE TABLE IF NOT EXISTS challenge_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT NOT NULL,
    job_id TEXT NOT NULL,
    passed INTEGER NOT NULL DEFAULT 0,
    similarity REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  
  CREATE INDEX IF NOT EXISTS idx_challenge_node ON challenge_results(node_id);
  CREATE INDEX IF NOT EXISTS idx_challenge_created ON challenge_results(created_at);
`);
