"""Main Synapse Node runtime - orchestrates all components."""

import asyncio
import logging
import signal
import sys
import re
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any
from datetime import datetime

import structlog
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from prometheus_client import start_http_server, Counter, Histogram, Gauge
import hashlib
import json

from synapse_node.core.config import get_config
from synapse_node.core.gpu import get_gpu_detector
from synapse_node.core.inference import get_inference_engine, GenerationRequest
from synapse_node.core.model_manager import get_model_manager
from synapse_node.network.mesh import get_mesh_client, MessageType
from synapse_node.proof.zk import get_proof_generator

logger = structlog.get_logger()

# Prometheus metrics
INFERENCE_REQUESTS = Counter(
    'synapse_inference_requests_total',
    'Total inference requests',
    ['model', 'status']
)
INFERENCE_DURATION = Histogram(
    'synapse_inference_duration_seconds',
    'Inference request duration',
    ['model']
)
TOKENS_GENERATED = Counter(
    'synapse_tokens_generated_total',
    'Total tokens generated',
    ['model']
)
GPU_MEMORY = Gauge(
    'synapse_gpu_memory_bytes',
    'GPU memory usage',
    ['device', 'type']
)
MESH_CONNECTIONS = Gauge(
    'synapse_mesh_connections',
    'Active mesh connections'
)
PROOFS_GENERATED = Counter(
    'synapse_proofs_generated_total',
    'Total ZK proofs generated'
)

# Security: Input validation constants
MAX_PROMPT_LENGTH = 10000
MIN_PROMPT_LENGTH = 1
MAX_MAX_TOKENS = 8192
MAX_TEMPERATURE = 2.0
MIN_TEMPERATURE = 0.0
MAX_TOP_P = 1.0
MIN_TOP_P = 0.0
ALLOWED_MODEL_PATTERN = re.compile(r'^[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+$')

security = HTTPBearer()


class ValidationError(Exception):
    """Custom validation error."""
    pass


def validate_prompt(prompt: str) -> str:
    """
    SECURITY: Validate and sanitize prompt input.
    
    Args:
        prompt: Raw prompt string
        
    Returns:
        Sanitized prompt string
        
    Raises:
        ValidationError: If prompt is invalid
    """
    if not prompt:
        raise ValidationError("Prompt cannot be empty")
    
    if len(prompt) < MIN_PROMPT_LENGTH:
        raise ValidationError(f"Prompt must be at least {MIN_PROMPT_LENGTH} character")
    
    if len(prompt) > MAX_PROMPT_LENGTH:
        raise ValidationError(f"Prompt exceeds maximum length of {MAX_PROMPT_LENGTH} characters")
    
    # SECURITY: Check for potentially malicious patterns
    dangerous_patterns = [
        r'<script',
        r'javascript:',
        r'on\w+\s*=',
        r'data:text/html',
        r'eval\s*\(',
    ]
    
    for pattern in dangerous_patterns:
        if re.search(pattern, prompt, re.IGNORECASE):
            logger.warning("Potentially malicious prompt detected", pattern=pattern[:20])
            raise ValidationError("Prompt contains potentially harmful content")
    
    # SECURITY: Sanitize prompt (remove null bytes, control characters)
    sanitized = ''.join(char for char in prompt if ord(char) >= 32 or char in '\n\r\t')
    
    return sanitized


def validate_model_id(model_id: str) -> str:
    """
    SECURITY: Validate model ID format.
    
    Args:
        model_id: Model identifier string
        
    Returns:
        Validated model ID
        
    Raises:
        ValidationError: If model ID is invalid
    """
    if not model_id:
        raise ValidationError("Model ID is required")
    
    # Check format (should be like 'org/model-name')
    if not ALLOWED_MODEL_PATTERN.match(model_id):
        raise ValidationError("Invalid model ID format. Expected: 'org/model-name'")
    
    # SECURITY: Block potentially dangerous model IDs
    blocked_patterns = ['..', '//', '\\', '\x00', '${', '`']
    for pattern in blocked_patterns:
        if pattern in model_id:
            raise ValidationError("Invalid characters in model ID")
    
    return model_id


