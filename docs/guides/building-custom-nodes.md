# Building Custom Nodes

## Overview

Custom nodes extend Synapse's compute network with specialized capabilities. This guide covers building nodes for:
- Custom AI models
- Specialized hardware (FPGAs, ASICs)
- Domain-specific compute (scientific, financial)
- Hybrid cloud/on-premise setups

## Architecture of a Custom Node

```
┌─────────────────────────────────────────────────────────┐
│                    Custom Node Container                 │
│  ┌─────────────────────────────────────────────────────┐│
│  │               Your Custom Logic                      ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ││
│  │  │   Model     │  │  Processor  │  │   Output    │  ││
│  │  │   Loader    │  │    Engine   │  │   Handler   │  ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘  ││
│  └─────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────┤
│               Synapse Node Interface                     │
│  • Task Receiver     • Result Publisher                  │
│  • Health Reporter   • Metrics Collector                 │
│  • Attestation       • Payment Handler                   │
└─────────────────────────────────────────────────────────┘
```

## Prerequisites

### System Requirements

```bash
# Base requirements (in addition to standard node)
Docker 20.10+
Docker Compose 2.0+
Go 1.21+ (for custom interface)
Python 3.9+ (for ML workloads)
```

### Development Environment

```bash
# Clone the custom node template
git clone https://github.com/synapse-protocol/custom-node-template.git
cd custom-node-template

# Install dependencies
pip install -r requirements.txt
go mod download

# Copy example config
cp config.example.yaml config.yaml
```

## Quick Start

### 1. Create Node Definition

```yaml
# config.yaml
node:
  name: "my-custom-node"
  type: "custom"
  version: "1.0.0"
  
capabilities:
  - id: "custom-inference"
    name: "Custom Model Inference"
    description: "Runs my custom AI model"
    input_schema: "schemas/input.json"
    output_schema: "schemas/output.json"
    
resources:
  min_gpu_vram: "24GB"
  recommended_gpu: "RTX 4090"
  
hardware:
  type: "gpu"  # or "cpu", "fpga", "asic"
  benchmarks:
    - name: "custom_benchmark"
      script: "benchmarks/run.sh"
```

### 2. Implement Task Handler

```python
# handlers/custom_inference.py
from synapse.custom import TaskHandler, TaskResult
import torch

class CustomInferenceHandler(TaskHandler):
    def __init__(self):
        self.model = None
        
    async def initialize(self):
        """Load model and resources"""
        self.model = torch.load("/models/my-custom-model.pt")
        self.model.eval()
        
    async def process(self, task) -> TaskResult:
        """Process incoming task"""
        try:
            # Extract input
            input_data = task.input['data']
            parameters = task.input.get('parameters', {})
            
            # Run inference
            with torch.no_grad():
                result = self.model(
                    input_data,
                    **parameters
                )
            
            # Return result
            return TaskResult(
                success=True,
                output={"prediction": result.tolist()},
                metrics={
                    "inference_time_ms": 45.2,
                    "tokens_processed": len(input_data)
                }
            )
            
        except Exception as e:
            return TaskResult(
                success=False,
                error=str(e),
                error_code="INFERENCE_FAILED"
            )
            
    async def shutdown(self):
        """Cleanup resources"""
        if self.model:
            del self.model
```

### 3. Build Container

```dockerfile
# Dockerfile
FROM synapse/custom-node-base:latest

# Install custom dependencies
RUN pip install torch==2.1.0 transformers

# Copy custom code
COPY handlers/ /app/handlers/
COPY models/ /app/models/
COPY config.yaml /app/

# Build custom interface
RUN go build -o /app/node-custom ./cmd/custom-node

ENTRYPOINT ["/app/node-custom"]
```

### 4. Register on Network

```bash
# Build and push image
docker build -t myrepo/custom-node:v1.0 .
docker push myrepo/custom-node:v1.0

# Register capability
synapse-cli custom-node register \
  --name "my-custom-node" \
  --image myrepo/custom-node:v1.0 \
  --capability custom-inference \
  --stake 10000
```

## Advanced Topics

### Custom Benchmarks

Create a benchmark to demonstrate your node's performance:

