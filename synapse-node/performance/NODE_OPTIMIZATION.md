# Node Performance Optimization Guide

## Overview
This guide covers GPU and compute node performance optimizations for the Synapse platform.

## 1. GPU Optimization (CUDA Kernels)

### CUDA Kernel Setup
```cuda
// kernels/convolution.cu
#include <cuda_runtime.h>
#include <cuda_fp16.h>

// Optimized 2D convolution kernel
__global__ void conv2d_kernel(
    const float* __restrict__ input,
    const float* __restrict__ kernel,
    float* __restrict__ output,
    int input_width, int input_height,
    int kernel_size, int output_channels
) {
    // Shared memory for kernel weights
    extern __shared__ float shared_kernel[];
    
    const int tx = threadIdx.x;
    const int ty = threadIdx.y;
    const int bx = blockIdx.x;
    const int by = blockIdx.y;
    
    // Calculate output position
    const int out_x = bx * blockDim.x + tx;
    const int out_y = by * blockDim.y + ty;
    
    // Load kernel to shared memory
    if (tx < kernel_size && ty < kernel_size) {
        shared_kernel[ty * kernel_size + tx] = kernel[ty * kernel_size + tx];
    }
    __syncthreads();
    
    // Convolution computation
    float sum = 0.0f;
    const int half_k = kernel_size / 2;
    
    #pragma unroll
    for (int ky = 0; ky < kernel_size; ky++) {
        #pragma unroll
        for (int kx = 0; kx < kernel_size; kx++) {
            int in_x = out_x + kx - half_k;
            int in_y = out_y + ky - half_k;
            
            if (in_x >= 0 && in_x < input_width && in_y >= 0 && in_y < input_height) {
                sum += input[in_y * input_width + in_x] * 
                       shared_kernel[ky * kernel_size + kx];
            }
        }
    }
    
    // Write output
    if (out_x < input_width && out_y < input_height) {
        output[out_y * input_width + out_x] = sum;
    }
}

// Half-precision (FP16) kernel for faster computation
__global__ void conv2d_fp16_kernel(
    const __half* __restrict__ input,
    const __half* __restrict__ kernel,
    __half* __restrict__ output,
    int input_width, int input_height,
    int kernel_size
) {
    // Use Tensor Cores when available
    #if __CUDA_ARCH__ >= 700
        // WMMA (Warp Matrix Multiply Accumulate) for Volta+
        wmma::fragment<wmma::matrix_a, 16, 16, 16, __half, wmma::col_major> a_frag;
        wmma::fragment<wmma::matrix_b, 16, 16, 16, __half, wmma::row_major> b_frag;
        wmma::fragment<wmma::accumulator, 16, 16, 16, float> c_frag;
    #endif
    
    // FP16 computation
    __half sum = __float2half(0.0f);
    // ... convolution logic with FP16
}

// Launch configuration helper
void launch_conv2d(
    const float* input, const float* kernel, float* output,
    int width, int height, int k_size
) {
    const dim3 block_size(16, 16);
    const dim3 grid_size(
        (width + block_size.x - 1) / block_size.x,
        (height + block_size.y - 1) / block_size.y
    );
    
    const size_t shared_mem = k_size * k_size * sizeof(float);
    
    conv2d_kernel<<<grid_size, block_size, shared_mem>>>(
        input, kernel, output, width, height, k_size, 1
    );
    
    cudaDeviceSynchronize();
}
```

