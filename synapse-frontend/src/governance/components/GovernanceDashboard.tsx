import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { 
  LayoutDashboard, 
  Vote, 
  Wallet, 
  Shield, 
  Clock,
  Users,
  BarChart3,
  Settings,
  Plus
} from 'lucide-react';

import { ProposalCard } from './ProposalCard';
import { ProposalCreationModal } from './ProposalCreationModal';
import { TreasuryDashboard } from './TreasuryDashboard';
import { DelegationPanel } from './DelegationPanel';
import { TimelockVisualization } from './TimelockVisualization';
import { GnosisSafeManager } from './GnosisSafeManager';

import { useGovernanceContract } from '../hooks/useGovernance';
import { useTreasuryAnalytics } from '../hooks/useTreasuryAnalytics';
import { useGnosisSafeModule } from '../hooks/useGnosisSafe';

import { 
  Proposal, 
  ProposalState, 
  ProposalTemplate,
  TreasuryAsset,
  TreasuryStats,
  TimelockOperation,
  GnosisSafeInfo,
  SafeTransaction,
  TimelockState 
} from '../types';

interface GovernanceDashboardProps {
  governorAddress?: `0x${string}`;
  treasuryAddress?: `0x${string}`;
  analyticsAddress?: `0x${string}`;
  timelockAddress?: `0x${string}`;
  safeModuleAddress?: `0x${string}`;
}

