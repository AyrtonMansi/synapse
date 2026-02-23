import { useState } from 'react';
import { X, Plus, Trash2, FileText, Calculator, Settings, Wallet, ArrowUpCircle } from 'lucide-react';
import type { CreateProposalParams, ProposalTemplate, ProposalType } from '../types';

interface ProposalCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (params: CreateProposalParams) => void;
  templates?: ProposalTemplate[];
  isSubmitting?: boolean;
  userVotingPower?: string;
  proposalThreshold?: string;
}

export function ProposalCreationModal({
  isOpen,
  onClose,
  onSubmit,
  templates = [],
  isSubmitting,
  userVotingPower = '0',
  proposalThreshold = '0',
}: ProposalCreationModalProps) {
  const [step, setStep] = useState(1);
  const [useTemplate, setUseTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  
  const [formData, setFormData] = useState<CreateProposalParams>({
    targets: [''],
    values: ['0'],
    calldatas: ['0x'],
    title: '',
    description: '',
    proposalType: 0,
    useQuadraticVoting: false,
  });

  const proposalTypes: { value: ProposalType; label: string; icon: React.ReactNode; description: string }[] = [
    { 
      value: 0, 
      label: 'General', 
      icon: <FileText className="w-5 h-5" />,
      description: 'Standard governance proposals'
    },
    { 
      value: 1, 
      label: 'Treasury', 
      icon: <Wallet className="w-5 h-5" />,
      description: 'Spending and treasury management'
    },
    { 
      value: 2, 
      label: 'Parameter', 
      icon: <Settings className="w-5 h-5" />,
      description: 'Protocol parameter changes'
    },
    { 
      value: 3, 
      label: 'Upgrade', 
      icon: <ArrowUpCircle className="w-5 h-5" />,
      description: 'Contract upgrades and migrations'
    },
  ];

  const hasEnoughPower = parseFloat(userVotingPower) >= parseFloat(proposalThreshold);

  const handleAddAction = () => {
    setFormData(prev => ({
      ...prev,
      targets: [...prev.targets, ''],
      values: [...prev.values, '0'],
      calldatas: [...prev.calldatas, '0x'],
    }));
  };

  const handleRemoveAction = (index: number) => {
    setFormData(prev => ({
      ...prev,
      targets: prev.targets.filter((_, i) => i !== index),
      values: prev.values.filter((_, i) => i !== index),
      calldatas: prev.calldatas.filter((_, i) => i !== index),
    }));
  };

  const handleActionChange = (index: number, field: 'targets' | 'values' | 'calldatas', value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item),
    }));
  };

  const handleSelectTemplate = (templateId: number) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setFormData(prev => ({
        ...prev,
        targets: template.defaultTargets,
        calldatas: template.defaultCalldatas,
        values: new Array(template.defaultTargets.length).fill('0'),
        proposalType: template.proposalType,
        useQuadraticVoting: template.useQuadraticVoting,
      }));
    }
  };

  const handleSubmit = () => {
    onSubmit(formData);
  };

  const resetForm = () => {
    setStep(1);
    setUseTemplate(false);
    setSelectedTemplate(null);
    setFormData({
      targets: [''],
      values: ['0'],
      calldatas: ['0x'],
      title: '',
      description: '',
      proposalType: 0,
      useQuadraticVoting: false,
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Create Proposal</h2>
            <p className="text-sm text-gray-500 mt-1">
              Step {step} of 3: {step === 1 ? 'Choose Type' : step === 2 ? 'Proposal Details' : 'Actions'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!hasEnoughPower && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                You need at least {proposalThreshold} tokens to create a proposal. 
                You currently have {userVotingPower}.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              {/* Template Option */}
              {templates.length > 0 && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={useTemplate}
                      onChange={(e) => setUseTemplate(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Use a template</span>
                  </label>

                  {useTemplate && (
                    <div className="grid grid-cols-1 gap-2">
                      {templates.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => handleSelectTemplate(template.id)}
                          className={`p-4 text-left border rounded-lg transition-all ${
                            selectedTemplate === template.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="font-medium text-gray-900">{template.name}</div>
                          <div className="text-sm text-gray-500 mt-1">{template.description}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Proposal Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Proposal Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {proposalTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setFormData(prev => ({ ...prev, proposalType: type.value }))}
                      className={`p-4 border rounded-lg text-left transition-all ${
                        formData.proposalType === type.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-gray-900">
                        {type.icon}
                        <span className="font-medium">{type.label}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{type.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quadratic Voting Option */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Calculator className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Quadratic Voting</div>
                    <div className="text-sm text-gray-500">Apply square root to vote weights</div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.useQuadraticVoting}
                    onChange={(e) => setFormData(prev => ({ ...prev, useQuadraticVoting: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proposal Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter a clear, descriptive title"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe your proposal in detail..."
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supports Markdown formatting. Be clear and concise.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Proposal Actions
                </label>
                <button
                  onClick={handleAddAction}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Action
                </button>
              </div>

              <div className="space-y-3">
                {formData.targets.map((target, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Action {index + 1}</span>
                      {formData.targets.length > 1 && (
                        <button
                          onClick={() => handleRemoveAction(index)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Target Address</label>
                      <input
                        type="text"
                        value={target}
                        onChange={(e) => handleActionChange(index, 'targets', e.target.value)}
                        placeholder="0x..."
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Value (ETH)</label>
                        <input
                          type="text"
                          value={formData.values[index]}
                          onChange={(e) => handleActionChange(index, 'values', e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Calldata</label>
                        <input
                          type="text"
                          value={formData.calldatas[index]}
                          onChange={(e) => handleActionChange(index, 'calldatas', e.target.value)}
                          placeholder="0x"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>

          <div className="flex gap-3">
            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !hasEnoughPower || !formData.title || !formData.description}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create Proposal'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}