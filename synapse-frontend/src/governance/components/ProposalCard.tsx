import { useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { 
  CheckCircle2, 
  XCircle, 
  MinusCircle, 
  Clock, 
  AlertCircle,
  Play,
  Ban,
  BarChart3,
  Users,
  Calculator
} from 'lucide-react';
import type { Proposal, VoteReceipt, ProposalState } from '../types';

interface ProposalCardProps {
  proposal: Proposal;
  receipt?: VoteReceipt | null;
  onVote?: (support: number) => void;
  onQueue?: () => void;
  onExecute?: () => void;
  onCancel?: () => void;
  isVoting?: boolean;
  userVotingPower?: string;
}

const stateConfig: Record<ProposalState, { color: string; icon: React.ReactNode; label: string }> = {
  Pending: { color: 'text-yellow-500', icon: <Clock className="w-4 h-4" />, label: 'Pending' },
  Active: { color: 'text-green-500', icon: <Play className="w-4 h-4" />, label: 'Active' },
  Canceled: { color: 'text-gray-500', icon: <Ban className="w-4 h-4" />, label: 'Canceled' },
  Defeated: { color: 'text-red-500', icon: <XCircle className="w-4 h-4" />, label: 'Defeated' },
  Succeeded: { color: 'text-blue-500', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Succeeded' },
  Queued: { color: 'text-purple-500', icon: <Clock className="w-4 h-4" />, label: 'Queued' },
  Expired: { color: 'text-orange-500', icon: <AlertCircle className="w-4 h-4" />, label: 'Expired' },
  Executed: { color: 'text-emerald-500', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Executed' },
};

const proposalTypeLabels: Record<number, string> = {
  0: 'General',
  1: 'Treasury',
  2: 'Parameter',
  3: 'Upgrade',
};

export function ProposalCard({ 
  proposal, 
  receipt, 
  onVote, 
  onQueue, 
  onExecute, 
  onCancel,
  isVoting,
  userVotingPower = '0'
}: ProposalCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [voteReason, setVoteReason] = useState('');

  const stateInfo = stateConfig[proposal.state];
  const totalVotes = parseFloat(proposal.forVotes) + parseFloat(proposal.againstVotes) + parseFloat(proposal.abstainVotes);
  const forPercentage = totalVotes > 0 ? (parseFloat(proposal.forVotes) / totalVotes) * 100 : 0;
  const againstPercentage = totalVotes > 0 ? (parseFloat(proposal.againstVotes) / totalVotes) * 100 : 0;
  const abstainPercentage = totalVotes > 0 ? (parseFloat(proposal.abstainVotes) / totalVotes) * 100 : 0;

  const canVote = proposal.state === 'Active' && !receipt?.hasVoted && parseFloat(userVotingPower) > 0;
  const canQueue = proposal.state === 'Succeeded' && !proposal.queued;
  const canExecute = proposal.state === 'Queued' && (proposal.eta || 0) < Date.now() / 1000;
  const canCancel = proposal.state === 'Pending' || proposal.state === 'Active';

  const handleVote = (support: number) => {
    onVote?.(support);
    setVoteReason('');
  };

  const formatNumber = (num: string) => {
    const n = parseFloat(num);
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(2)}K`;
    return n.toFixed(2);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 font-mono">#{proposal.id}</span>
            <span className={`flex items-center gap-1 text-sm font-medium ${stateInfo.color}`}>
              {stateInfo.icon}
              {stateInfo.label}
            </span>
            {proposal.useQuadraticVoting && (
              <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                <Calculator className="w-3 h-3" />
                Quadratic
              </span>
            )}
          </div>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
            {proposalTypeLabels[proposal.proposalType]}
          </span>
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mb-2">{proposal.title}</h3>
        <p className="text-gray-600 text-sm line-clamp-2">{proposal.description}</p>

        {/* Proposer info */}
        <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span className="font-mono">{proposal.proposer.slice(0, 6)}...{proposal.proposer.slice(-4)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>
              {proposal.state === 'Active' 
                ? `Ends ${formatDistanceToNow(proposal.endTime * 1000, { addSuffix: true })}`
                : format(proposal.startTime * 1000, 'MMM d, yyyy')
              }
            </span>
          </div>
        </div>
      </div>

      {/* Voting Progress */}
      <div className="px-6 py-4 bg-gray-50 border-y border-gray-100">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-600">Votes</span>
          <span className="font-medium">{formatNumber(totalVotes.toString())} total</span>
        </div>
        
        {/* Progress bars */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-600 w-12">For</span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${forPercentage}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 w-16 text-right">{formatNumber(proposal.forVotes)}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-600 w-12">Against</span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-red-500 rounded-full transition-all"
                style={{ width: `${againstPercentage}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 w-16 text-right">{formatNumber(proposal.againstVotes)}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 w-12">Abstain</span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gray-500 rounded-full transition-all"
                style={{ width: `${abstainPercentage}%` }}
              />
            </div>
            <span className="text-xs text-gray-600 w-16 text-right">{formatNumber(proposal.abstainVotes)}</span>
          </div>
        </div>

        {/* Quadratic voting breakdown */}
        {proposal.useQuadraticVoting && (proposal.quadraticForVotes || proposal.quadraticAgainstVotes) && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2 text-xs text-purple-600 mb-1">
              <BarChart3 className="w-3 h-3" />
              <span>Quadratic Voting Applied</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-500">QV For: </span>
                <span className="font-medium">{formatNumber(proposal.quadraticForVotes || '0')}</span>
              </div>
              <div>
                <span className="text-gray-500">QV Against: </span>
                <span className="font-medium">{formatNumber(proposal.quadraticAgainstVotes || '0')}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4">
        {canVote ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => handleVote(1)}
                disabled={isVoting}
                className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                Vote For
              </button>
              <button
                onClick={() => handleVote(0)}
                disabled={isVoting}
                className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                Vote Against
              </button>
              <button
                onClick={() => handleVote(2)}
                disabled={isVoting}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <MinusCircle className="w-4 h-4" />
                Abstain
              </button>
            </div>
            <input
              type="text"
              placeholder="Reason for vote (optional)"
              value={voteReason}
              onChange={(e) => setVoteReason(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ) : receipt?.hasVoted ? (
          <div className="flex items-center justify-center gap-2 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg">
            {receipt.support === 1 && <CheckCircle2 className="w-4 h-4 text-green-500" />}
            {receipt.support === 0 && <XCircle className="w-4 h-4 text-red-500" />}
            {receipt.support === 2 && <MinusCircle className="w-4 h-4 text-gray-500" />}
            <span>
              You voted {receipt.support === 1 ? 'For' : receipt.support === 0 ? 'Against' : 'Abstain'} 
              ({formatNumber(receipt.votes)} votes)
            </span>
          </div>
        ) : (
          <div className="flex gap-2">
            {canQueue && (
              <button
                onClick={onQueue}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-medium transition-colors"
              >
                Queue
              </button>
            )}
            {canExecute && (
              <button
                onClick={onExecute}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-medium transition-colors"
              >
                Execute
              </button>
            )}
            {canCancel && (
              <button
                onClick={onCancel}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}