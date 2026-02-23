import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, Users, ExternalLink, CheckCircle, XCircle, Minus, AlertCircle } from 'lucide-react';
import { formatAddress, formatNumber, formatTimeAgo } from '../utils';

const mockProposal = {
  id: '1',
  title: 'Increase Minimum Node Stake to 10,000 SYN',
  description: `To improve network security and reduce sybil attacks, we propose increasing the minimum stake requirement for node operators from 5,000 SYN to 10,000 SYN.

This change will help ensure that only committed operators participate in the network and improve overall reliability. The increased stake requirement acts as an economic deterrent against malicious behavior and ensures that operators have sufficient skin in the game.

## Key Points

- **Current minimum**: 5,000 SYN
- **Proposed minimum**: 10,000 SYN
- **Impact**: Existing nodes will have 30 days to increase their stake
- **Rationale**: Improve network security and operator commitment

## Technical Details

The proposal updates the minimumStake parameter in the NodeRegistry contract from 5000e18 to 10000e18. This is a simple parameter change with no other contract modifications required.

## Vote Options

- **For**: Increase minimum stake to 10,000 SYN
- **Against**: Keep minimum stake at 5,000 SYN
- **Abstain**: No opinion on this proposal`,
  proposer: '0x1234567890123456789012345678901234567890',
  status: 'active',
  votesFor: '2500000',
  votesAgainst: '800000',
  votesAbstain: '150000',
  quorum: '5000000',
  startTime: Date.now() - 86400000 * 2,
  endTime: Date.now() + 86400000 * 5,
  actions: [{ target: '0xNodeRegistry', value: '0', signature: 'updateMinStake(uint256)', calldata: '0x...' }],
};

const mockVotes = [
  { voter: '0xabc...', support: 'for', weight: '500000', timestamp: Date.now() - 86400000 },
  { voter: '0xdef...', support: 'against', weight: '200000', timestamp: Date.now() - 172800000 },
  { voter: '0xghi...', support: 'for', weight: '750000', timestamp: Date.now() - 259200000 },
];

export default function ProposalDetails() {
  const { id } = useParams();
  const proposal = mockProposal; // In real app, fetch by id

  const totalVotes = parseFloat(proposal.votesFor) + parseFloat(proposal.votesAgainst) + parseFloat(proposal.votesAbstain);
  const forPercentage = totalVotes > 0 ? (parseFloat(proposal.votesFor) / totalVotes) * 100 : 0;
  const againstPercentage = totalVotes > 0 ? (parseFloat(proposal.votesAgainst) / totalVotes) * 100 : 0;
  const quorumPercentage = (totalVotes / parseFloat(proposal.quorum)) * 100;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'passed': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'rejected': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'executed': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      default: return 'text-neutral-400 bg-neutral-500/10 border-neutral-500/20';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Link */}
      <Link to="/governance" className="inline-flex items-center gap-2 text-neutral-400 hover:text-emerald-400 transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to Proposals
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className={`text-xs px-2 py-1 rounded border ${getStatusColor(proposal.status)} uppercase tracking-wider`}>
            {proposal.status}
          </span>
          <span className="text-xs text-neutral-500">Proposal #{proposal.id}</span>
        </div>
        <h1 className="text-3xl font-bold mb-4">{proposal.title}</h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-400">
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            by {formatAddress(proposal.proposer)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {formatTimeAgo(proposal.startTime)}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Description</h2>
            <div className="prose prose-invert prose-sm max-w-none">
              {proposal.description.split('\n\n').map((paragraph, i) => {
                if (paragraph.startsWith('## ')) {
                  return <h3 key={i} className="text-lg font-semibold mt-6 mb-3">{paragraph.replace('## ', '')}</h3>;
                }
                if (paragraph.startsWith('- ')) {
                  return (
                    <ul key={i} className="list-disc list-inside space-y-1 mb-4">
                      {paragraph.split('\n').map((item, j) => (
                        <li key={j} className="text-neutral-300">{item.replace('- ', '')}</li>
                      ))}
                    </ul>
                  );
                }
                return <p key={i} className="text-neutral-300 mb-4">{paragraph}</p>;
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Proposed Actions</h2>
            <div className="space-y-3">
              {proposal.actions.map((action, i) => (
                <div key={i} className="p-4 bg-[#0a0a0a] rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-sm text-emerald-400">{action.target}</code>
                    <span className="text-xs text-neutral-500">→</span>
                    <code className="text-sm text-blue-400">{action.signature}</code>
                  </div>
                  <p className="text-xs text-neutral-500">Calldata: {action.calldata.slice(0, 20)}...</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Votes */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Votes</h2>
            <div className="space-y-3">
              {mockVotes.map((vote, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg">
                  <div className="flex items-center gap-3">
                    {vote.support === 'for' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                    {vote.support === 'against' && <XCircle className="w-4 h-4 text-red-400" />}
                    {vote.support === 'abstain' && <Minus className="w-4 h-4 text-neutral-400" />}
                    <span className="text-sm">{formatAddress(vote.voter)}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatNumber(parseFloat(vote.weight))} SYN</p>
                    <p className="text-xs text-neutral-500">{formatTimeAgo(vote.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Vote Status */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
            <h3 className="font-semibold mb-4">Vote Status</h3>
            
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-neutral-400">Quorum</span>
                <span className="text-neutral-400">{formatNumber(quorumPercentage, 1)}%</span>
              </div>
              <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(quorumPercentage, 100)}%` }} />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> For
                  </span>
                  <span>{formatNumber(forPercentage, 1)}%</span>
                </div>
                <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${forPercentage}%` }} />
                </div>
                <p className="text-xs text-neutral-500 mt-1">{formatNumber(parseFloat(proposal.votesFor))} SYN</p>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-red-400 flex items-center gap-1">
                    <XCircle className="w-4 h-4" /> Against
                  </span>
                  <span>{formatNumber(againstPercentage, 1)}%</span>
                </div>
                <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${againstPercentage}%` }} />
                </div>
                <p className="text-xs text-neutral-500 mt-1">{formatNumber(parseFloat(proposal.votesAgainst))} SYN</p>
              </div>
            </div>

            {proposal.status === 'active' && (
              <div className="mt-6 pt-6 border-t border-white/[0.06]">
                <p className="text-sm text-neutral-400 mb-3">Cast your vote</p>
                <div className="space-y-2">
                  <button className="w-full py-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors">
                    Vote For
                  </button>
                  <button className="w-full py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors">
                    Vote Against
                  </button>
                  <button className="w-full py-2 bg-white/[0.05] text-neutral-400 rounded-lg hover:bg-white/[0.08] transition-colors">
                    Abstain
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
            <h3 className="font-semibold mb-4">Timeline</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2" />
                <div>
                  <p className="text-sm font-medium">Proposal Created</p>
                  <p className="text-xs text-neutral-500">{formatTimeAgo(proposal.startTime)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 animate-pulse" />
                <div>
                  <p className="text-sm font-medium">Voting Period</p>
                  <p className="text-xs text-neutral-500">Ends in 5 days</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-neutral-600 rounded-full mt-2" />
                <div>
                  <p className="text-sm text-neutral-400">Execution</p>
                  <p className="text-xs text-neutral-600">Pending</p>
                </div>
              </div>
            </div>
          </div>

          {/* External Links */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
            <h3 className="font-semibold mb-3">External Links</h3>
            <a 
              href={`https://etherscan.io/address/${proposal.proposer}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-neutral-400 hover:text-emerald-400 transition-colors"
            >
              View on Etherscan
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
