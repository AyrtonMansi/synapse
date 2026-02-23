# Synapse Node - CUDA-enabled Docker Image
# Multi-stage build for optimized production image

# ============================================================================
# Stage 1: Builder
# ============================================================================
FROM nvidia/cuda:12.1.0-devel-ubuntu22.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install Python and build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 \
    python3-pip \
    python3.10-dev \
    python3-venv \
    git \
    build-essential \
    cmake \
    ninja-build \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python3.10 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip wheel setuptools

# Install PyTorch with CUDA support
RUN pip install --no-cache-dir \
    torch==2.1.2 \
    torchvision \
    torchaudio \
    --index-url https://download.pytorch.org/whl/cu121

# Copy and install requirements first for better caching
COPY pyproject.toml /tmp/
WORKDIR /tmp

# Install Python dependencies
RUN pip install --no-cache-dir \
    vllm==0.2.7 \
    pynvml \
    websockets \
    aiohttp \
    fastapi \
    uvicorn \
    pydantic \
    pydantic-settings \
    click \
    rich \
    psutil \
    prometheus-client \
    structlog \
    python-json-logger \
    pyyaml \
    httpx \
    requests \
    transformers \
    accelerate \
    huggingface-hub \
    web3 \
    eth-account \
    cryptography

# ============================================================================
# Stage 2: Production
# ============================================================================
FROM nvidia/cuda:12.1.0-runtime-ubuntu22.04 AS production

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV NVIDIA_VISIBLE_DEVICES=all
ENV CUDA_MODULE_LOADING=LAZY

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 \
    python3-pip \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Create app directories
RUN mkdir -p /app/models /app/circuits /app/logs /app/config /app/data /app/src

# Copy application code
COPY src/ /app/src/
COPY config/ /app/config/
COPY scripts/ /app/scripts/

# Install the package
WORKDIR /app
RUN pip install --no-cache-dir /app/src

# Create non-root user
RUN useradd -m -u 1000 synapse && \
    chown -R synapse:synapse /app

# Make scripts executable
RUN chmod +x /app/scripts/*.sh

# Expose ports
EXPOSE 8080 9090 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Switch to non-root user
USER synapse

# Set working directory
WORKDIR /app

# Environment variables
ENV SYNAPSE_MODEL_CACHE_DIR=/app/models
ENV SYNAPSE_PROOF_CIRCUIT_PATH=/app/circuits
ENV SYNAPSE_LOG_LEVEL=INFO
ENV HF_HOME=/app/models
ENV TRANSFORMERS_CACHE=/app/models
ENV VLLM_WORKER_MULTIPROC_METHOD=spawn
ENV PYTHONPATH=/app/src

# Entry point
ENTRYPOINT ["synapse-node"]
CMD ["start"]