```python
# benchmarks/custom_benchmark.py
import time
import asyncio

async def benchmark():
    """Run benchmark and return score"""
    handler = CustomInferenceHandler()
    await handler.initialize()
    
    # Warmup
    for _ in range(10):
        await handler.process(create_dummy_task())
    
    # Benchmark
    times = []
    for _ in range(100):
        start = time.time()
        await handler.process(create_dummy_task())
        times.append(time.time() - start)
    
    avg_time = sum(times) / len(times)
    throughput = 1.0 / avg_time
    
    return {
        "score": throughput * 1000,  # Normalized score
        "latency_ms": avg_time * 1000,
        "throughput_rps": throughput,
        "hardware_efficiency": calculate_efficiency()
    }

if __name__ == "__main__":
    result = asyncio.run(benchmark())
    print(json.dumps(result))
```

### Custom Attestation

For specialized hardware, implement custom attestation:

```go
// attestation/verifier.go
package attestation

import (
    "synapse/protocol"
)

type CustomAttestation struct {
    HardwareType string
    SerialNumber string
    CapabilityHash string
}

func (ca *CustomAttestation) Generate() (*protocol.AttestationReport, error) {
    // Generate attestation for custom hardware
    report := &protocol.AttestationReport{
        Type: "custom_hardware",
        Data: map[string]interface{}{
            "hardware_type": ca.HardwareType,
            "serial": ca.SerialNumber,
            "capabilities": getCapabilityHash(),
        },
    }
    
    // Sign with hardware key
    signature, err := signWithHardwareKey(report.Data)
    if err != nil {
        return nil, err
    }
    report.Signature = signature
    
    return report, nil
}

func (ca *CustomAttestation) Verify(report *protocol.AttestationReport) error {
    // Verify hardware signature
    return verifyHardwareSignature(report)
}
```

### Batching and Optimization

Implement dynamic batching for high throughput:

```python
class BatchedInferenceHandler(TaskHandler):
    def __init__(self):
        self.batch_queue = []
        self.batch_size = 32
        self.max_wait_ms = 50
        self._batch_task = None
        
    async def process(self, task) -> TaskResult:
        # Add to batch queue
        future = asyncio.Future()
        self.batch_queue.append((task, future))
        
        # Trigger batch processing
        if len(self.batch_queue) >= self.batch_size:
            await self._process_batch()
        elif self._batch_task is None:
            self._batch_task = asyncio.create_task(
                self._delayed_batch()
            )
        
        # Wait for result
        return await future
    
    async def _delayed_batch(self):
        await asyncio.sleep(self.max_wait_ms / 1000)
        await self._process_batch()
        self._batch_task = None
    
    async def _process_batch(self):
        if not self.batch_queue:
            return
            
        # Extract batch
        batch = self.batch_queue[:self.batch_size]
        self.batch_queue = self.batch_queue[self.batch_size:]
        
        # Run batch inference
        inputs = [t[0].input['data'] for t in batch]
        results = self.model.batch_predict(inputs)
        
        # Distribute results
        for (task, future), result in zip(batch, results):
            future.set_result(TaskResult(
                success=True,
                output=result
            ))
```

### Resource Management

Handle GPU memory and other resources efficiently:

```python
import torch
from contextlib import contextmanager

class ResourceManager:
    def __init__(self):
        self.model_cache = {}
        self.max_memory_gb = 20
        
    @contextmanager
    def load_model(self, model_id):
        """Context manager for model loading"""
        # Check cache
        if model_id in self.model_cache:
            model = self.model_cache[model_id]
            yield model
            return
        
        # Load model
        model = self._load_from_disk(model_id)
        
        # Manage cache size
        self._ensure_memory_available(model)
        
        # Add to cache
        self.model_cache[model_id] = model
        
        try:
            yield model
        finally:
            # Optional: cleanup if memory pressure
            pass
    
    def _ensure_memory_available(self, new_model):
        """Evict models if needed"""
        new_size = self._get_model_size(new_model)
        current_usage = sum(
            self._get_model_size(m) 
            for m in self.model_cache.values()
        )
        
        while current_usage + new_size > self.max_memory_gb:
            # Evict LRU model
            lru_model = self._get_lru_model()
            current_usage -= self._get_model_size(lru_model)
            del self.model_cache[lru_model]
            torch.cuda.empty_cache()
```

### Error Handling and Recovery

Implement robust error handling:

