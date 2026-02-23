/**
 * Model Selector Component
 * 
 * Dropdown for selecting AI models with pricing and hardware requirements display.
 * Supports all latest open-source models in the Synapse network.
 */

import React, { useState, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  Chip,
  Tooltip,
  Alert,
  SelectChangeEvent,
  ListItemText,
  ListItemIcon,
  useTheme
} from '@mui/material';
import {
  SmartToy as ModelIcon,
  Memory as VramIcon,
  Visibility as VisionIcon,
  Build as ToolsIcon,
  Code as JsonIcon,
  Speed as SpeedIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

// Model configuration matching the registry
export interface ModelConfig {
  modelId: string;
  name: string;
  description: string;
  pricePerToken: string;
  minVramGB: number;
  maxVramGB: number;
  contextLength: number;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsJson: boolean;
  status: 'active' | 'deprecated' | 'pending';
  tags?: string[];
}

// Model registry - matches backend/contract
export const SUPPORTED_MODELS: ModelConfig[] = [
  {
    modelId: 'deepseek-ai/DeepSeek-V3',
    name: 'DeepSeek V3',
    description: 'DeepSeek-V3 is a powerful MoE language model with 671B total parameters',
    pricePerToken: '50000000000000',
    minVramGB: 80,
    maxVramGB: 160,
    contextLength: 64000,
    supportsVision: false,
    supportsTools: true,
    supportsJson: true,
    status: 'active',
    tags: ['MoE', 'Large', 'Code', 'Multilingual'],
  },
  {
    modelId: 'deepseek-ai/DeepSeek-R1',
    name: 'DeepSeek R1',
    description: 'DeepSeek-R1 is a reasoning model trained with RL for complex tasks',
    pricePerToken: '60000000000000',
    minVramGB: 80,
    maxVramGB: 160,
    contextLength: 64000,
    supportsVision: false,
    supportsTools: true,
    supportsJson: true,
    status: 'active',
    tags: ['Reasoning', 'RL', 'Advanced'],
  },
  {
    modelId: 'meta-llama/Meta-Llama-3.1-8B',
    name: 'Llama 3.1 8B',
    description: "Meta's efficient 8B parameter multilingual model",
    pricePerToken: '8000000000000',
    minVramGB: 8,
    maxVramGB: 16,
    contextLength: 128000,
    supportsVision: false,
    supportsTools: true,
    supportsJson: true,
    status: 'active',
    tags: ['Efficient', 'Fast', 'Multilingual'],
  },
  {
    modelId: 'meta-llama/Meta-Llama-3.1-70B',
    name: 'Llama 3.1 70B',
    description: "Meta's powerful 70B parameter multilingual model",
    pricePerToken: '30000000000000',
    minVramGB: 40,
    maxVramGB: 80,
    contextLength: 128000,
    supportsVision: false,
    supportsTools: true,
    supportsJson: true,
    status: 'active',
    tags: ['Large', 'Multilingual', 'Powerful'],
  },
  {
    modelId: 'meta-llama/Llama-3.2-3B-Instruct',
    name: 'Llama 3.2 3B',
    description: 'Lightweight edge-optimized 3B model for mobile/edge devices',
    pricePerToken: '5000000000000',
    minVramGB: 4,
    maxVramGB: 8,
    contextLength: 128000,
    supportsVision: false,
    supportsTools: true,
    supportsJson: true,
    status: 'active',
    tags: ['Ultra-fast', 'Edge', 'Mobile'],
  },
  {
    modelId: 'meta-llama/Llama-3.2-90B-Vision-Instruct',
    name: 'Llama 3.2 90B Vision',
    description: 'Multimodal vision model with 90B parameters',
    pricePerToken: '50000000000000',
    minVramGB: 80,
    maxVramGB: 160,
    contextLength: 128000,
    supportsVision: true,
    supportsTools: true,
    supportsJson: true,
    status: 'active',
    tags: ['Vision', 'Multimodal', 'Large'],
  },
  {
    modelId: 'mistralai/Mistral-Large-Instruct-2407',
    name: 'Mistral Large 2',
    description: "Mistral's flagship model with advanced reasoning and multilingual support",
    pricePerToken: '40000000000000',
    minVramGB: 64,
    maxVramGB: 128,
    contextLength: 128000,
    supportsVision: false,
    supportsTools: true,
    supportsJson: true,
    status: 'active',
    tags: ['Flagship', 'Reasoning', 'Multilingual'],
  },
  {
    modelId: 'mistralai/Mixtral-8x22B-Instruct-v0.1',
    name: 'Mixtral 8x22B',
    description: 'Sparse MoE model with 8 experts, 141B total parameters',
    pricePerToken: '35000000000000',
    minVramGB: 48,
    maxVramGB: 96,
    contextLength: 64000,
    supportsVision: false,
    supportsTools: true,
    supportsJson: true,
    status: 'active',
    tags: ['MoE', '141B', 'Efficient'],
  },
  {
    modelId: 'Qwen/Qwen2.5-72B-Instruct',
    name: 'Qwen 2.5 72B',
    description: "Alibaba's powerful multilingual model with 72B parameters",
    pricePerToken: '28000000000000',
    minVramGB: 40,
    maxVramGB: 80,
    contextLength: 128000,
    supportsVision: false,
    supportsTools: true,
    supportsJson: true,
    status: 'active',
    tags: ['Asian Languages', '72B', 'Multilingual'],
  },
  {
    modelId: 'google/gemma-2-27b-it',
    name: 'Gemma 2 27B',
    description: "Google's efficient open model with advanced reasoning",
    pricePerToken: '18000000000000',
    minVramGB: 20,
    maxVramGB: 40,
    contextLength: 8192,
    supportsVision: false,
    supportsTools: true,
    supportsJson: true,
    status: 'active',
    tags: ['Google', 'Efficient', 'Reliable'],
  },
];

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  nodeVramGB?: number;
  showPrice?: boolean;
  showHardware?: boolean;
  filterByFeatures?: {
    vision?: boolean;
    tools?: boolean;
    json?: boolean;
  };
  disabled?: boolean;
  error?: string;
}

