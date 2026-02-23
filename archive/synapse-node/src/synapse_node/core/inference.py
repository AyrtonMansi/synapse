"""vLLM inference engine for model serving."""

import asyncio
import logging
from typing import AsyncGenerator, Dict, List, Optional, Any
from dataclasses import dataclass

from synapse_node.core.config import get_config
from synapse_node.core.gpu import get_gpu_detector

logger = logging.getLogger(__name__)

# Import vLLM (may not be available in all environments)
try:
    from vllm import LLM, SamplingParams
    from vllm.engine.arg_utils import AsyncEngineArgs
    from vllm.engine.async_llm_engine import AsyncLLMEngine
    HAS_VLLM = True
except ImportError:
    HAS_VLLM = False
    logger.warning("vLLM not installed - inference will not be available")


@dataclass
class GenerationRequest:
    """Request for text generation."""
    prompt: str
    model: str
    max_tokens: int = 512
    temperature: float = 0.7
    top_p: float = 0.9
    top_k: int = 40
    repetition_penalty: float = 1.0
    stop_sequences: Optional[List[str]] = None
    stream: bool = False


@dataclass
class GenerationResult:
    """Result from text generation."""
    text: str
    tokens_generated: int
    finish_reason: str
    model: str
    generation_time_ms: float


class InferenceEngine:
    """vLLM-based inference engine."""
    
    def __init__(self):
        self.config = get_config()
        self.gpu_detector = get_gpu_detector()
        
        self._engines: Dict[str, AsyncLLMEngine] = {}
        self._model_load_locks: Dict[str, asyncio.Lock] = {}
        self._loaded_models: Dict[str, Any] = {}
        
        if not HAS_VLLM:
            logger.error("vLLM is required for inference")
    
    async def initialize(self):
        """Initialize the inference engine."""
        if not HAS_VLLM:
            raise RuntimeError("vLLM not available")
        
        # Initialize GPU detection
        self.gpu_detector.initialize()
        
        # Preload default models
        for model_id in self.config.default_models[:1]:  # Load first model
            try:
                await self.load_model(model_id)
            except Exception as e:
                logger.error(f"Failed to preload model {model_id}: {e}")
        
        logger.info("Inference engine initialized")
    
    async def load_model(self, model_id: str, device: Optional[int] = None) -> bool:
        """Load a model into the inference engine."""
        if not HAS_VLLM:
            raise RuntimeError("vLLM not available")
        
        if model_id in self._engines:
            logger.info(f"Model {model_id} already loaded")
            return True
        
        # Create lock for this model
        if model_id not in self._model_load_locks:
            self._model_load_locks[model_id] = asyncio.Lock()
        
        async with self._model_load_locks[model_id]:
            # Double-check after acquiring lock
            if model_id in self._engines:
                return True
            
            logger.info(f"Loading model: {model_id}")
            
            # Determine GPU to use
            if device is None:
                # Estimate model size (rough)
                model_size_gb = self._estimate_model_size(model_id)
                device = self.gpu_detector.get_device_for_model(model_size_gb)
            
            gpu_devices = [device] if device is not None else None
            
            try:
                # Build engine args
                engine_args = AsyncEngineArgs(
                    model=model_id,
                    download_dir=str(self.config.model_cache_dir),
                    dtype="auto",
                    tensor_parallel_size=1,
                    gpu_memory_utilization=self.config.gpu_memory_fraction,
                    device="cuda" if gpu_devices else "cpu",
                )
                
                # Create engine
                engine = AsyncLLMEngine.from_engine_args(engine_args)
                
                # Wait for engine to be ready
                await engine.engine.start()
                
                self._engines[model_id] = engine
                self._loaded_models[model_id] = {
                    "device": device,
                    "loaded_at": asyncio.get_event_loop().time()
                }
                
                logger.info(f"Model {model_id} loaded successfully on GPU {device}")
                return True
                
            except Exception as e:
                logger.error(f"Failed to load model {model_id}: {e}")
                raise
    
    async def unload_model(self, model_id: str) -> bool:
        """Unload a model from the inference engine."""
        if model_id not in self._engines:
            return False
        
        try:
            engine = self._engines[model_id]
            await engine.engine.shutdown()
            
            del self._engines[model_id]
            del self._loaded_models[model_id]
            
            logger.info(f"Model {model_id} unloaded")
            return True
        except Exception as e:
            logger.error(f"Error unloading model {model_id}: {e}")
            return False
    
    async def generate(
        self, 
        request: GenerationRequest
    ) -> GenerationResult:
        """Generate text from a prompt."""
        if not HAS_VLLM:
            raise RuntimeError("vLLM not available")
        
        # Ensure model is loaded
        if request.model not in self._engines:
            await self.load_model(request.model)
        
        engine = self._engines[request.model]
        
        # Build sampling params
        sampling_params = SamplingParams(
            n=1,
            temperature=request.temperature,
            top_p=request.top_p,
            top_k=request.top_k,
            repetition_penalty=request.repetition_penalty,
            max_tokens=request.max_tokens,
            stop=request.stop_sequences or [],
        )
        
        start_time = asyncio.get_event_loop().time()
        
        try:
            # Generate
            request_id = f"req-{asyncio.get_event_loop().time()}"
            
            results_generator = engine.generate(
                request.prompt,
                sampling_params,
                request_id
            )
            
            # Collect final result
            final_output = None
            async for request_output in results_generator:
                final_output = request_output
            
            generation_time_ms = (asyncio.get_event_loop().time() - start_time) * 1000
            
            if final_output and final_output.outputs:
                output = final_output.outputs[0]
                return GenerationResult(
                    text=output.text,
                    tokens_generated=len(output.token_ids),
                    finish_reason=output.finish_reason or "stop",
                    model=request.model,
                    generation_time_ms=generation_time_ms
                )
            else:
                raise RuntimeError("No output generated")
                
        except Exception as e:
            logger.error(f"Generation error: {e}")
            raise
    
    async def generate_stream(
        self,
        request: GenerationRequest
    ) -> AsyncGenerator[str, None]:
        """Generate text with streaming output."""
        if not HAS_VLLM:
            raise RuntimeError("vLLM not available")
        
        # Ensure model is loaded
        if request.model not in self._engines:
            await self.load_model(request.model)
        
        engine = self._engines[request.model]
        
        sampling_params = SamplingParams(
            n=1,
            temperature=request.temperature,
            top_p=request.top_p,
            max_tokens=request.max_tokens,
            stop=request.stop_sequences or [],
        )
        
        request_id = f"req-{asyncio.get_event_loop().time()}"
        
        try:
            results_generator = engine.generate(
                request.prompt,
                sampling_params,
                request_id
            )
            
            previous_text = ""
            async for request_output in results_generator:
                if request_output.outputs:
                    current_text = request_output.outputs[0].text
                    # Yield only new text
                    new_text = current_text[len(previous_text):]
                    if new_text:
                        yield new_text
                    previous_text = current_text
                    
        except Exception as e:
            logger.error(f"Streaming generation error: {e}")
            raise
    
    def _estimate_model_size(self, model_id: str) -> float:
        """Estimate model size in GB from model ID."""
        model_lower = model_id.lower()
        
        if any(x in model_lower for x in ["70b", "72b"]):
            return 140.0
        elif any(x in model_lower for x in ["34b", "35b"]):
            return 70.0
        elif "13b" in model_lower:
            return 26.0
        elif any(x in model_lower for x in ["7b", "8b"]):
            return 16.0
        elif "6.7b" in model_lower:
            return 14.0
        elif "3b" in model_lower:
            return 6.0
        else:
            return 16.0  # Default estimate
    
    def get_loaded_models(self) -> List[Dict]:
        """Get list of currently loaded models."""
        return [
            {
                "model_id": model_id,
                "device": info["device"],
                "loaded_at": info["loaded_at"]
            }
            for model_id, info in self._loaded_models.items()
        ]
    
    def is_model_loaded(self, model_id: str) -> bool:
        """Check if a model is currently loaded."""
        return model_id in self._engines
    
    async def shutdown(self):
        """Shutdown the inference engine."""
        for model_id in list(self._engines.keys()):
            await self.unload_model(model_id)
        
        self.gpu_detector.shutdown()
        logger.info("Inference engine shutdown complete")


# Global instance
_engine: Optional[InferenceEngine] = None


def get_inference_engine() -> InferenceEngine:
    """Get global inference engine instance."""
    global _engine
    if _engine is None:
        _engine = InferenceEngine()
    return _engine
