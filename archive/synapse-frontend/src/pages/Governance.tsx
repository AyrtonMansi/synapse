import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Vote, 
  Wallet, 
  Shield, 
  Clock,
  Users,
  BarChart3,
  Settings,
  Plus,
  ExternalLink
} from 'lucide-react';
import { WalletConnect } from '../components/WalletConnect';
import { GovernanceDashboard } from '../governance/components/GovernanceDashboard';
import { GOVERNANCE_CONTRACTS } from '../governance';

export default function Governance() {
  const [showNewDashboard, setShowNewDashboard] = useState(false);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Governance</h1>
          <p className="text-neutral-400 mt-1">Shape the future of Synapse Protocol</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewDashboard(!showNewDashboard)}
            className="bg-emerald-500 hover:bg-emerald-600 text-black px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <LayoutDashboard className="w-4 h-4" />
            {showNewDashboard ? 'Classic View' : 'New Dashboard'}
          </button>
          <a 
            href="https://snapshot.org/#/synapseprotocol.eth" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-white/[0.05] border border-white/[0.08] text-white px-4 py-2 rounded-lg text-sm hover:bg-white/[0.08] transition-colors flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Snapshot
          </a>
          <WalletConnect />
        </div>
      </div>

      {/* New Governance Dashboard */}
      <AnimatePresence mode="wait">
        {showNewDashboard ? (
          <motion.div
            key="new-dashboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="-mx-4 sm:-mx-6 lg:-mx-8"
          >
            <GovernanceDashboard
              governorAddress={GOVERNANCE_CONTRACTS.governor}
              treasuryAddress={GOVERNANCE_CONTRACTS.treasury}
              analyticsAddress={GOVERNANCE_CONTRACTS.analytics}
              timelockAddress={GOVERNANCE_CONTRACTS.timelock}
              safeModuleAddress={GOVERNANCE_CONTRACTS.safeModule}
            />
          </motion.div>
        ) : (
          <motion.div
            key="classic-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Feature Preview Banner */}
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6 mb-8">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-500/20 rounded-lg">
                  <LayoutDashboard className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    New DAO Dashboard Available
                  </h3>
                  <p className="text-neutral-400 mb-4">
                    Experience our enhanced governance interface with real-time treasury analytics, 
                    quadratic voting, delegation tracking, timelock visualization, and Gnosis Safe integration.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <span className="flex items-center gap-1 text-sm text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full">
                      <Vote className="w-3 h-3" /> Proposal Creation
                    </span>
                    <span className="flex items-center gap-1 text-sm text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full">
                      <BarChart3 className="w-3 h-3" /> Quadratic Voting
                    </span>
                    <span className="flex items-center gap-1 text-sm text-green-400 bg-green-500/10 px-3 py-1 rounded-full">
                      <Wallet className="w-3 h-3" /> Treasury Analytics
                    </span>
                    <span className="flex items-center gap-1 text-sm text-orange-400 bg-orange-500/10 px-3 py-1 rounded-full">
                      <Users className="w-3 h-3" /> Delegation
                    </span>
                    <span className="flex items-center gap-1 text-sm text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full">
                      <Clock className="w-3 h-3" /> Timelock
                    </span>
                    <span className="flex items-center gap-1 text-sm text-pink-400 bg-pink-500/10 px-3 py-1 rounded-full">
                      <Shield className="w-3 h-3" /> Multi-sig
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Classic View Content */}
            <div className="text-center py-12">
              <Vote className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Classic Governance View</h2>
              <p className="text-neutral-400 mb-6">
                The classic governance interface is being upgraded. 
                Click "New Dashboard" to try the enhanced experience.
              </p>
              <button
                onClick={() => setShowNewDashboard(true)}
                className="bg-emerald-500 hover:bg-emerald-600 text-black px-6 py-3 rounded-lg font-medium transition-colors inline-flex items-center gap-2"
              >
                <LayoutDashboard className="w-5 h-5" />
                Open New Dashboard
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}