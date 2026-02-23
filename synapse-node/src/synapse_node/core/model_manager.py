"""Model management - downloading, caching, loading, and auto-detection."""

import asyncio
import hashlib
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass, field

from huggingface_hub import (
    hf_hub_download,
    scan_cache_dir,
    snapshot_download,
)
from huggingface_hub.utils import RepositoryNotFoundError

from synapse_node.core.config import get_config

logger = logging.getLogger(__name__)


@dataclass
class ModelSpecs:
    """Hardware specifications for a model."""
    min_vram_gb: float
    recommended_vram_gb: float
    context_length: int
    quantization: str = "fp16"
    tensor_parallel: int = 1


@dataclass
class ModelFeatures:
    """Feature flags for a model."""
    vision: bool = False
    tools: bool = False
    json_mode: bool = False
    streaming: bool = True
    system_prompt: bool = True


@dataclass
class ModelMetadata:
    """Complete metadata for a supported model."""
    model_id: str
    name: str
    description: str
    price_per_token: float  # In HSK tokens
    specs: ModelSpecs
    features: ModelFeatures
    tags: List[str] = field(default_factory=list)
    vllm_compatible: bool = True
    gguf_available: bool = False


# Model Registry with all supported models
SUPPORTED_MODELS: Dict[str, ModelMetadata] = {
    # DeepSeek Models
    "deepseek-ai/DeepSeek-V3": ModelMetadata(
        model_id="deepseek-ai/DeepSeek-V3",
        name="DeepSeek V3",
        description="DeepSeek-V3 is a powerful MoE language model with 671B total parameters",
        price_per_token=0.00005,  # HSK per token
        specs=ModelSpecs(
            min_vram_gb=80.0,
            recommended_vram_gb=160.0,
            context_length=64000,
            quantization="fp8",
            tensor_parallel=8
        ),
        features=ModelFeatures(
            vision=False,
            tools=True,
            json_mode=True,
            streaming=True,
            system_prompt=True
        ),
        tags=["deepseek", "moe", "large", "code", "multilingual"],
        vllm_compatible=True,
        gguf_available=False
    ),
    
    "deepseek-ai/DeepSeek-R1": ModelMetadata(
        model_id="deepseek-ai/DeepSeek-R1",
        name="DeepSeek R1",
        description="DeepSeek-R1 is a reasoning model trained with RL for complex tasks",
        price_per_token=0.00006,
        specs=ModelSpecs(
            min_vram_gb=80.0,
            recommended_vram_gb=160.0,
            context_length=64000,
            quantization="fp8",
            tensor_parallel=8
        ),
        features=ModelFeatures(
            vision=False,
            tools=True,
            json_mode=True,
            streaming=True,
            system_prompt=True
        ),
        tags=["deepseek", "reasoning", "rl", "large"],
        vllm_compatible=True,
        gguf_available=False
    ),
    
    # Llama 3.1 Models
    "meta-llama/Meta-Llama-3.1-8B": ModelMetadata(
        model_id="meta-llama/Meta-Llama-3.1-8B",
        name="Llama 3.1 8B",
        description="Meta's efficient 8B parameter multilingual model",
        price_per_token=0.000008,  # Cheaper, smaller model
        specs=ModelSpecs(
            min_vram_gb=8.0,
            recommended_vram_gb=16.0,
            context_length=128000,
            quantization="fp16",
            tensor_parallel=1
        ),
        features=ModelFeatures(
            vision=False,
            tools=True,
            json_mode=True,
            streaming=True,
            system_prompt=True
        ),
        tags=["meta", "llama", "8b", "multilingual", "efficient"],
        vllm_compatible=True,
        gguf_available=True
    ),
    
    "meta-llama/Meta-Llama-3.1-70B": ModelMetadata(
        model_id="meta-llama/Meta-Llama-3.1-70B",
        name="Llama 3.1 70B",
        description="Meta's powerful 70B parameter multilingual model",
        price_per_token=0.00003,
        specs=ModelSpecs(
            min_vram_gb=40.0,
            recommended_vram_gb=80.0,
            context_length=128000,
            quantization="fp16",
            tensor_parallel=2
        ),
        features=ModelFeatures(
            vision=False,
            tools=True,
            json_mode=True,
            streaming=True,
            system_prompt=True
        ),
        tags=["meta", "llama", "70b", "multilingual", "large"],
        vllm_compatible=True,
        gguf_available=True
    ),
    
    # Llama 3.2 Models
    "meta-llama/Llama-3.2-3B-Instruct": ModelMetadata(
        model_id="meta-llama/Llama-3.2-3B-Instruct",
        name="Llama 3.2 3B",
        description="Lightweight edge-optimized 3B model for mobile/edge devices",
        price_per_token=0.000005,  # Very cheap, smallest model
        specs=ModelSpecs(
            min_vram_gb=4.0,
            recommended_vram_gb=8.0,
            context_length=128000,
            quantization="fp16",
            tensor_parallel=1
        ),
        features=ModelFeatures(
            vision=False,
            tools=True,
            json_mode=True,
            streaming=True,
            system_prompt=True
        ),
        tags=["meta", "llama", "3b", "edge", "mobile", "efficient"],
        vllm_compatible=True,
        gguf_available=True
    ),
    
    "meta-llama/Llama-3.2-90B-Vision-Instruct": ModelMetadata(
        model_id="meta-llama/Llama-3.2-90B-Vision-Instruct",
        name="Llama 3.2 90B Vision",
        description="Multimodal vision model with 90B parameters",
        price_per_token=0.00005,
        specs=ModelSpecs(
            min_vram_gb=80.0,
            recommended_vram_gb=160.0,
            context_length=128000,
            quantization="fp16",
            tensor_parallel=4
        ),
        features=ModelFeatures(
            vision=True,
            tools=True,
            json_mode=True,
            streaming=True,
            system_prompt=True
        ),
        tags=["meta", "llama", "90b", "vision", "multimodal", "large"],
        vllm_compatible=True,
        gguf_available=False
    ),
    
    # Mistral Models
    "mistralai/Mistral-Large-Instruct-2407": ModelMetadata(
        model_id="mistralai/Mistral-Large-Instruct-2407",
        name="Mistral Large 2",
        description="Mistral's flagship model with advanced reasoning and multilingual support",
        price_per_token=0.00004,
        specs=ModelSpecs(
            min_vram_gb=64.0,
            recommended_vram_gb=128.0,
            context_length=128000,
            quantization="fp16",
            tensor_parallel=2
        ),
        features=ModelFeatures(
            vision=False,
            tools=True,
            json_mode=True,
            streaming=True,
            system_prompt=True
        ),
        tags=["mistral", "large", "multilingual", "reasoning"],
        vllm_compatible=True,
        gguf_available=False
    ),
    
    "mistralai/Mixtral-8x22B-Instruct-v0.1": ModelMetadata(
        model_id="mistralai/Mixtral-8x22B-Instruct-v0.1",
        name="Mixtral 8x22B",
        description="Sparse MoE model with 8 experts, 141B total parameters",
        price_per_token=0.000035,
        specs=ModelSpecs(
            min_vram_gb=48.0,
            recommended_vram_gb=96.0,
            context_length=64000,
            quantization="fp16",
            tensor_parallel=2
        ),
        features=ModelFeatures(
            vision=False,
            tools=True,
            json_mode=True,
            streaming=True,
            system_prompt=True
        ),
        tags=["mistral", "mixtral", "moe", "141b"],
        vllm_compatible=True,
        gguf_available=False
    ),
    
    # Qwen Models
    "Qwen/Qwen2.5-72B-Instruct": ModelMetadata(
        model_id="Qwen/Qwen2.5-72B-Instruct",
        name="Qwen 2.5 72B",
        description="Alibaba's powerful multilingual model with 72B parameters",
        price_per_token=0.000028,
        specs=ModelSpecs(
            min_vram_gb=40.0,
            recommended_vram_gb=80.0,
            context_length=128000,
            quantization="fp16",
            tensor_parallel=2
        ),
        features=ModelFeatures(
            vision=False,
            tools=True,
            json_mode=True,
            streaming=True,
            system_prompt=True
        ),
        tags=["qwen", "alibaba", "72b", "multilingual", "asian-languages"],
        vllm_compatible=True,
        gguf_available=True
    ),
    
    # Google Gemma Models
    "google/gemma-2-27b-it": ModelMetadata(
        model_id="google/gemma-2-27b-it",
        name="Gemma 2 27B",
        description="Google's efficient open model with advanced reasoning",
        price_per_token=0.000018,
        specs=ModelSpecs(
            min_vram_gb=20.0,
            recommended_vram_gb=40.0,
            context_length=8192,
            quantization="fp16",
            tensor_parallel=1
        ),
        features=ModelFeatures(
            vision=False,
            tools=True,
            json_mode=True,
            streaming=True,
            system_prompt=True
        ),
        tags=["google", "gemma", "27b", "efficient"],
        vllm_compatible=True,
        gguf_available=True
    ),
}


