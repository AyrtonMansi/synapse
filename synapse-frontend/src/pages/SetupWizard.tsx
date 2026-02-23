import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Check, Cpu, HardDrive, Globe, Terminal, Settings, Shield, 
  ChevronRight, ChevronLeft, Download, Copy, RefreshCw, 
  Zap, Wallet, Server, Sparkles, AlertCircle, QrCode,
  Smartphone, ExternalLink, Play, Pause, RotateCcw,
  Thermometer, Activity, TrendingUp, Clock, Award
} from 'lucide-react';
import { WalletConnect } from '../components/WalletConnect';
import { formatAddress } from '../utils';

interface SetupStep {
  id: number;
  title: string;
  description: string;
  icon: any;
}

const setupSteps: SetupStep[] = [
  { id: 1, title: 'System Check', description: 'Verify hardware and software requirements', icon: Server },
  { id: 2, title: 'Wallet Setup', description: 'Connect or create your wallet', icon: Wallet },
  { id: 3, title: 'Node Configuration', description: 'Configure your mining node', icon: Settings },
  { id: 4, title: 'Download & Install', description: 'Install the Synapse node software', icon: Download },
  { id: 5, title: 'Start Mining', description: 'Launch your node and start earning', icon: Zap },
];

interface SystemRequirements {
  docker: boolean;
  gpu: {
    detected: boolean;
    type: 'nvidia' | 'amd' | 'apple' | 'cpu' | null;
    name: string;
    vram: number;
  };
  os: string;
  internet: boolean;
}

interface NodeConfig {
  name: string;
  region: string;
  stakeAmount: number;
  autoUpdate: boolean;
  enableMonitoring: boolean;
}