export function GovernanceDashboard({
  governorAddress,
  treasuryAddress,
  analyticsAddress,
  timelockAddress,
  safeModuleAddress,
}: GovernanceDashboardProps) {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState<'proposals' | 'treasury' | 'delegation' | 'timelock' | 'multisig'>('proposals');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoadingProposals, setIsLoadingProposals] = useState(false);

  // Hooks
  const governance = useGovernanceContract(governorAddress);
  const treasury = useTreasuryAnalytics(analyticsAddress, treasuryAddress);
  const gnosisSafe = useGnosisSafeModule(safeModuleAddress);

  // Load proposals
  useEffect(() => {
    const loadProposals = async () => {
      if (!governorAddress || governance.proposalCount === 0) return;
      
      setIsLoadingProposals(true);
      const loadedProposals: Proposal[] = [];
      
      for (let i = governance.proposalCount; i > Math.max(0, governance.proposalCount - 20); i--) {
        const proposal = await governance.fetchProposal(i);
        if (proposal) {
          loadedProposals.push(proposal);
        }
      }
      
      setProposals(loadedProposals);
      setIsLoadingProposals(false);
    };

    loadProposals();
  }, [governorAddress, governance.proposalCount]);

  // Mock data for demonstration
  const mockTimelockOperations: TimelockOperation[] = [
    {
      id: '0x1234567890abcdef',
      target: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      value: '0',
      data: '0x',
      eta: Math.floor(Date.now() / 1000) + 86400,
      executed: false,
      canceled: false,
      createdAt: Math.floor(Date.now() / 1000) - 86400,
      delay: 172800,
      proposer: '0x1234...5678',
      description: 'Transfer 1000 HSK to marketing wallet',
      state: TimelockState.Pending,
      timeUntilExecution: 86400,
      progressPercent: 50,
    },
  ];

  const mockSafes: GnosisSafeInfo[] = gnosisSafe.registeredSafes.map(addr => ({
    address: addr,
    requiredConfirmations: 2,
    isActive: true,
    delegateCount: 3,
    delegates: [],
  }));

  const mockSafeTransactions: SafeTransaction[] = [];

  // Stats
  const stats = {
    proposals: {
      total: governance.proposalCount,
      active: proposals.filter(p => p.state === 'Active').length,
      executed: proposals.filter(p => p.state === 'Executed').length,
    },
    treasury: {
      totalValueUSD: treasury.totalValueUSD,
      ethValueUSD: treasury.ethValueUSD,
      tokenValuesUSD: treasury.tokenValuesUSD,
      totalSpent: treasury.totalSpent,
      totalBurned: treasury.totalBurned,
      totalRevenue: treasury.totalRevenue,
      assetCount: treasury.assets.length,
      burnRate: treasury.burnRate,
      stakingShare: treasury.stakingShare,
      treasuryShare: treasury.treasuryShare,
    } as TreasuryStats,
  };

  const handleCreateProposal = async (params: any) => {
    await governance.createProposal(params);
    setShowCreateModal(false);
  };

  const handleVote = async (proposalId: number, support: number) => {
    await governance.castVote({ proposalId, support });
  };

  const handleDelegate = async (delegatee: string, amount: string) => {
    await governance.delegate({ delegatee, amount });
  };

  const handleRevokeDelegation = async () => {
    await governance.revokeDelegation();
  };

  const tabs = [
    { id: 'proposals', label: 'Proposals', icon: Vote, count: stats.proposals.active },
    { id: 'treasury', label: 'Treasury', icon: Wallet },
    { id: 'delegation', label: 'Delegation', icon: Users },
    { id: 'timelock', label: 'Timelock', icon: Clock },
    { id: 'multisig', label: 'Multi-sig', icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">DAO Governance</h1>
              <p className="text-sm text-gray-500 mt-1">
                Participate in protocol governance and treasury management
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm text-gray-500">Your Voting Power</div>
                <div className="text-xl font-bold text-gray-900">
                  {parseFloat(governance.votingPower).toFixed(2)}
                </div>
              </div>
              {activeTab === 'proposals' && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Proposal
                </button>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'proposals' && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <div className="text-sm text-gray-500">Total Proposals</div>
                <div className="text-2xl font-bold text-gray-900">{stats.proposals.total}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <div className="text-sm text-gray-500">Active</div>
                <div className="text-2xl font-bold text-green-600">{stats.proposals.active}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <div className="text-sm text-gray-500">Executed</div>
                <div className="text-2xl font-bold text-blue-600">{stats.proposals.executed}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <div className="text-sm text-gray-500">Quorum Required</div>
                <div className="text-2xl font-bold text-gray-900">
                  {parseFloat(governance.quorum).toFixed(0)}
                </div>
              </div>
            </div>

            {/* Proposals List */}
            <div className="space-y-4">
              {isLoadingProposals ? (
                <div className="text-center py-12">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                  <p className="text-gray-500 mt-3">Loading proposals...</p>
                </div>
              ) : proposals.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                  <Vote className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500">No proposals yet</p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Create the first proposal
                  </button>
                </div>
              ) : (
                proposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    onVote={(support) => handleVote(proposal.id, support)}
                    isVoting={governance.isPending}
                    userVotingPower={governance.votingPower}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'treasury' && (
          <TreasuryDashboard
            assets={treasury.assets}
            stats={stats.treasury}
            onRefresh={treasury.refetchTreasuryValue}
            isLoading={treasury.isPending}
          />
        )}

        {activeTab === 'delegation' && (
          <div className="max-w-2xl mx-auto">
            <DelegationPanel
              delegationInfo={governance.delegationInfo}
              onDelegate={handleDelegate}
              onRevoke={handleRevokeDelegation}
              isProcessing={governance.isPending}
              userVotingPower={governance.votingPower}
            />
          </div>
        )}

        {activeTab === 'timelock' && (
          <TimelockVisualization
            operations={mockTimelockOperations}
            isProcessing={governance.isPending}
          />
        )}

        {activeTab === 'multisig' && (
          <GnosisSafeManager
            safes={mockSafes}
            transactions={mockSafeTransactions}
            isProcessing={gnosisSafe.isPending}
          />
        )}
      </div>

      {/* Create Proposal Modal */}
      <ProposalCreationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateProposal}
        templates={[]}
        isSubmitting={governance.isPending}
        userVotingPower={governance.votingPower}
        proposalThreshold={governance.proposalThreshold}
      />
    </div>
  );
}

export default GovernanceDashboard;