// Helper to format price from wei to HSK
const formatPrice = (weiAmount: string): string => {
  const eth = parseInt(weiAmount) / 1e18;
  if (eth < 0.00001) return `${(eth * 1e6).toFixed(1)} µHSK`;
  if (eth < 0.01) return `${(eth * 1e3).toFixed(1)} mHSK`;
  return `${eth.toFixed(6)} HSK`;
};

// Calculate estimated cost for 1K tokens
const getEstimatedCost = (pricePerToken: string): string => {
  const cost = (parseInt(pricePerToken) * 1000) / 1e18;
  if (cost < 0.0001) return '< 0.0001 HSK';
  return `~${cost.toFixed(4)} HSK`;
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onModelChange,
  nodeVramGB,
  showPrice = true,
  showHardware = true,
  filterByFeatures,
  disabled = false,
  error,
}) => {
  const theme = useTheme();

  // Filter models based on requirements
  const filteredModels = useMemo(() => {
    return SUPPORTED_MODELS.filter((model) => {
      if (model.status !== 'active') return false;
      if (filterByFeatures?.vision && !model.supportsVision) return false;
      if (filterByFeatures?.tools && !model.supportsTools) return false;
      if (filterByFeatures?.json && !model.supportsJson) return false;
      return true;
    });
  }, [filterByFeatures]);

  const selectedModelData = SUPPORTED_MODELS.find((m) => m.modelId === selectedModel);

  // Check if node can run selected model
  const canRunSelected = useMemo(() => {
    if (!nodeVramGB || !selectedModelData) return true;
    return nodeVramGB >= selectedModelData.minVramGB;
  }, [nodeVramGB, selectedModelData]);

  const handleChange = (event: SelectChangeEvent<string>) => {
    onModelChange(event.target.value);
  };

  // Group models by category
  const groupedModels = useMemo(() => {
    const groups: Record<string, ModelConfig[]> = {
      'Fast & Efficient': [],
      'Balanced': [],
      'Large & Powerful': [],
      'Vision': [],
    };

    filteredModels.forEach((model) => {
      if (model.supportsVision) {
        groups['Vision'].push(model);
      } else if (model.minVramGB <= 8) {
        groups['Fast & Efficient'].push(model);
      } else if (model.minVramGB >= 64) {
        groups['Large & Powerful'].push(model);
      } else {
        groups['Balanced'].push(model);
      }
    });

    return groups;
  }, [filteredModels]);

  return (
    <Box sx={{ width: '100%' }}>
      <FormControl fullWidth error={!!error} disabled={disabled}>
        <InputLabel id="model-selector-label">AI Model</InputLabel>
        <Select
          labelId="model-selector-label"
          id="model-selector"
          value={selectedModel}
          label="AI Model"
          onChange={handleChange}
          renderValue={(value) => {
            const model = SUPPORTED_MODELS.find((m) => m.modelId === value);
            if (!model) return value;
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ModelIcon fontSize="small" />
                <Typography variant="body2">{model.name}</Typography>
                {showPrice && (
                  <Chip
                    size="small"
                    label={getEstimatedCost(model.pricePerToken)}
                    variant="outlined"
                    sx={{ ml: 1 }}
                  />
                )}
              </Box>
            );
          }}
        >
          {Object.entries(groupedModels).map(([category, models]) =>
            models.length > 0 ? (
              <React.Fragment key={category}>
                <Typography
                  variant="caption"
                  sx={{
                    px: 2,
                    py: 0.5,
                    display: 'block',
                    color: 'text.secondary',
                    fontWeight: 'bold',
                    bgcolor: 'action.hover',
                  }}
                >
                  {category}
                </Typography>
                {models.map((model) => {
                  const canRun = !nodeVramGB || nodeVramGB >= model.minVramGB;
                  return (
                    <MenuItem
                      key={model.modelId}
                      value={model.modelId}
                      disabled={!canRun}
                      sx={{ py: 1.5, opacity: canRun ? 1 : 0.5 }}
                    >
                      <Box sx={{ width: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            {model.supportsVision ? <VisionIcon color="primary" /> : <ModelIcon />}
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="subtitle2">{model.name}</Typography>
                                {showPrice && (
                                  <Chip
                                    size="small"
                                    label={formatPrice(model.pricePerToken) + '/token'}
                                    color="primary"
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                  />
                                )}
                                {!canRun && (
                                  <Tooltip title={`Requires ${model.minVramGB}GB VRAM`}>
                                    <WarningIcon color="warning" fontSize="small" />
                                  </Tooltip>
                                )}
                              </Box>
                            }
                            secondary={
                              <Box sx={{ mt: 0.5 }}>
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {model.description}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                                  {showHardware && (
                                    <Chip
                                      size="small"
                                      icon={<VramIcon />}
                                      label={`${model.minVramGB}GB VRAM`}
                                      variant="outlined"
                                      sx={{ height: 20, fontSize: '0.65rem' }}
                                    />
                                  )}
                                  {model.supportsTools && (
                                    <Tooltip title="Supports function calling">
                                      <Chip
                                        size="small"
                                        icon={<ToolsIcon />}
                                        label="Tools"
                                        variant="outlined"
                                        sx={{ height: 20, fontSize: '0.65rem' }}
                                      />
                                    </Tooltip>
                                  )}
                                  {model.supportsJson && (
                                    <Tooltip title="Supports JSON mode">
                                      <Chip
                                        size="small"
                                        icon={<JsonIcon />}
                                        label="JSON"
                                        variant="outlined"
                                        sx={{ height: 20, fontSize: '0.65rem' }}
                                      />
                                    </Tooltip>
                                  )}
                                  <Chip
                                    size="small"
                                    icon={<SpeedIcon />}
                                    label={`${model.contextLength.toLocaleString()} ctx`}
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.65rem' }}
                                  />
                                </Box>
                              </Box>
                            }
                          />
                        </Box>
                      </Box>
                    </MenuItem>
                  );
                })}
              </React.Fragment>
            ) : null
          )}
        </Select>
      </FormControl>

      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}

      {selectedModelData && !canRunSelected && nodeVramGB && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          This model requires {selectedModelData.minVramGB}GB VRAM but your node only has {nodeVramGB}GB.
          The model will not be available for inference.
        </Alert>
      )}

      {selectedModelData && canRunSelected && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Hardware Requirements for Node Operators
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Minimum VRAM</Typography>
              <Typography variant="body2">{selectedModelData.minVramGB} GB</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Recommended VRAM</Typography>
              <Typography variant="body2">{selectedModelData.maxVramGB} GB</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Context Length</Typography>
              <Typography variant="body2">{selectedModelData.contextLength.toLocaleString()} tokens</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Price per Token</Typography>
              <Typography variant="body2">{formatPrice(selectedModelData.pricePerToken)}</Typography>
            </Box>
          </Box>
          <Box sx={{ mt: 1, display: 'flex', gap: 0.5 }}>
            {selectedModelData.supportsVision && (
              <Chip size="small" icon={<VisionIcon />} label="Vision" color="primary" />
            )}
            {selectedModelData.supportsTools && (
              <Chip size="small" icon={<ToolsIcon />} label="Tools" color="primary" />
            )}
            {selectedModelData.supportsJson && (
              <Chip size="small" icon={<JsonIcon />} label="JSON Mode" color="primary" />
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ModelSelector;