class ModelInfo:
    """Information about a cached model."""
    
    def __init__(self, model_id: str, local_path: Optional[Path] = None):
        self.model_id = model_id
        self.local_path = local_path
        self.is_downloaded = local_path is not None
        self.size_bytes: int = 0
        self.files: List[str] = []
        self.metadata: Optional[ModelMetadata] = SUPPORTED_MODELS.get(model_id)
        
    def __repr__(self):
        status = "downloaded" if self.is_downloaded else "not downloaded"
        return f"ModelInfo({self.model_id}, {status})"


class ModelManager:
    """Manages model downloading, caching, and auto-detection based on GPU VRAM."""
    
    def __init__(self, cache_dir: Optional[Path] = None):
        self.config = get_config()
        self.cache_dir = cache_dir or self.config.model_cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        self._models: Dict[str, ModelInfo] = {}
        self._download_locks: Dict[str, asyncio.Lock] = {}
        self._loading_models: Set[str] = set()
        self._available_vram_gb: Optional[float] = None
        
        logger.info(f"ModelManager initialized with cache dir: {self.cache_dir}")
    
    async def initialize(self):
        """Initialize model manager and scan existing cache."""
        await self._scan_cache()
        
        # Detect available GPU VRAM
        self._available_vram_gb = await self._detect_available_vram()
        logger.info(f"Detected available VRAM: {self._available_vram_gb:.1f} GB")
        
        # Get models that can run on this hardware
        compatible_models = self.get_compatible_models()
        logger.info(f"Hardware-compatible models: {len(compatible_models)}")
        
        # Pre-download default models if configured
        if self.config.default_models:
            logger.info(f"Preloading {len(self.config.default_models)} default models...")
            tasks = [
                self.download_model(model_id)
                for model_id in self.config.default_models
                if self.can_run_model(model_id)
            ]
            if tasks:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                for model_id, result in zip(self.config.default_models, results):
                    if isinstance(result, Exception):
                        logger.error(f"Failed to download {model_id}: {result}")
                    else:
                        logger.info(f"Model {model_id} ready")
    
    async def _detect_available_vram(self) -> float:
        """Detect total available GPU VRAM in GB."""
        try:
            import torch
            if torch.cuda.is_available():
                total_vram = 0
                for i in range(torch.cuda.device_count()):
                    props = torch.cuda.get_device_properties(i)
                    total_vram += props.total_memory / (1024**3)  # Convert to GB
                return total_vram
        except ImportError:
            logger.warning("PyTorch not available for VRAM detection")
        
        # Fallback: check nvidia-smi
        try:
            import subprocess
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=memory.total", "--format=csv,noheader,nounits"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                total_mb = sum(int(x.strip()) for x in result.stdout.strip().split('\n'))
                return total_mb / 1024  # Convert MB to GB
        except Exception as e:
            logger.warning(f"nvidia-smi failed: {e}")
        
        # Default fallback
        return 0.0
    
    def can_run_model(self, model_id: str) -> bool:
        """Check if this node can run the given model based on VRAM."""
        metadata = SUPPORTED_MODELS.get(model_id)
        if not metadata:
            # Legacy fallback for unregistered models
            return self.estimate_model_memory(model_id) <= (self._available_vram_gb or 0)
        
        if self._available_vram_gb is None:
            return False
        
        return self._available_vram_gb >= metadata.specs.min_vram_gb
    
    def get_compatible_models(self) -> List[str]:
        """Get list of models that can run on this node's hardware."""
        if self._available_vram_gb is None:
            return []
        
        return [
            model_id for model_id, metadata in SUPPORTED_MODELS.items()
            if metadata.specs.min_vram_gb <= self._available_vram_gb
        ]
    
    def get_recommended_models(self) -> List[Tuple[str, ModelMetadata]]:
        """Get models that run optimally on this hardware (recommended VRAM)."""
        if self._available_vram_gb is None:
            return []
        
        return [
            (model_id, metadata) for model_id, metadata in SUPPORTED_MODELS.items()
            if metadata.specs.recommended_vram_gb <= self._available_vram_gb
        ]
    
    def get_model_price(self, model_id: str) -> Optional[float]:
        """Get the price per token for a model."""
        metadata = SUPPORTED_MODELS.get(model_id)
        return metadata.price_per_token if metadata else None
    
    def get_model_features(self, model_id: str) -> Optional[ModelFeatures]:
        """Get feature flags for a model."""
        metadata = SUPPORTED_MODELS.get(model_id)
        return metadata.features if metadata else None
    
    def check_vllm_compatibility(self, model_id: str) -> Tuple[bool, str]:
        """Check if model is compatible with vLLM."""
        metadata = SUPPORTED_MODELS.get(model_id)
        if not metadata:
            return False, "Model not in registry"
        
        if not metadata.vllm_compatible:
            return False, "Model not vLLM compatible"
        
        # Check architecture support
        try:
            from vllm import LLM
            # Additional checks could go here
            return True, "Compatible"
        except ImportError:
            return False, "vLLM not installed"
    
    async def _scan_cache(self):
        """Scan the HuggingFace cache directory."""
        try:
            cache_info = scan_cache_dir()
            for repo in cache_info.repos:
                model_id = repo.repo_id
                # Find the snapshot path
                for revision in repo.revisions:
                    if revision.snapshot_path.exists():
                        info = ModelInfo(model_id, revision.snapshot_path)
                        info.size_bytes = revision.size_on_disk
                        self._models[model_id] = info
                        logger.debug(f"Found cached model: {model_id}")
                        break
        except Exception as e:
            logger.warning(f"Could not scan cache: {e}")
    
    def get_model_info(self, model_id: str) -> Optional[ModelInfo]:
        """Get information about a model."""
        return self._models.get(model_id)
    
    def is_model_available(self, model_id: str) -> bool:
        """Check if a model is downloaded and available."""
        info = self._models.get(model_id)
        return info is not None and info.is_downloaded
    
    def is_model_supported(self, model_id: str) -> bool:
        """Check if a model is in the supported registry."""
        return model_id in SUPPORTED_MODELS
    
    async def download_model(
        self, 
        model_id: str,
        force_redownload: bool = False,
        progress_callback: Optional[callable] = None
    ) -> ModelInfo:
        """Download a model from HuggingFace Hub."""
        
        # Validate model is supported
        if not self.is_model_supported(model_id):
            logger.warning(f"Model {model_id} not in supported registry, attempting download anyway")
        
        # Check if already downloaded
        if not force_redownload and self.is_model_available(model_id):
            logger.info(f"Model {model_id} already cached")
            return self._models[model_id]
        
        # Get or create download lock for this model
        if model_id not in self._download_locks:
            self._download_locks[model_id] = asyncio.Lock()
        
        async with self._download_locks[model_id]:
            # Double-check after acquiring lock
            if not force_redownload and self.is_model_available(model_id):
                return self._models[model_id]
            
            logger.info(f"Downloading model: {model_id}")
            
            try:
                # Run snapshot download in thread pool
                loop = asyncio.get_event_loop()
                local_path = await loop.run_in_executor(
                    None,
                    lambda: snapshot_download(
                        repo_id=model_id,
                        cache_dir=self.cache_dir,
                        resume_download=True,
                        local_files_only=False,
                    )
                )
                
                path = Path(local_path)
                info = ModelInfo(model_id, path)
                info.is_downloaded = True
                
                # Calculate size
                if path.exists():
                    info.size_bytes = sum(
                        f.stat().st_size for f in path.rglob("*") if f.is_file()
                    )
                
                self._models[model_id] = info
                
                logger.info(f"Model {model_id} downloaded successfully ({info.size_bytes / 1e9:.2f} GB)")
                
                if progress_callback:
                    progress_callback(model_id, 100.0)
                
                return info
                
            except RepositoryNotFoundError:
                logger.error(f"Model {model_id} not found on HuggingFace Hub")
                raise
            except Exception as e:
                logger.error(f"Failed to download {model_id}: {e}")
                raise
    
    async def get_model_path(self, model_id: str, auto_download: bool = True) -> Optional[Path]:
        """Get local path for a model, downloading if necessary."""
        info = self._models.get(model_id)
        
        if info and info.is_downloaded:
            return info.local_path
        
        if auto_download:
            info = await self.download_model(model_id)
            return info.local_path
        
        return None
    
    def list_cached_models(self) -> List[ModelInfo]:
        """List all cached models."""
        return [info for info in self._models.values() if info.is_downloaded]
    
    def list_supported_models(self) -> List[Tuple[str, ModelMetadata]]:
        """List all supported models from registry."""
        return list(SUPPORTED_MODELS.items())
    
    async def delete_model(self, model_id: str) -> bool:
        """Delete a cached model."""
        info = self._models.get(model_id)
        if not info or not info.local_path:
            return False
        
        try:
            # Use huggingface_hub to delete from cache
            from huggingface_hub import delete_cache
            
            if info.local_path.exists():
                import shutil
                shutil.rmtree(info.local_path, ignore_errors=True)
            
            del self._models[model_id]
            logger.info(f"Deleted model: {model_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete {model_id}: {e}")
            return False
    
    def get_cache_size_bytes(self) -> int:
        """Get total size of model cache in bytes."""
        return sum(info.size_bytes for info in self._models.values())
    
    def estimate_model_memory(self, model_id: str) -> float:
        """Estimate GPU memory needed for a model in GB."""
        # Check registry first
        metadata = SUPPORTED_MODELS.get(model_id)
        if metadata:
            return metadata.specs.min_vram_gb
        
        # Legacy fallback based on model name parsing
        model_id_lower = model_id.lower()
        
        if "90b" in model_id_lower or "671b" in model_id_lower:
            return 80.0
        elif "72b" in model_id_lower:
            return 40.0
        elif "70b" in model_id_lower:
            return 40.0
        elif "27b" in model_id_lower:
            return 20.0
        elif "141b" in model_id_lower or "8x22b" in model_id_lower:
            return 48.0
        elif "34b" in model_id_lower or "35b" in model_id_lower:
            return 20.0
        elif "13b" in model_id_lower:
            return 10.0
        elif "8b" in model_id_lower or "7b" in model_id_lower:
            return 8.0
        elif "6.7b" in model_id_lower:
            return 5.0
        elif "3b" in model_id_lower:
            return 4.0
        elif "1b" in model_id_lower:
            return 2.0
        else:
            # Default estimate
            return 8.0
    
    def get_hardware_requirements(self, model_id: str) -> Optional[Dict]:
        """Get detailed hardware requirements for a model."""
        metadata = SUPPORTED_MODELS.get(model_id)
        if not metadata:
            return None
        
        return {
            "model_id": model_id,
            "name": metadata.name,
            "min_vram_gb": metadata.specs.min_vram_gb,
            "recommended_vram_gb": metadata.specs.recommended_vram_gb,
            "context_length": metadata.specs.context_length,
            "tensor_parallel": metadata.specs.tensor_parallel,
            "quantization": metadata.specs.quantization,
            "can_run": self.can_run_model(model_id),
        }
    
    def get_all_models_status(self) -> List[Dict]:
        """Get status of all supported models."""
        return [
            {
                "model_id": model_id,
                "name": metadata.name,
                "downloaded": self.is_model_available(model_id),
                "can_run": self.can_run_model(model_id),
                "price_per_token": metadata.price_per_token,
                "min_vram_gb": metadata.specs.min_vram_gb,
                "features": {
                    "vision": metadata.features.vision,
                    "tools": metadata.features.tools,
                    "json_mode": metadata.features.json_mode,
                }
            }
            for model_id, metadata in SUPPORTED_MODELS.items()
        ]


# Global model manager instance
_model_manager: Optional[ModelManager] = None


def get_model_manager() -> ModelManager:
    """Get or create global model manager instance."""
    global _model_manager
    if _model_manager is None:
        _model_manager = ModelManager()
    return _model_manager


def get_supported_model_ids() -> List[str]:
    """Get list of all supported model IDs."""
    return list(SUPPORTED_MODELS.keys())


def get_model_metadata(model_id: str) -> Optional[ModelMetadata]:
    """Get metadata for a specific model."""
    return SUPPORTED_MODELS.get(model_id)