### CUDA Stream Management
```cpp
// src/gpu/stream_manager.cpp
#include <cuda_runtime.h>
#include <vector>
#include <queue>
#include <mutex>

class StreamManager {
private:
    std::vector<cudaStream_t> streams;
    std::queue<int> available_streams;
    std::mutex mtx;
    int num_streams;
    
public:
    StreamManager(int n_streams = 4) : num_streams(n_streams) {
        streams.resize(num_streams);
        for (int i = 0; i < num_streams; i++) {
            cudaStreamCreateWithFlags(&streams[i], cudaStreamNonBlocking);
            available_streams.push(i);
        }
    }
    
    ~StreamManager() {
        for (auto& stream : streams) {
            cudaStreamDestroy(stream);
        }
    }
    
    int acquire_stream() {
        std::lock_guard<std::mutex> lock(mtx);
        if (available_streams.empty()) {
            return -1; // No available streams
        }
        int stream_id = available_streams.front();
        available_streams.pop();
        return stream_id;
    }
    
    void release_stream(int stream_id) {
        std::lock_guard<std::mutex> lock(mtx);
        available_streams.push(stream_id);
    }
    
    cudaStream_t get_stream(int stream_id) {
        return streams[stream_id];
    }
    
    // Synchronize specific stream
    void synchronize(int stream_id) {
        cudaStreamSynchronize(streams[stream_id]);
    }
    
    // Synchronize all streams
    void synchronize_all() {
        for (auto& stream : streams) {
            cudaStreamSynchronize(stream);
        }
    }
};

// Overlapped computation and data transfer
void async_inference(
    StreamManager& stream_mgr,
    float* h_input, float* h_output,
    float* d_input, float* d_output,
    size_t data_size
) {
    int stream_id = stream_mgr.acquire_stream();
    if (stream_id < 0) return;
    
    cudaStream_t stream = stream_mgr.get_stream(stream_id);
    
    // Async host to device
    cudaMemcpyAsync(d_input, h_input, data_size, cudaMemcpyHostToDevice, stream);
    
    // Launch kernel
    inference_kernel<<<grid, block, 0, stream>>>(d_input, d_output);
    
    // Async device to host
    cudaMemcpyAsync(h_output, d_output, data_size, cudaMemcpyDeviceToHost, stream);
    
    // Release stream when done (using callback)
    cudaStreamAddCallback(stream, [](cudaStream_t, cudaError_t, void* userData) {
        int* sid = static_cast<int*>(userData);
        // Release stream
        delete sid;
    }, new int(stream_id), 0);
}
```

### GPU Memory Management
```cpp
// src/gpu/memory_pool.cpp
#include <cuda_runtime.h>
#include <unordered_map>
#include <list>
#include <mutex>

class GPUMemoryPool {
private:
    struct MemoryBlock {
        void* ptr;
        size_t size;
        bool in_use;
    };
    
    std::unordered_map<void*, MemoryBlock> allocations;
    std::list<MemoryBlock> free_blocks;
    size_t total_allocated;
    size_t pool_size;
    std::mutex mtx;
    
public:
    GPUMemoryPool(size_t initial_pool_size = 1024 * 1024 * 1024)  // 1GB default
        : total_allocated(0), pool_size(initial_pool_size) {
        // Pre-allocate pool
        void* pool_ptr;
        cudaMalloc(&pool_ptr, pool_size);
        
        MemoryBlock block{pool_ptr, pool_size, false};
        free_blocks.push_back(block);
        allocations[pool_ptr] = block;
    }
    
    ~GPUMemoryPool() {
        for (auto& [ptr, block] : allocations) {
            cudaFree(ptr);
        }
    }
    
    void* allocate(size_t size) {
        std::lock_guard<std::mutex> lock(mtx);
        
        // Find best-fit free block
        auto it = free_blocks.begin();
        auto best = free_blocks.end();
        size_t best_size = SIZE_MAX;
        
        for (; it != free_blocks.end(); ++it) {
            if (!it->in_use && it->size >= size && it->size < best_size) {
                best = it;
                best_size = it->size;
            }
        }
        
        if (best != free_blocks.end()) {
            // Split block if significantly larger
            if (best->size > size * 2) {
                MemoryBlock new_block{
                    static_cast<char*>(best->ptr) + size,
                    best->size - size,
                    false
                };
                best->size = size;
                free_blocks.insert(std::next(best), new_block);
            }
            
            best->in_use = true;
            return best->ptr;
        }
        
        // Allocate new memory if pool exhausted
        void* new_ptr;
        cudaMalloc(&new_ptr, size);
        
        MemoryBlock block{new_ptr, size, true};
        allocations[new_ptr] = block;
        
        return new_ptr;
    }
    
    void deallocate(void* ptr) {
        std::lock_guard<std::mutex> lock(mtx);
        
        auto it = allocations.find(ptr);
        if (it != allocations.end()) {
            it->second.in_use = false;
            
            // Coalesce adjacent free blocks
            coalesce_blocks();
        }
    }
    
    void coalesce_blocks() {
        // Sort free blocks by address and merge adjacent ones
        free_blocks.sort([](const MemoryBlock& a, const MemoryBlock& b) {
            return a.ptr < b.ptr;
        });
        
        auto it = free_blocks.begin();
        while (it != free_blocks.end() && std::next(it) != free_blocks.end()) {
            auto next = std::next(it);
            char* end_of_current = static_cast<char*>(it->ptr) + it->size;
            
            if (end_of_current == next->ptr && !it->in_use && !next->in_use) {
                it->size += next->size;
                free_blocks.erase(next);
            } else {
                ++it;
            }
        }
    }
};
```