```python
from enum import Enum

class ErrorCode(Enum):
    MODEL_NOT_FOUND = "MODEL_NOT_FOUND"
    OUT_OF_MEMORY = "OUT_OF_MEMORY"
    INVALID_INPUT = "INVALID_INPUT"
    TIMEOUT = "TIMEOUT"
    HARDWARE_ERROR = "HARDWARE_ERROR"

class ResilientHandler(TaskHandler):
    def __init__(self):
        self.retry_count = 3
        self.fallback_enabled = True
        
    async def process(self, task) -> TaskResult:
        for attempt in range(self.retry_count):
            try:
                return await self._do_process(task)
            except OutOfMemoryError:
                if attempt < self.retry_count - 1:
                    await self._clear_cache()
                    continue
                return self._oom_fallback(task)
            except TimeoutError:
                if attempt < self.retry_count - 1:
                    await asyncio.sleep(2 ** attempt)
                    continue
                return TaskResult(
                    success=False,
                    error_code=ErrorCode.TIMEOUT,
                    error="Task exceeded maximum duration"
                )
            except Exception as e:
                return TaskResult(
                    success=False,
                    error_code=ErrorCode.HARDWARE_ERROR,
                    error=str(e)
                )
    
    def _oom_fallback(self, task):
        """Fallback to CPU or smaller batch"""
        if self.fallback_enabled:
            return self._process_on_cpu(task)
        return TaskResult(
            success=False,
            error_code=ErrorCode.OUT_OF_MEMORY,
            error="Insufficient GPU memory"
        )
```

## Testing Your Custom Node

### Unit Tests

```python
# tests/test_handler.py
import pytest
from handlers.custom_inference import CustomInferenceHandler

@pytest.fixture
async def handler():
    h = CustomInferenceHandler()
    await h.initialize()
    yield h
    await h.shutdown()

@pytest.mark.asyncio
async def test_inference_success(handler):
    task = create_test_task(input={"data": [1, 2, 3]})
    result = await handler.process(task)
    
    assert result.success is True
    assert "prediction" in result.output
    assert result.metrics["inference_time_ms"] > 0

@pytest.mark.asyncio
async def test_invalid_input(handler):
    task = create_test_task(input={"invalid": "data"})
    result = await handler.process(task)
    
    assert result.success is False
    assert result.error_code == "INVALID_INPUT"
```

### Integration Tests

```python
# tests/test_integration.py
import asyncio
from synapse.test import TestNetwork

async def test_full_pipeline():
    # Start test network
    network = TestNetwork()
    await network.start()
    
    # Register custom node
    node = await network.register_custom_node(
        image="myrepo/custom-node:v1.0",
        capabilities=["custom-inference"]
    )
    
    # Submit test task
    task = await network.submit_task({
        "type": "custom-inference",
        "input": {"data": "test"}
    })
    
    # Wait for completion
    result = await network.wait_for_task(task.id, timeout=60)
    
    assert result.status == "completed"
    assert result.output is not None
    
    await network.stop()
```

## Deployment

### Docker Compose Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  custom-node:
    build: .
    runtime: nvidia  # For GPU access
    environment:
      - SYNAPSE_API_KEY=${SYNAPSE_API_KEY}
      - CUDA_VISIBLE_DEVICES=0
    volumes:
      - ./models:/app/models:ro
      - node-data:/app/data
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    restart: unless-stopped
    
volumes:
  node-data:
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: custom-node
spec:
  replicas: 2
  selector:
    matchLabels:
      app: custom-node
  template:
    metadata:
      labels:
        app: custom-node
    spec:
      containers:
      - name: node
        image: myrepo/custom-node:v1.0
        resources:
          limits:
            nvidia.com/gpu: 1
            memory: "32Gi"
          requests:
            memory: "16Gi"
        env:
        - name: SYNAPSE_API_KEY
          valueFrom:
            secretKeyRef:
              name: synapse-secrets
              key: api-key
        volumeMounts:
        - name: models
          mountPath: /app/models
          readOnly: true
      volumes:
      - name: models
        persistentVolumeClaim:
          claimName: models-pvc
```

## Best Practices

1. **Start Simple:** Begin with basic handler, add complexity gradually
2. **Monitor Resources:** Track GPU memory, CPU, and network usage
3. **Handle Errors Gracefully:** Always return meaningful error codes
4. **Optimize for Batch:** Process multiple tasks when possible
5. **Cache Strategically:** Pre-load popular models
6. **Test Thoroughly:** Unit, integration, and load tests
7. **Document Everything:** Clear README and inline comments
8. **Version Your Node:** Use semantic versioning
9. **Monitor Health:** Implement comprehensive health checks
10. **Stay Updated:** Keep dependencies current

---

For more examples, see the [custom-node-examples](https://github.com/synapse-protocol/custom-node-examples) repository.
