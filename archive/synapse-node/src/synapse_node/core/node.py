"""Main Synapse Node runtime - orchestrates all components."""

import asyncio
import logging
import signal
import sys
from contextlib import asynccontextmanager
from typing import Optional

import structlog
from fastapi import FastAPI, HTTPException
from prometheus_client import start_http_server, Counter, Histogram, Gauge

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
                request = GenerationRequest(
                    prompt=payload.get("prompt", ""),
                    model=payload.get("model", self.config.default_models[0]),
                    max_tokens=payload.get("max_tokens", 512),
                    temperature=payload.get("temperature", 0.7),
                    stream=False
                )
                
                result = await self.inference_engine.generate(request)
                
                # Generate proof of work
                proof_input = self.proof_generator.create_proof_input(
                    request_data=payload,
                    response_data={"text": result.text},
                    model_id=request.model,
                    tokens_generated=result.tokens_generated,
                    gpu_utilization=self._get_gpu_utilization()
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
                
            except Exception as e:
                logger.error("Inference request failed", error=str(e))
                INFERENCE_REQUESTS.labels(model=payload.get("model", "unknown"), status="error").inc()
                
                await self.mesh_client.send_message(
                    MessageType.ERROR,
                    {"error": str(e)},
                    reply_to=message.message_id
                )
    
    def _get_gpu_utilization(self) -> float:
        """Get actual GPU utilization metrics."""
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
            await asyncio.gather(*tasks, return_exceptions=True)
        
        # Shutdown components
        await self.inference_engine.shutdown()
        await self.mesh_client.disconnect()
        self.gpu_detector.shutdown()
        
        logger.info("Shutdown complete")
    
    def signal_handler(self, sig, frame):
        """Handle shutdown signals."""
        logger.info(f"Received signal {sig}")
        self._shutdown_event.set()


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
    async def inference(request: dict):
        """Run inference on a prompt."""
        try:
            gen_request = GenerationRequest(
                prompt=request.get("prompt", ""),
                model=request.get("model", config.default_models[0]),
                max_tokens=request.get("max_tokens", 512),
                temperature=request.get("temperature", 0.7),
                top_p=request.get("top_p", 0.9),
                stream=request.get("stream", False)
            )
            
            if gen_request.stream:
                from fastapi.responses import StreamingResponse
                
                async def stream_generator():
                    async for chunk in node.inference_engine.generate_stream(gen_request):
                        yield f"data: {chunk}\n\n"
                    yield "data: [DONE]\n\n"
                
                return StreamingResponse(
                    stream_generator(),
                    media_type="text/event-stream"
                )
            else:
                result = await node.inference_engine.generate(gen_request)
                
                # Generate proof
                proof_input = node.proof_generator.create_proof_input(
                    request_data=request,
                    response_data={"text": result.text},
                    model_id=gen_request.model,
                    tokens_generated=result.tokens_generated
                )
                proof = await node.proof_generator.generate_proof(proof_input)
                
                return {
                    "text": result.text,
                    "tokens_generated": result.tokens_generated,
                    "generation_time_ms": result.generation_time_ms,
                    "model": result.model,
                    "proof_id": proof.proof_id
                }
                
        except Exception as e:
            logger.error("Inference error", error=str(e))
            raise HTTPException(status_code=500, detail=str(e))
    
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
    async def load_model(model_id: str):
        """Load a model into memory."""
        success = await node.inference_engine.load_model(model_id)
        if success:
            return {"status": "loaded", "model": model_id}
        raise HTTPException(status_code=500, detail="Failed to load model")
    
    @app.post("/models/download")
    async def download_model(request: dict):
        """Download a model from HuggingFace."""
        model_id = request.get("model_id")
        if not model_id:
            raise HTTPException(status_code=400, detail="model_id required")
        
        try:
            info = await node.model_manager.download_model(model_id)
            return {
                "status": "downloaded",
                "model": model_id,
                "path": str(info.local_path) if info.local_path else None
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    return app