## 2. Model Quantization (INT8, FP16)

### TensorRT Optimization
```python
# src/optimization/tensorrt_optimizer.py
import tensorrt as trt
import numpy as np
import pycuda.driver as cuda
import pycuda.autoinit

class TensorRTEngine:
    def __init__(self, onnx_path: str, precision: str = "fp16"):
        self.logger = trt.Logger(trt.Logger.WARNING)
        self.precision = precision
        self.engine = self._build_engine(onnx_path)
        self.context = self.engine.create_execution_context()
        self._allocate_buffers()
    
    def _build_engine(self, onnx_path: str) -> trt.ICudaEngine:
        builder = trt.Builder(self.logger)
        network = builder.create_network(
            1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH)
        )
        parser = trt.OnnxParser(network, self.logger)
        
        # Parse ONNX model
        with open(onnx_path, 'rb') as f:
            parser.parse(f.read())
        
        # Configure builder
        config = builder.create_builder_config()
        config.max_workspace_size = 4 * 1024 * 1024 * 1024  # 4GB
        
        # Set precision
        if self.precision == "fp16":
            config.set_flag(trt.BuilderFlag.FP16)
        elif self.precision == "int8":
            config.set_flag(trt.BuilderFlag.INT8)
            # Calibrator for INT8
            config.int8_calibrator = self._create_calibrator()
        
        # Enable optimizations
        config.set_flag(trt.BuilderFlag.OBEY_PRECISION_CONSTRAINTS)
        
        # Build engine
        engine = builder.build_engine(network, config)
        return engine
    
    def _create_calibrator(self):
        # INT8 calibration for quantization
        class Int8Calibrator(trt.IInt8EntropyCalibrator2):
            def __init__(self, data_loader):
                super().__init__()
                self.data_loader = data_loader
                self.batch_size = 32
                self.current_index = 0
            
            def get_batch_size(self):
                return self.batch_size
            
            def get_batch(self, names):
                if self.current_index >= len(self.data_loader):
                    return None
                
                batch = self.data_loader[self.current_index:self.current_index + self.batch_size]
                self.current_index += self.batch_size
                return [batch.numpy().ravel()]
            
            def read_calibration_cache(self):
                # Load cached calibration
                if os.path.exists('calibration.cache'):
                    with open('calibration.cache', 'rb') as f:
                        return f.read()
                return None
            
            def write_calibration_cache(self, cache):
                with open('calibration.cache', 'wb') as f:
                    f.write(cache)
        
        return Int8Calibrator(self.calibration_data)
    
    def infer(self, input_data: np.ndarray) -> np.ndarray:
        # Copy input to device
        cuda.memcpy_htod(self.d_input, input_data.ravel())
        
        # Execute
        self.context.execute_v2([self.d_input, self.d_output])
        
        # Copy output to host
        cuda.memcpy_dtoh(self.h_output, self.d_output)
        
        return self.h_output
    
    def _allocate_buffers(self):
        # Allocate device memory
        self.d_input = cuda.mem_alloc(self.input_size)
        self.d_output = cuda.mem_alloc(self.output_size)
        
        # Allocate host memory
        self.h_output = cuda.pagelocked_empty(self.output_shape, dtype=np.float32)

# Quantization-aware training wrapper
import torch
import torch.quantization

class QuantizedModel(torch.nn.Module):
    def __init__(self, model: torch.nn.Module):
        super().__init__()
        self.model = model
        
        # Prepare for quantization
        self.model.qconfig = torch.quantization.get_default_qconfig('fbgemm')
        torch.quantization.prepare(self.model, inplace=True)
    
    def forward(self, x):
        return self.model(x)
    
    def convert(self):
        torch.quantization.convert(self.model, inplace=True)
        return self
```