const REGIONS = [
  { code: 'us-east-1', name: 'US East (N. Virginia)', flag: '🇺🇸' },
  { code: 'us-west-1', name: 'US West (N. California)', flag: '🇺🇸' },
  { code: 'us-west-2', name: 'US West (Oregon)', flag: '🇺🇸' },
  { code: 'eu-west-1', name: 'Europe (Ireland)', flag: '🇮🇪' },
  { code: 'eu-central-1', name: 'Europe (Frankfurt)', flag: '🇩🇪' },
  { code: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', flag: '🇸🇬' },
  { code: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)', flag: '🇯🇵' },
  { code: 'ap-southeast-2', name: 'Asia Pacific (Sydney)', flag: '🇦🇺' },
];

const GPU_TIERS = [
  { name: 'Entry', vram: 8, earnings: '~$50-100/mo', color: 'bg-slate-500' },
  { name: 'Mid Range', vram: 16, earnings: '~$200-400/mo', color: 'bg-blue-500' },
  { name: 'High End', vram: 24, earnings: '~$500-1000/mo', color: 'bg-purple-500' },
  { name: 'Professional', vram: 48, earnings: '~$1500-3000/mo', color: 'bg-emerald-500' },
  { name: 'Enterprise', vram: 80, earnings: '~$5000-10000/mo', color: 'bg-amber-500' },
];

export default function NodeSetupWizard() {
  const { address, isConnected } = useAccount();
  const [currentStep, setCurrentStep] = useState(1);
  const [isChecking, setIsChecking] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemRequirements | null>(null);
  const [nodeConfig, setNodeConfig] = useState<NodeConfig>({
    name: '',
    region: 'us-east-1',
    stakeAmount: 10000,
    autoUpdate: true,
    enableMonitoring: true,
  });
  const [generatedCommand, setGeneratedCommand] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [showQRCode, setShowQRCode] = useState(false);
  const [mobileUrl, setMobileUrl] = useState('');
  const [nodeStatus, setNodeStatus] = useState<'idle' | 'installing' | 'running' | 'error'>('idle');

  // Detect system capabilities
  const runSystemCheck = useCallback(async () => {
    setIsChecking(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockStatus: SystemRequirements = {
      docker: Math.random() > 0.3,
      gpu: {
        detected: Math.random() > 0.2,
        type: Math.random() > 0.5 ? 'nvidia' : Math.random() > 0.5 ? 'amd' : 'cpu',
        name: 'NVIDIA RTX 4090',
        vram: 24,
      },
      os: navigator.platform,
      internet: navigator.onLine,
    };
    
    setSystemStatus(mockStatus);
    setIsChecking(false);
    
    if (!nodeConfig.name) {
      const randomId = Math.random().toString(36).substring(2, 6);
      setNodeConfig(prev => ({ ...prev, name: `synapse-node-${randomId}` }));
    }
  }, [nodeConfig.name]);

  useEffect(() => {
    if (currentStep === 1 && !systemStatus) {
      runSystemCheck();
    }
  }, [currentStep, systemStatus, runSystemCheck]);

  const generateDockerCommand = useCallback(() => {
    const command = `curl -fsSL https://get.synapse.network/setup.sh | bash -s -- \\
  --name "${nodeConfig.name}" \\
  --region ${nodeConfig.region} \\
  --wallet ${address} \\
  --stake ${nodeConfig.stakeAmount} \\
  ${nodeConfig.autoUpdate ? '--auto-update' : ''} \\
  ${nodeConfig.enableMonitoring ? '--monitoring' : ''}`;
    setGeneratedCommand(command);
  }, [nodeConfig, address]);

  useEffect(() => {
    if (currentStep === 4 && address) {
      generateDockerCommand();
    }
  }, [currentStep, address, generateDockerCommand]);

  const generateMobileUrl = useCallback(() => {
    const baseUrl = 'https://app.synapse.network/mobile-setup';
    const params = new URLSearchParams({
      node: nodeConfig.name,
      region: nodeConfig.region,
      wallet: address || '',
      step: currentStep.toString(),
    });
    setMobileUrl(`${baseUrl}?${params.toString()}`);
  }, [nodeConfig, address, currentStep]);

  useEffect(() => {
    generateMobileUrl();
  }, [generateMobileUrl]);

  const startInstallation = async () => {
    setIsInstalling(true);
    setNodeStatus('installing');
    
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      setInstallProgress(((i + 1) / steps) * 100);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    setIsInstalling(false);
    setNodeStatus('running');
  };

  const copyCommand = () => {
    navigator.clipboard.writeText(generatedCommand);
  };

  const getGpuTier = (vram: number) => {
    return GPU_TIERS.find(tier => vram >= tier.vram) || GPU_TIERS[0];
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return systemStatus !== null;
      case 2: return isConnected;
      case 3: return nodeConfig.name.length > 0;
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            Node Setup Wizard
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Get your Synapse mining node up and running in minutes. 
            Follow these simple steps to start earning rewards.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {setupSteps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => setCurrentStep(step.id)}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                      currentStep === step.id
                        ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                        : currentStep > step.id
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {currentStep > step.id ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <step.icon className="w-5 h-5" />
                    )}
                  </button>
                  <div className="mt-2 text-center hidden sm:block">
                    <p className={`text-sm font-medium ${currentStep === step.id ? 'text-cyan-400' : 'text-slate-400'}`}>
                      {step.title}
                    </p>
                  </div>
                </div>
                {index < setupSteps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-4 ${
                    currentStep > step.id ? 'bg-emerald-500' : 'bg-slate-800'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Card */}
        <div className="glass-card p-6 sm:p-8">
          {/* Step 1: System Check */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-2">System Requirements Check</h3>
                <p className="text-slate-400">Verifying your system can run a Synapse node</p>
              </div>

              {isChecking ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <RefreshCw className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
                  <p className="text-slate-400">Checking system capabilities...</p>
                </div>
              ) : systemStatus ? (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl border ${systemStatus.docker ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${systemStatus.docker ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                          <Server className={`w-5 h-5 ${systemStatus.docker ? 'text-emerald-400' : 'text-red-400'}`} />
                        </div>
                        <div>
                          <p className="font-medium">Docker</p>
                          <p className="text-sm text-slate-400">
                            {systemStatus.docker ? 'Installed and ready' : 'Not detected - will install'}
                          </p>
                        </div>
                      </div>
                      {systemStatus.docker ? <Check className="w-6 h-6 text-emerald-400" /> : <AlertCircle className="w-6 h-6 text-red-400" />}
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl border ${systemStatus.gpu.detected ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${systemStatus.gpu.detected ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
                          <Cpu className={`w-5 h-5 ${systemStatus.gpu.detected ? 'text-emerald-400' : 'text-amber-400'}`} />
                        </div>
                        <div>
                          <p className="font-medium">
                            {systemStatus.gpu.detected ? systemStatus.gpu.name : 'No GPU Detected'}
                          </p>
                          <p className="text-sm text-slate-400">
                            {systemStatus.gpu.detected 
                              ? `${systemStatus.gpu.vram}GB VRAM - ${getGpuTier(systemStatus.gpu.vram).earnings} estimated`
                              : 'Will run in CPU-only mode (lower earnings)'}
                          </p>
                        </div>
                      </div>
                      {systemStatus.gpu.detected ? <Check className="w-6 h-6 text-emerald-400" /> : <AlertCircle className="w-6 h-6 text-amber-400" />}
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl border ${systemStatus.internet ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${systemStatus.internet ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                          <Globe className={`w-5 h-5 ${systemStatus.internet ? 'text-emerald-400' : 'text-red-400'}`} />
                        </div>
                        <div>
                          <p className="font-medium">Internet Connection</p>
                          <p className="text-sm text-slate-400">{systemStatus.internet ? 'Connected' : 'No connection'}</p>
                        </div>
                      </div>
                      {systemStatus.internet ? <Check className="w-6 h-6 text-emerald-400" /> : <AlertCircle className="w-6 h-6 text-red-400" />}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Step 2: Wallet Setup */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-2">Wallet Configuration</h3>
                <p className="text-slate-400">Connect your wallet to receive mining rewards</p>
              </div>

              {!isConnected ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-2xl flex items-center justify-center">
                    <Wallet className="w-10 h-10 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="text-slate-300 mb-4">Connect your wallet to continue</p>
                    <WalletConnect />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                        <Check className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-emerald-400">Wallet Connected</p>
                        <p className="text-sm text-slate-400 font-mono">{formatAddress(address || '')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card p-6">
                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      Available Balance
                    </h4>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">0.00</span>
                      <span className="text-slate-400">SYN</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-2">
                      You'll need at least 5,000 SYN to stake and start mining
                    </p>
                    <button className="btn-primary mt-4 w-full">Get SYN Tokens</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Node Configuration */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-2">Node Configuration</h3>
                <p className="text-slate-400">Customize your mining node settings</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Node Name</label>
                  <input
                    type="text"
                    value={nodeConfig.name}
                    onChange={(e) => setNodeConfig(prev => ({ ...prev, name: e.target.value }))}
                    className="input-field w-full"
                    placeholder="Enter a name for your node"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Region</label>
                  <select
                    value={nodeConfig.region}
                    onChange={(e) => setNodeConfig(prev => ({ ...prev, region: e.target.value }))}
                    className="input-field w-full"
                  >
                    {REGIONS.map(region => (
                      <option key={region.code} value={region.code}>
                        {region.flag} {region.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Stake Amount (SYN)</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="5000"
                      max="100000"
                      step="1000"
                      value={nodeConfig.stakeAmount}
                      onChange={(e) => setNodeConfig(prev => ({ ...prev, stakeAmount: parseInt(e.target.value) }))}
                      className="flex-1"
                    />
                    <input
                      type="number"
                      value={nodeConfig.stakeAmount}
                      onChange={(e) => setNodeConfig(prev => ({ ...prev, stakeAmount: parseInt(e.target.value) }))}
                      className="input-field w-32 text-center"
                    />
                  </div>
                </div>

                {systemStatus?.gpu.detected && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                      <span className="font-medium text-emerald-400">Estimated Earnings</span>
                    </div>
                    <p className="text-2xl font-bold">{getGpuTier(systemStatus.gpu.vram).earnings}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Download & Install */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-2">Download & Install</h3>
                <p className="text-slate-400">Run this command in your terminal to install</p>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <div className="absolute top-3 right-3 flex gap-2">
                    <button
                      onClick={copyCommand}
                      className="p-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
                      title="Copy to clipboard"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <pre className="bg-slate-950 p-4 pr-16 rounded-xl overflow-x-auto text-sm font-mono">
                    <code className="text-slate-300">{generatedCommand}</code>
                  </pre>
                </div>

                <div className="p-4 rounded-xl border border-slate-700/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-5 h-5 text-cyan-400" />
                      <span className="font-medium">Mobile Setup</span>
                    </div>
                    <button
                      onClick={() => setShowQRCode(!showQRCode)}
                      className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      <QrCode className="w-4 h-4" />
                      {showQRCode ? 'Hide QR' : 'Show QR'}
                    </button>
                  </div>
                  
                  {showQRCode && (
                    <div className="flex flex-col items-center py-4">
                      <QRCodeSVG value={mobileUrl} size={200} level="M" bgColor="#0f172a" fgColor="#22d3ee" />
                      <p className="text-sm text-slate-400 mt-4 text-center">
                        Scan with Synapse mobile app to continue setup
                      </p>
                    </div>
                  )}
                </div>

                {isInstalling && (
                  <div className="p-4 rounded-xl bg-slate-800/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm">Installing...</span>
                      <span className="text-sm text-cyan-400">{Math.round(installProgress)}%</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-500"
                        style={{ width: `${installProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Start Mining */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-2">Start Mining</h3>
                <p className="text-slate-400">Your node is ready to start earning</p>
              </div>

              <div className="space-y-4">
                <div className={`p-6 rounded-xl border ${nodeStatus === 'running' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-700/50 bg-slate-800/30'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${nodeStatus === 'running' ? 'bg-emerald-500/20' : 'bg-slate-700/50'}`}>
                        {nodeStatus === 'running' ? <Activity className="w-6 h-6 text-emerald-400" /> : <Server className="w-6 h-6 text-slate-400" />}
                      </div>
                      <div>
                        <p className="font-medium">{nodeStatus === 'running' ? 'Node Running' : 'Node Ready'}</p>
                        <p className="text-sm text-slate-400">
                          {nodeStatus === 'running' ? 'Connected to Synapse network' : 'Ready to start mining'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {nodeStatus === 'running' ? (
                        <button onClick={() => setNodeStatus('idle')} className="p-2 bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500/20">
                          <Pause className="w-5 h-5" />
                        </button>
                      ) : (
                        <button onClick={() => setNodeStatus('running')} className="btn-primary flex items-center gap-2">
                          <Play className="w-4 h-4" />
                          Start
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {nodeStatus === 'running' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-800/50">
                      <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Thermometer className="w-4 h-4" />
                        <span className="text-sm">GPU Temp</span>
                      </div>
                      <p className="text-2xl font-bold">72°C</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-800/50">
                      <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Activity className="w-4 h-4" />
                        <span className="text-sm">Utilization</span>
                      </div>
                      <p className="text-2xl font-bold">89%</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-800/50">
                      <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">Uptime</span>
                      </div>
                      <p className="text-2xl font-bold">2h 34m</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-800/50">
                      <div className="flex items-center gap-2 text-emerald-400 mb-2">
                        <Award className="w-4 h-4" />
                        <span className="text-sm">Earned</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-400">12.45 SYN</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8">
          <button
            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          
          <button
            onClick={() => setCurrentStep(prev => Math.min(5, prev + 1))}
            disabled={!canProceed() || currentStep === 5}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {currentStep === 4 ? 'Complete Setup' : 'Next'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