def validate_generation_params(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    SECURITY: Validate generation parameters.
    
    Args:
        params: Dictionary of generation parameters
        
    Returns:
        Validated parameters with defaults applied
        
    Raises:
        ValidationError: If parameters are invalid
    """
    validated = {}
    
    # Validate max_tokens
    max_tokens = params.get('max_tokens', 512)
    try:
        max_tokens = int(max_tokens)
        if max_tokens < 1 or max_tokens > MAX_MAX_TOKENS:
            raise ValidationError(f"max_tokens must be between 1 and {MAX_MAX_TOKENS}")
    except (TypeError, ValueError):
        raise ValidationError("max_tokens must be an integer")
    validated['max_tokens'] = max_tokens
    
    # Validate temperature
    temperature = params.get('temperature', 0.7)
    try:
        temperature = float(temperature)
        if temperature < MIN_TEMPERATURE or temperature > MAX_TEMPERATURE:
            raise ValidationError(f"temperature must be between {MIN_TEMPERATURE} and {MAX_TEMPERATURE}")
    except (TypeError, ValueError):
        raise ValidationError("temperature must be a float")
    validated['temperature'] = temperature
    
    # Validate top_p
    top_p = params.get('top_p', 0.9)
    try:
        top_p = float(top_p)
        if top_p < MIN_TOP_P or top_p > MAX_TOP_P:
            raise ValidationError(f"top_p must be between {MIN_TOP_P} and {MAX_TOP_P}")
    except (TypeError, ValueError):
        raise ValidationError("top_p must be a float")
    validated['top_p'] = top_p
    
    # Validate stream
    validated['stream'] = bool(params.get('stream', False))
    
    return validated


class SynapseNode:
    """Main node runtime that coordinates all components."""
    
    def __init__(self):
        self.config = get_config()
        self.gpu_detector = get_gpu_detector()
        self.model_manager = get_model_manager()
        self.inference_engine = get_inference_engine()
        self.mesh_client = get_mesh_client()
        self.proof_generator = get_proof_generator()
        
        self._running = False
        self._shutdown_event = asyncio.Event()
        self._tasks: list[asyncio.Task] = []
    
    async def initialize(self):
        """Initialize all components."""
        logger.info("Initializing Synapse Node", version="0.1.0")
        
        # Setup structured logging
        structlog.configure(
            processors=[
                structlog.stdlib.filter_by_level,
                structlog.stdlib.add_logger_name,
                structlog.stdlib.add_log_level,
                structlog.stdlib.PositionalArgumentsFormatter(),
                structlog.processors.TimeStamper(fmt="iso"),
                structlog.processors.StackInfoRenderer(),
                structlog.processors.format_exc_info,
                structlog.processors.UnicodeDecoder(),
                structlog.processors.JSONRenderer()
            ],
            context_class=dict,
            logger_factory=structlog.stdlib.LoggerFactory(),
            wrapper_class=structlog.stdlib.BoundLogger,
            cache_logger_on_first_use=True,
        )
        
        # Initialize GPU detection
        if self.gpu_detector.initialize():
            devices = self.gpu_detector.get_devices()
            logger.info(
                f"GPU detection enabled",
                device_count=len(devices),
                devices=[d.name for d in devices]
            )
        else:
            logger.warning("GPU detection failed - running in CPU mode")
        
        # Initialize model manager
        await self.model_manager.initialize()
        
        # Initialize inference engine
        await self.inference_engine.initialize()
        
        # Start Prometheus metrics server
        start_http_server(self.config.prometheus_port)
        logger.info(f"Prometheus metrics server started on port {self.config.prometheus_port}")
        
        # Setup mesh network handlers
        self._setup_mesh_handlers()
        
        # Connect to mesh network
        if await self.mesh_client.connect():
            MESH_CONNECTIONS.set(1)
        else:
            logger.warning("Failed to connect to mesh network - continuing in standalone mode")
        
        self._running = True
        logger.info("Synapse Node initialization complete")
    
    def _setup_mesh_handlers(self):
        """Setup handlers for mesh network messages."""
        
        @self.mesh_client.on(MessageType.INFERENCE_REQUEST)
        async def handle_inference_request(message):
            """Handle inference requests from the network."""
            payload = message.payload
            
            try:
                # SECURITY: Validate incoming request
                prompt = validate_prompt(payload.get("prompt", ""))
                model = validate_model_id(payload.get("model", self.config.default_models[0]))
                params = validate_generation_params({
                    'max_tokens': payload.get("max_tokens", 512),
                    'temperature': payload.get("temperature", 0.7),
                    'stream': False
                })
                
                request = GenerationRequest(
                    prompt=prompt,
                    model=model,
                    max_tokens=params['max_tokens'],
                    temperature=params['temperature'],
                    stream=False
                )
                
                result = await self.inference_engine.generate(request)
                
                # SECURITY: Get actual GPU utilization metrics
                gpu_utilization = self._get_gpu_utilization()
                
                proof_input = self.proof_generator.create_proof_input(
                    request_data=payload,
                    response_data={"text": result.text},
                    model_id=request.model,
                    tokens_generated=result.tokens_generated,
                    gpu_utilization=gpu_utilization
                )
                
                proof = await self.proof_generator.generate_proof(proof_input)
                PROOFS_GENERATED.inc()
                
                # Send response
                await self.mesh_client.send_message(
                    MessageType.INFERENCE_RESPONSE,
                    {
                        "text": result.text,
                        "tokens": result.tokens_generated,
                        "proof_id": proof.proof_id,
                        "model": request.model
                    },
                    reply_to=message.message_id
                )
                
                INFERENCE_REQUESTS.labels(model=request.model, status="success").inc()
                TOKENS_GENERATED.labels(model=request.model).inc(result.tokens_generated)
                
            except ValidationError as e:
                logger.warning("Validation error in mesh request", error=str(e))
                await self.mesh_client.send_message(
                    MessageType.ERROR,
                    {"error": "Invalid request", "details": str(e)},
                    reply_to=message.message_id
                )
            except Exception as e:
                logger.error("Inference request failed", error=str(e))
                INFERENCE_REQUESTS.labels(model=payload.get("model", "unknown"), status="error").inc()
                
                await self.mesh_client.send_message(
                    MessageType.ERROR,
                    {"error": "Internal error"},
                    reply_to=message.message_id
                )
    
    def _get_gpu_utilization(self) -> float:
        """
        Get actual GPU utilization metrics.
        
        Returns:
            Average GPU utilization across all devices (0.0-100.0)
        """
        try:
            stats = self.gpu_detector.get_stats()
            if not stats.get("available"):
                return 0.0
            
            devices = stats.get("devices", [])
            if not devices:
                return 0.0
            
            total_utilization = sum(d.get("utilization", 0) for d in devices)
            return total_utilization / len(devices)
        except Exception as e:
            logger.warning("Failed to get GPU utilization", error=str(e))
            return 0.0
    
    async def run(self):
        """Main run loop."""
        logger.info("Node entering main run loop")
        
        # Start background tasks
        self._tasks.append(asyncio.create_task(self._metrics_collector()))
        self._tasks.append(asyncio.create_task(self._watchdog()))
        
        try:
            await self._shutdown_event.wait()
        except asyncio.CancelledError:
            pass
        finally:
            await self.shutdown()
    
    async def _metrics_collector(self):
        """Collect and update metrics periodically."""
        while self._running:
            try:
                # Update GPU metrics
                stats = self.gpu_detector.get_stats()
                if stats.get("available"):
                    for device in stats.get("devices", []):
                        idx = device["index"]
                        GPU_MEMORY.labels(device=f"gpu_{idx}", type="used").set(
                            device["memory_used_gb"] * 1e9
                        )
                        GPU_MEMORY.labels(device=f"gpu_{idx}", type="free").set(
                            device["memory_free_gb"] * 1e9
                        )
                
                await asyncio.sleep(15)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Metrics collector error", error=str(e))
                await asyncio.sleep(15)
    
    async def _watchdog(self):
        """Watchdog to monitor node health."""
        while self._running:
            try:
                # Check mesh connection
                if not self.mesh_client.is_connected():
                    logger.warning("Mesh connection lost, attempting reconnect")
                    if await self.mesh_client.connect():
                        MESH_CONNECTIONS.set(1)
                
                await asyncio.sleep(30)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Watchdog error", error=str(e))
                await asyncio.sleep(30)
    
    async def shutdown(self):
        """Graceful shutdown."""
        logger.info("Shutting down Synapse Node")
        self._running = False
        
        # Cancel background tasks
        for task in self._tasks:
            task.cancel()
        
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        
        # Shutdown components
        await self.inference_engine.shutdown()
        await self.mesh_client.disconnect()
        self.gpu_detector.shutdown()
        
        logger.info("Shutdown complete")
    
    def signal_handler(self, sig, frame):
        """Handle shutdown signals."""
        logger.info(f"Received signal {sig}")
        self._shutdown_event.set()


# SECURITY: API Key validation
def verify_api_key(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify API key from request."""
    token = credentials.credentials
    
    # In production, validate against stored keys
    expected_key = get_config().api_key
    
    if not expected_key:
        # If no API key configured, skip validation (dev mode)
        return True
    
    if token != expected_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    return True


# Create FastAPI app
def create_app() -> FastAPI:
    """Create FastAPI application."""
    config = get_config()
    node = SynapseNode()
    
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # Startup
        await node.initialize()
        asyncio.create_task(node.run())
        yield
        # Shutdown
        await node.shutdown()
    
    app = FastAPI(
        title="Synapse Node API",
        description="Decentralized AI Inference Node",
        version="0.1.0",
        lifespan=lifespan
    )
    
    # SECURITY: Add security middleware
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=config.allowed_hosts or ["*"]
    )
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins or ["*"],
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
        max_age=600
    )
    
    # SECURITY: Request size limiting middleware
    @app.middleware("http")
    async def limit_request_size(request: Request, call_next):
        content_length = request.headers.get('content-length')
        if content_length and int(content_length) > 10 * 1024 * 1024:  # 10MB limit
            return JSONResponse(
                status_code=413,
                content={"error": "Request too large"}
            )
        return await call_next(request)
    
    # SECURITY: Add rate limiting middleware
    request_counts: Dict[str, list] = {}
    
    @app.middleware("http")
    async def rate_limit_middleware(request: Request, call_next):
        client_ip = request.client.host
        now = datetime.now().timestamp()
        
        # Clean old entries
        if client_ip in request_counts:
            request_counts[client_ip] = [
                t for t in request_counts[client_ip] 
                if now - t < 60  # 1 minute window
            ]
        else:
            request_counts[client_ip] = []
        
        # Check rate limit
        if len(request_counts[client_ip]) >= 100:  # 100 requests per minute
            return JSONResponse(
                status_code=429,
                content={"error": "Rate limit exceeded", "retry_after": 60}
            )
        
        request_counts[client_ip].append(now)
        return await call_next(request)
    
    @app.get("/health")
    async def health():
        """Health check endpoint."""
        return {
            "status": "healthy",
            "node_id": config.node_id,
            "gpu_available": len(node.gpu_detector.get_devices()) > 0,
            "mesh_connected": node.mesh_client.is_connected(),
            "models_loaded": len(node.inference_engine.get_loaded_models())
        }
    
    @app.get("/status")
    async def status():
        """Detailed status endpoint."""
        return {
            "node_id": config.node_id,
            "node_name": config.node_name,
            "gpu": node.gpu_detector.get_stats(),
            "models": {
                "cached": [m.model_id for m in node.model_manager.list_cached_models()],
                "loaded": node.inference_engine.get_loaded_models()
            },
            "mesh": {
                "connected": node.mesh_client.is_connected(),
                "peers": len(node.mesh_client.get_peers())
            }
        }
    
    @app.post("/inference")
    async def inference(request: dict, authorized: bool = Depends(verify_api_key)):
        """Run inference on a prompt."""
        try:
            # SECURITY: Validate and sanitize all inputs
            prompt = validate_prompt(request.get("prompt", ""))
            model = validate_model_id(request.get("model", config.default_models[0]))
            params = validate_generation_params(request)
            
            gen_request = GenerationRequest(
                prompt=prompt,
                model=model,
                max_tokens=params['max_tokens'],
                temperature=params['temperature'],
                top_p=params['top_p'],
                stream=params['stream']
            )
            
            if gen_request.stream:
                from fastapi.responses import StreamingResponse
                
                async def stream_generator():
                    try:
                        async for chunk in node.inference_engine.generate_stream(gen_request):
                            yield f"data: {json.dumps({'text': chunk})}\n\n"
                        yield "data: [DONE]\n\n"
                    except Exception as e:
                        logger.error("Streaming error", error=str(e))
                        yield f"data: {json.dumps({'error': 'Streaming failed'})}\n\n"
                
                return StreamingResponse(
                    stream_generator(),
                    media_type="text/event-stream"
                )
            else:
                result = await node.inference_engine.generate(gen_request)
                
                # Generate proof with actual GPU utilization
                gpu_util = node._get_gpu_utilization()
                proof_input = node.proof_generator.create_proof_input(
                    request_data=request,
                    response_data={"text": result.text},
                    model_id=gen_request.model,
                    tokens_generated=result.tokens_generated,
                    gpu_utilization=gpu_util
                )
                proof = await node.proof_generator.generate_proof(proof_input)
                
                return {
                    "text": result.text,
                    "tokens_generated": result.tokens_generated,
                    "generation_time_ms": result.generation_time_ms,
                    "model": result.model,
                    "proof_id": proof.proof_id
                }
                
        except ValidationError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.error("Inference error", error=str(e))
            raise HTTPException(status_code=500, detail="Inference failed")
    
    @app.get("/models")
    async def list_models():
        """List available models."""
        return {
            "cached": [
                {
                    "id": m.model_id,
                    "size_gb": m.size_bytes / 1e9 if m.size_bytes else 0
                }
                for m in node.model_manager.list_cached_models()
            ],
            "loaded": node.inference_engine.get_loaded_models()
        }
    
    @app.post("/models/{model_id}/load")
    async def load_model(model_id: str, authorized: bool = Depends(verify_api_key)):
        """Load a model into memory."""
        try:
            # SECURITY: Validate model ID
            validated_id = validate_model_id(model_id)
            
            success = await node.inference_engine.load_model(validated_id)
            if success:
                return {"status": "loaded", "model": validated_id}
            raise HTTPException(status_code=500, detail="Failed to load model")
        except ValidationError as e:
            raise HTTPException(status_code=400, detail=str(e))
    
    @app.post("/models/download")
    async def download_model(request: dict, authorized: bool = Depends(verify_api_key)):
        """Download a model from HuggingFace."""
        model_id = request.get("model_id")
        if not model_id:
            raise HTTPException(status_code=400, detail="model_id required")
        
        try:
            # SECURITY: Validate model ID before download
            validated_id = validate_model_id(model_id)
            
            info = await node.model_manager.download_model(validated_id)
            return {
                "status": "downloaded",
                "model": validated_id,
                "path": str(info.local_path) if info.local_path else None
            }
        except ValidationError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    # SECURITY: Global exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled exception", error=str(exc), path=request.url.path)
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error"}
        )
    
    return app