### Dynamic Quantization
```python
# src/optimization/quantization.py
import torch
import torch.quantization
from transformers import AutoModel

def quantize_model(model_path: str, method: str = "dynamic") -> torch.nn.Module:
    """
    Quantize model for inference optimization.
    
    Methods:
    - dynamic: Dynamic quantization (weights to int8, activations float32)
    - static: Static quantization (both weights and activations to int8)
    - jit: TorchScript JIT compilation
    """
    model = AutoModel.from_pretrained(model_path)
    model.eval()
    
    if method == "dynamic":
        # Dynamic quantization (easy, good for LSTM/Transformer)
        quantized_model = torch.quantization.quantize_dynamic(
            model,
            {torch.nn.Linear, torch.nn.LSTM},
            dtype=torch.qint8
        )
    
    elif method == "static":
        # Static quantization (best performance, needs calibration)
        model.qconfig = torch.quantization.get_default_qconfig('fbgemm')
        torch.quantization.prepare(model, inplace=True)
        
        # Calibrate with representative data
        calibrate_model(model, calibration_data)
        
        quantized_model = torch.quantization.convert(model, inplace=True)
    
    elif method == "jit":
        # TorchScript JIT compilation
        example_input = torch.randn(1, 3, 224, 224)
        traced_model = torch.jit.trace(model, example_input)
        quantized_model = torch.jit.optimize_for_inference(traced_model)
    
    return quantized_model

def benchmark_quantization(model, quantized_model, input_data):
    """Benchmark quantization impact."""
    import time
    
    # Warm up
    for _ in range(10):
        _ = model(input_data)
        _ = quantized_model(input_data)
    
    # Benchmark
    torch.set_num_threads(1)
    
    start = time.time()
    for _ in range(100):
        _ = model(input_data)
    fp32_time = time.time() - start
    
    start = time.time()
    for _ in range(100):
        _ = quantized_model(input_data)
    int8_time = time.time() - start
    
    # Model size
    fp32_size = sum(p.numel() * 4 for p in model.parameters()) / 1024 / 1024
    int8_size = sum(p.numel() * 1 for p in quantized_model.parameters()) / 1024 / 1024
    
    print(f"FP32 Model: {fp32_size:.2f}MB, Time: {fp32_time:.3f}s")
    print(f"INT8 Model: {int8_size:.2f}MB, Time: {int8_time:.3f}s")
    print(f"Speedup: {fp32_time/int8_time:.2f}x")
    print(f"Compression: {fp32_size/int8_size:.2f}x")
```

## 3. Batch Inference

### Dynamic Batching
```python
# src/inference/batch_processor.py
import asyncio
from collections import deque
from typing import List, Callable, Any
import time

class DynamicBatcher:
    """
    Dynamic batching system for efficient inference.
    Batches requests arriving within a time window.
    """
    
    def __init__(
        self,
        inference_fn: Callable[[List[Any]], List[Any]],
        max_batch_size: int = 32,
        max_wait_ms: float = 10.0
    ):
        self.inference_fn = inference_fn
        self.max_batch_size = max_batch_size
        self.max_wait_ms = max_wait_ms / 1000  # Convert to seconds
        
        self.queue = deque()
        self.results = {}
        self.batch_task = None
        self.request_id = 0
        self.lock = asyncio.Lock()
    
    async def submit(self, item: Any) -> Any:
        """Submit a single item for batched inference."""
        async with self.lock:
            req_id = self.request_id
            self.request_id += 1
            
            future = asyncio.Future()
            self.queue.append((req_id, item, future))
            
            # Start batch processor if not running
            if self.batch_task is None or self.batch_task.done():
                self.batch_task = asyncio.create_task(self._process_batch())
            
            return await future
    
    async def _process_batch(self):
        """Process batched requests."""
        await asyncio.sleep(self.max_wait_ms)  # Wait for more requests
        
        async with self.lock:
            if not self.queue:
                return
            
            # Collect batch
            batch = []
            futures = []
            
            while self.queue and len(batch) < self.max_batch_size:
                req_id, item, future = self.queue.popleft()
                batch.append((req_id, item))
                futures.append((req_id, future))
            
            # Pad batch for efficient GPU utilization
            original_size = len(batch)
            while len(batch) < self.max_batch_size:
                batch.append(batch[-1])  # Pad with last item
        
        # Run inference
        try:
            items = [item for _, item in batch]
            results = self.inference_fn(items)
            
            # Return results
            for i, (req_id, future) in enumerate(futures):
                if not future.done():
                    future.set_result(results[i])
        except Exception as e:
            for _, future in futures:
                if not future.done():
                    future.set_exception(e)

# Usage example
class InferenceServer:
    def __init__(self, model):
        self.model = model
        self.batcher = DynamicBatcher(
            inference_fn=self._batch_infer,
            max_batch_size=64,
            max_wait_ms=5
        )
    
    def _batch_infer(self, items: List[dict]) -> List[dict]:
        """Batch inference function."""
        # Stack inputs
        inputs = torch.stack([item['input'] for item in items])
        
        # Run inference
        with torch.no_grad():
            outputs = self.model(inputs)
        
        # Return individual results
        return [{'output': out} for out in outputs]
    
    async def predict(self, input_data: dict) -> dict:
        """Single prediction with dynamic batching."""
        return await self.batcher.submit(input_data)

# Continuous batching for LLMs
class ContinuousBatching:
    """
    Continuous batching for autoregressive models.
    New requests join running batch as soon as there's capacity.
    """
    
    def __init__(self, model, max_batch_size: int = 16):
        self.model = model
        self.max_batch_size = max_batch_size
        self.active_requests = []
        self.running = False
    
    async def add_request(self, request):
        """Add a new request to the running batch."""
        if len(self.active_requests) < self.max_batch_size:
            self.active_requests.append(request)
            if not self.running:
                asyncio.create_task(self._generation_loop())
        else:
            # Queue for next batch
            await self._wait_for_slot(request)
    
    async def _generation_loop(self):
        """Main generation loop with continuous batching."""
        self.running = True
        
        while self.active_requests:
            # Prepare batch
            input_ids = [req.get_next_input() for req in self.active_requests]
            attention_mask = self._create_attention_mask(input_ids)
            
            # Forward pass
            outputs = self.model(
                input_ids=torch.cat(input_ids),
                attention_mask=attention_mask
            )
            
            # Distribute results
            completed = []
            for i, req in enumerate(self.active_requests):
                token = outputs.logits[i].argmax(-1)
                req.add_token(token)
                
                if req.is_complete():
                    completed.append(req)
            
            # Remove completed requests
            self.active_requests = [r for r in self.active_requests if r not in completed]
            
            await asyncio.sleep(0)  # Yield control
        
        self.running = False
```

## 4. Memory Management

### GPU Memory Optimizer
```python
# src/optimization/memory_optimizer.py
import torch
import gc
from contextlib import contextmanager

class GPUMemoryOptimizer:
    """Optimize GPU memory usage for large models."""
    
    @staticmethod
    def enable_memory_efficient_attention():
        """Enable memory-efficient attention (for transformers)."""
        try:
            from xformers.ops import memory_efficient_attention
            # Patch attention if available
            pass
        except ImportError:
            print("xformers not available, using standard attention")
    
    @staticmethod
    def enable_gradient_checkpointing(model):
        """Enable gradient checkpointing to trade compute for memory."""
        if hasattr(model, 'gradient_checkpointing_enable'):
            model.gradient_checkpointing_enable()
        else:
            torch.utils.checkpoint.checkpoint_sequential(
                model, segments=len(model)//2, input=model.input
            )
    
    @staticmethod
    def clear_cache():
        """Clear GPU cache and run garbage collection."""
        gc.collect()
        torch.cuda.empty_cache()
        torch.cuda.synchronize()
    
    @staticmethod
    def get_memory_stats():
        """Get current GPU memory statistics."""
        return {
            'allocated': torch.cuda.memory_allocated() / 1024**3,  # GB
            'reserved': torch.cuda.memory_reserved() / 1024**3,
            'max_allocated': torch.cuda.max_memory_allocated() / 1024**3,
            'free': (torch.cuda.get_device_properties(0).total_memory - 
                    torch.cuda.memory_allocated()) / 1024**3
        }
    
    @contextmanager
    def autocast(self, enabled=True):
        """Automatic mixed precision context."""
        with torch.cuda.amp.autocast(enabled=enabled):
            yield

# Model sharding for large models
class ModelSharder:
    """Shard large models across multiple GPUs."""
    
    def __init__(self, model, num_gpus: int):
        self.model = model
        self.num_gpus = num_gpus
        self.layers_per_gpu = len(model.layers) // num_gpus
    
    def shard(self):
        """Distribute model layers across GPUs."""
        for i, layer in enumerate(self.model.layers):
            gpu_id = i // self.layers_per_gpu
            layer.to(f'cuda:{gpu_id}')
        
        return self.model
    
    def forward(self, x):
        """Forward pass across multiple GPUs."""
        for i, layer in enumerate(self.model.layers):
            gpu_id = i // self.layers_per_gpu
            x = x.to(f'cuda:{gpu_id}')
            x = layer(x)
        
        return x

# Offloading to CPU
class CPUOffloader:
    """Offload model parameters to CPU when not in use."""
    
    def __init__(self, model):
        self.model = model
        self.cpu_state_dict = {}
    
    def offload(self, layer_names: list):
        """Move specified layers to CPU."""
        for name in layer_names:
            layer = dict(self.model.named_modules())[name]
            self.cpu_state_dict[name] = layer.state_dict()
            layer.to('cpu')
        
        torch.cuda.empty_cache()
    
    def load(self, layer_name: str, device: str = 'cuda'):
        """Load a layer back to GPU."""
        layer = dict(self.model.named_modules())[layer_name]
        layer.load_state_dict(self.cpu_state_dict[layer_name])
        layer.to(device)
```

## 5. Async I/O Optimization

### Async Data Loading
```python
# src/io/async_loader.py
import asyncio
import aiofiles
import aiohttp
from typing import AsyncIterator, List
import aioboto3

class AsyncDataLoader:
    """Asynchronous data loading for inference pipeline."""
    
    def __init__(self, max_concurrent: int = 10):
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.session = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(
                limit=100,
                limit_per_host=30,
                ttl_dns_cache=300,
                use_dns_cache=True
            ),
            timeout=aiohttp.ClientTimeout(total=30)
        )
        return self
    
    async def __aexit__(self, *args):
        await self.session.close()
    
    async def fetch_url(self, url: str) -> bytes:
        """Fetch data from URL asynchronously."""
        async with self.semaphore:
            async with self.session.get(url) as response:
                return await response.read()
    
    async def fetch_batch(self, urls: List[str]) -> List[bytes]:
        """Fetch multiple URLs concurrently."""
        tasks = [self.fetch_url(url) for url in urls]
        return await asyncio.gather(*tasks, return_exceptions=True)
    
    async def stream_from_s3(
        self,
        bucket: str,
        prefix: str
    ) -> AsyncIterator[bytes]:
        """Stream data from S3 asynchronously."""
        session = aioboto3.Session()
        
        async with session.client('s3') as s3:
            paginator = s3.get_paginator('list_objects_v2')
            
            async for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
                tasks = []
                for obj in page.get('Contents', []):
                    task = self._download_s3_object(s3, bucket, obj['Key'])
                    tasks.append(task)
                
                results = await asyncio.gather(*tasks)
                for data in results:
                    yield data
    
    async def _download_s3_object(self, s3, bucket: str, key: str) -> bytes:
        """Download single S3 object."""
        async with self.semaphore:
            response = await s3.get_object(Bucket=bucket, Key=key)
            async with response['Body'] as stream:
                return await stream.read()

# Async inference server
class AsyncInferenceServer:
    """High-performance async inference server."""
    
    def __init__(self, model, batch_size: int = 32):
        self.model = model
        self.batch_size = batch_size
        self.request_queue = asyncio.Queue()
        self.results = {}
    
    async def start(self):
        """Start the inference server."""
        workers = [
            asyncio.create_task(self._inference_worker())
            for _ in range(4)
        ]
        await asyncio.gather(*workers)
    
    async def _inference_worker(self):
        """Worker that processes batches."""
        while True:
            batch = []
            request_ids = []
            
            # Collect batch
            try:
                while len(batch) < self.batch_size:
                    req_id, data = await asyncio.wait_for(
                        self.request_queue.get(),
                        timeout=0.01
                    )
                    batch.append(data)
                    request_ids.append(req_id)
            except asyncio.TimeoutError:
                pass
            
            if batch:
                # Run inference
                results = await self._run_inference(batch)
                
                # Store results
                for req_id, result in zip(request_ids, results):
                    self.results[req_id] = result
    
    async def _run_inference(self, batch: List) -> List:
        """Run inference on batch."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.model(batch)
        )
    
    async def predict(self, data) -> Any:
        """Submit prediction request."""
        req_id = id(data)
        await self.request_queue.put((req_id, data))
        
        # Wait for result
        while req_id not in self.results:
            await asyncio.sleep(0.001)
        
        return self.results.pop(req_id)
```

## Benchmarking Tools

```python
# benchmarks/gpu_benchmark.py
import torch
import time
import numpy as np

def benchmark_gpu():
    """Benchmark GPU performance."""
    device = torch.device('cuda')
    
    # Matrix multiplication benchmark
    sizes = [512, 1024, 2048, 4096]
    
    print("GPU Benchmark Results:")
    print("-" * 50)
    
    for size in sizes:
        a = torch.randn(size, size, device=device)
        b = torch.randn(size, size, device=device)
        
        # Warmup
        for _ in range(10):
            torch.matmul(a, b)
        
        torch.cuda.synchronize()
        
        # Benchmark
        times = []
        for _ in range(100):
            start = time.time()
            torch.matmul(a, b)
            torch.cuda.synchronize()
            times.append(time.time() - start)
        
        avg_time = np.mean(times) * 1000
        flops = (2 * size**3) / (avg_time / 1000) / 1e12  # TFLOPS
        
        print(f"Size {size}x{size}: {avg_time:.2f}ms, {flops:.2f} TFLOPS")
    
    # Memory bandwidth
    size = 1024 * 1024 * 256  # 1GB
    x = torch.randn(size, device=device)
    
    torch.cuda.synchronize()
    start = time.time()
    y = x.clone()
    torch.cuda.synchronize()
    elapsed = time.time() - start
    
    bandwidth = (size * 4 * 2) / elapsed / 1e9  # GB/s
    print(f"\nMemory Bandwidth: {bandwidth:.2f} GB/s")

if __name__ == '__main__':
    benchmark_gpu()
```
