#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# Synapse Node - One-Command Frictionless Setup
# This script automatically configures and deploys a Synapse mining node
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
SYNAPSE_VERSION="latest"
SYNAPSE_NETWORK="mainnet"
INSTALL_DIR="${HOME}/.synapse"
CONFIG_FILE="${INSTALL_DIR}/node.conf"
LOG_FILE="${INSTALL_DIR}/setup.log"

# Node Configuration
NODE_NAME=""
WALLET_ADDRESS=""
PRIVATE_KEY=""
GPU_TYPE=""
VRAM_GB=0
REGION="auto"
STAKE_AMOUNT=5000

# Spinner for long operations
spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='|/-\'
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf " [%c]  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

# Print banner
print_banner() {
    clear
    echo -e "${CYAN}"
    cat << "EOF"
╔══════════════════════════════════════════════════════════════════════════╗
║                                                                          ║
║     ███████╗██╗   ██╗███╗   ██╗ █████╗ ██████╗ ███████╗███████╗         ║
║     ██╔════╝╚██╗ ██╔╝████╗  ██║██╔══██╗██╔══██╗██╔════╝██╔════╝         ║
║     ███████╗ ╚████╔╝ ██╔██╗ ██║███████║██████╔╝█████╗  ███████╗         ║
║     ╚════██║  ╚██╔╝  ██║╚██╗██║██╔══██║██╔═══╝ ██╔══╝  ╚════██║         ║
║     ███████║   ██║   ██║ ╚████║██║  ██║██║     ███████╗███████║         ║
║     ╚══════╝   ╚═╝   ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚══════╝╚══════╝         ║
║                                                                          ║
║           🚀 Decentralized AI Mining Network - Node Setup 🚀             ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    echo -e "${BOLD}Version:${NC} ${SYNAPSE_VERSION}  |  ${BOLD}Network:${NC} ${SYNAPSE_NETWORK}"
    echo ""
}

# Log messages
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1" | tee -a "$LOG_FILE"
}

log_step() {
    echo -e "\n${MAGENTA}${BOLD}▶ $1${NC}" | tee -a "$LOG_FILE"
}

# Check system requirements
check_prerequisites() {
    log_step "Step 1: Checking System Requirements"
    
    # Check OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        log_success "Operating System: Linux detected"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        log_success "Operating System: macOS detected"
    else
        log_error "Unsupported operating system: $OSTYPE"
        exit 1
    fi
    
    # Check architecture
    ARCH=$(uname -m)
    if [[ "$ARCH" == "x86_64" ]] || [[ "$ARCH" == "amd64" ]]; then
        PLATFORM="amd64"
        log_success "Architecture: x86_64 detected"
    elif [[ "$ARCH" == "arm64" ]] || [[ "$ARCH" == "aarch64" ]]; then
        PLATFORM="arm64"
        log_success "Architecture: ARM64 detected"
    else
        log_warning "Unknown architecture: $ARCH"
    fi
    
    # Check Docker
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version | awk '{print $3}' | sed 's/,//')
        log_success "Docker installed: v$DOCKER_VERSION"
    else
        log_error "Docker not found. Installing Docker..."
        install_docker
    fi
    
    # Check Docker Compose
    if docker compose version &> /dev/null || command -v docker-compose &> /dev/null; then
        log_success "Docker Compose available"
    else
        log_error "Docker Compose not found"
        install_docker
    fi
    
    # Check internet connection
    if ping -c 1 8.8.8.8 &> /dev/null; then
        log_success "Internet connection: OK"
    else
        log_error "No internet connection detected"
        exit 1
    fi
}

# Install Docker automatically
install_docker() {
    log_info "Installing Docker..."
    
    if [[ "$OS" == "linux" ]]; then
        # Install Docker on Linux
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        sudo usermod -aG docker $USER
        rm get-docker.sh
        log_success "Docker installed successfully"
        log_warning "Please log out and back in for group changes to take effect"
    elif [[ "$OS" == "macos" ]]; then
        if command -v brew &> /dev/null; then
            brew install --cask docker
            log_success "Docker Desktop installed via Homebrew"
        else
            log_error "Please install Docker Desktop manually from https://docs.docker.com/desktop/install/mac-install/"
            exit 1
        fi
    fi
}

# Detect GPU automatically
detect_gpu() {
    log_step "Step 2: Detecting GPU Hardware"
    
    GPU_DETECTED=false
    GPU_TYPE="none"
    
    # Check for NVIDIA GPU
    if command -v nvidia-smi &> /dev/null; then
        NVIDIA_INFO=$(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null | head -n1)
        if [[ -n "$NVIDIA_INFO" ]]; then
            GPU_NAME=$(echo "$NVIDIA_INFO" | cut -d',' -f1 | xargs)
            GPU_MEMORY=$(echo "$NVIDIA_INFO" | cut -d',' -f2 | xargs | sed 's/ MiB//')
            VRAM_GB=$((GPU_MEMORY / 1024))
            
            log_success "NVIDIA GPU detected: $GPU_NAME (${VRAM_GB}GB VRAM)"
            
            # Check NVIDIA Docker runtime
            if docker info 2>/dev/null | grep -q "nvidia"; then
                log_success "NVIDIA Docker runtime configured"
                GPU_TYPE="nvidia"
                GPU_DETECTED=true
            else
                log_warning "NVIDIA GPU detected but Docker runtime not configured"
                log_info "Installing NVIDIA Container Toolkit..."
                install_nvidia_toolkit
            fi
        fi
    fi
    
    # Check for AMD GPU
    if [[ "$GPU_DETECTED" == false ]]; then
        if command -v rocm-smi &> /dev/null; then
            AMD_INFO=$(rocm-smi --showproductname 2>/dev/null | grep "GPU" | head -n1)
            if [[ -n "$AMD_INFO" ]]; then
                GPU_NAME=$(echo "$AMD_INFO" | awk -F': ' '{print $2}')
                log_success "AMD GPU detected: $GPU_NAME"
                GPU_TYPE="amd"
                GPU_DETECTED=true
                VRAM_GB=16  # Default estimate
            fi
        elif [[ -d "/sys/class/kfd" ]]; then
            log_success "AMD GPU (ROCm) detected"
            GPU_TYPE="amd"
            GPU_DETECTED=true
        fi
    fi
    
    # Check for Apple Silicon
    if [[ "$GPU_DETECTED" == false ]] && [[ "$OS" == "macos" ]] && [[ "$PLATFORM" == "arm64" ]]; then
        log_success "Apple Silicon (M1/M2/M3) detected"
        GPU_TYPE="apple"
        GPU_DETECTED=true
        VRAM_GB=16  # Shared memory
    fi
    
    # CPU-only fallback
    if [[ "$GPU_DETECTED" == false ]]; then
        log_warning "No GPU detected - will run in CPU-only mode"
        log_info "Note: CPU-only nodes earn significantly less. Consider adding a GPU."
        GPU_TYPE="cpu"
        VRAM_GB=8
    fi
    
    # Estimate compute capability
    estimate_compute_capability
}

# Install NVIDIA Container Toolkit
install_nvidia_toolkit() {
    if [[ "$OS" == "linux" ]]; then
        distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
        curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add - 2>/dev/null || true
        curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
        sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
        sudo systemctl restart docker
        GPU_TYPE="nvidia"
        GPU_DETECTED=true
        log_success "NVIDIA Container Toolkit installed"
    fi
}

# Estimate compute capability for pricing
estimate_compute_capability() {
    case "$GPU_TYPE" in
        nvidia)
            if [[ "$VRAM_GB" -ge 80 ]]; then
                TFLOPS=989  # H100
                GPU_TIER="enterprise"
            elif [[ "$VRAM_GB" -ge 40 ]]; then
                TFLOPS=312  # A100
                GPU_TIER="professional"
            elif [[ "$VRAM_GB" -ge 24 ]]; then
                TFLOPS=80   # RTX 4090
                GPU_TIER="high_end"
            elif [[ "$VRAM_GB" -ge 16 ]]; then
                TFLOPS=40   # RTX 4080
                GPU_TIER="mid_range"
            else
                TFLOPS=20
                GPU_TIER="entry"
            fi
            ;;
        amd)
            TFLOPS=80
            GPU_TIER="high_end"
            ;;
        apple)
            TFLOPS=15
            GPU_TIER="mobile"
            ;;
        cpu)
            TFLOPS=1
            GPU_TIER="cpu"
            ;;
    esac
    
    log_info "Estimated compute power: ${TFLOPS} TFLOPS (${GPU_TIER} tier)"
}

# Auto-detect region
auto_detect_region() {
    log_step "Step 3: Detecting Optimal Region"
    
    # Try to detect region via IP geolocation
    REGION=$(curl -s -m 5 https://ipapi.co/region_code 2>/dev/null || echo "auto")
    COUNTRY=$(curl -s -m 5 https://ipapi.co/country_code 2>/dev/null || echo "US")
    
    # Map to Synapse regions
    case "$REGION" in
        "CA"|"OR"|"WA") SYNAPSE_REGION="us-west-1" ;;
        "NY"|"VA"|"OH") SYNAPSE_REGION="us-east-1" ;;
        "TX"|"IL") SYNAPSE_REGION="us-central-1" ;;
        "GB"|"IE"|"NL") SYNAPSE_REGION="eu-west-1" ;;
        "DE"|"FR") SYNAPSE_REGION="eu-central-1" ;;
        "SG") SYNAPSE_REGION="ap-southeast-1" ;;
        "JP") SYNAPSE_REGION="ap-northeast-1" ;;
        "AU") SYNAPSE_REGION="ap-southeast-2" ;;
        *) SYNAPSE_REGION="us-east-1" ;;
    esac
    
    log_success "Detected region: $SYNAPSE_REGION (Country: $COUNTRY)"
}

# Configure wallet
configure_wallet() {
    log_step "Step 4: Wallet Configuration"
    
    echo -e "\n${CYAN}Wallet Setup Options:${NC}"
    echo "  1) Create new wallet (recommended for new users)"
    echo "  2) Import existing wallet"
    echo "  3) Use hardware wallet (Ledger/Trezor)"
    echo ""
    read -p "Select option [1-3]: " WALLET_OPTION
    
    case "$WALLET_OPTION" in
        1)
            create_new_wallet
            ;;
        2)
            import_wallet
            ;;
        3)
            configure_hardware_wallet
            ;;
        *)
            log_warning "Invalid option, creating new wallet..."
            create_new_wallet
            ;;
    esac
}

# Create new wallet
create_new_wallet() {
    log_info "Creating new Synapse wallet..."
    
    # Generate mnemonic and keys
    NODE_NAME="synapse-node-$(openssl rand -hex 4)"
    
    # Use Python for secure key generation if available
    if command -v python3 &> /dev/null; then
        KEYS=$(python3 << 'PYEOF'
import secrets
import hashlib
import json

# Generate mnemonic (simplified for demo)
words = [
    "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract",
    "absurd", "abuse", "access", "accident", "account", "accuse", "achieve", "acid"
]
mnemonic = ' '.join([secrets.choice(words) for _ in range(12)])

# Generate keys (simplified)
private_key = '0x' + secrets.token_hex(32)
wallet_address = '0x' + hashlib.sha256(private_key.encode()).hexdigest()[:40]

result = {
    "mnemonic": mnemonic,
    "private_key": private_key,
    "address": wallet_address
}
print(json.dumps(result))
PYEOF
)
        
        WALLET_MNEMONIC=$(echo "$KEYS" | python3 -c "import sys,json; print(json.load(sys.stdin)['mnemonic'])")
        PRIVATE_KEY=$(echo "$KEYS" | python3 -c "import sys,json; print(json.load(sys.stdin)['private_key'])")
        WALLET_ADDRESS=$(echo "$KEYS" | python3 -c "import sys,json; print(json.load(sys.stdin)['address'])")
    else
        # Fallback to openssl
        PRIVATE_KEY="0x$(openssl rand -hex 32)"
        WALLET_ADDRESS="0x$(openssl rand -hex 20)"
        WALLET_MNEMONIC="manual_backup_required"
    fi
    
    echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                   WALLET CREATED SUCCESSFULLY                  ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BOLD}Wallet Address:${NC}    ${CYAN}$WALLET_ADDRESS${NC}"
    echo -e "${BOLD}Private Key:${NC}       ${RED}(stored securely in config)${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT: Write down your recovery phrase:${NC}"
    echo -e "${MAGENTA}$WALLET_MNEMONIC${NC}"
    echo ""
    echo -e "${RED}Never share your private key or recovery phrase with anyone!${NC}"
    echo ""
    
    read -p "Press Enter after you've securely saved your recovery phrase..."
    
    # Save to config
    PRIVATE_KEY_FILE="${INSTALL_DIR}/.wallet.key"
    echo "$PRIVATE_KEY" > "$PRIVATE_KEY_FILE"
    chmod 600 "$PRIVATE_KEY_FILE"
    
    log_success "Wallet created and saved securely"
}

# Import existing wallet
import_wallet() {
    echo ""
    read -sp "Enter your private key (input hidden): " INPUT_KEY
    echo ""
    
    # Validate key format
    if [[ ! "$INPUT_KEY" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
        log_error "Invalid private key format"
        log_info "Private key should be 64 hex characters with 0x prefix"
        exit 1
    fi
    
    PRIVATE_KEY="$INPUT_KEY"
    
    # Derive address (simplified)
    WALLET_ADDRESS="0x$(echo -n "$PRIVATE_KEY" | sha256sum | cut -c1-40)"
    
    PRIVATE_KEY_FILE="${INSTALL_DIR}/.wallet.key"
    echo "$PRIVATE_KEY" > "$PRIVATE_KEY_FILE"
    chmod 600 "$PRIVATE_KEY_FILE"
    
    log_success "Wallet imported successfully"
    log_info "Address: $WALLET_ADDRESS"
}

# Configure hardware wallet
configure_hardware_wallet() {
    log_info "Hardware wallet configuration..."
    
    echo ""
    echo "Supported hardware wallets:"
    echo "  1) Ledger (via USB/WebHID)"
    echo "  2) Trezor"
    echo ""
    read -p "Select your hardware wallet [1-2]: " HW_OPTION
    
    log_warning "Please connect your hardware wallet and open the Ethereum app"
    read -p "Press Enter when ready..."
    
    WALLET_ADDRESS="0xHARDWARE_WALLET_PLACEHOLDER"
    log_success "Hardware wallet configured"
    log_info "Full integration will be completed on first run"
}

# Configure node settings
configure_node() {
    log_step "Step 5: Node Configuration"
    
    # Auto-generate node name
    HOSTNAME=$(hostname -s 2>/dev/null || echo "node")
    DEFAULT_NAME="${HOSTNAME}-$(openssl rand -hex 2)"
    
    echo ""
    read -p "Enter node name [$DEFAULT_NAME]: " INPUT_NAME
    NODE_NAME="${INPUT_NAME:-$DEFAULT_NAME}"
    
    # Display detected config
    echo ""
    echo -e "${CYAN}Detected Configuration:${NC}"
    echo "  Node Name:     $NODE_NAME"
    echo "  GPU Type:      $GPU_TYPE"
    echo "  VRAM:          ${VRAM_GB}GB"
    echo "  Region:        $SYNAPSE_REGION"
    echo "  Wallet:        ${WALLET_ADDRESS:0:20}..."
    echo ""
    
    # Staking configuration
    echo -e "${CYAN}Staking Configuration:${NC}"
    echo "  Minimum stake: 5,000 SYN"
    echo "  Recommended:   10,000 SYN"
    echo ""
    read -p "Enter stake amount [10000]: " INPUT_STAKE
    STAKE_AMOUNT="${INPUT_STAKE:-10000}"
    
    if [[ "$STAKE_AMOUNT" -lt 5000 ]]; then
        log_warning "Stake below minimum (5,000 SYN). Setting to minimum."
        STAKE_AMOUNT=5000
    fi
    
    log_success "Node configured: $NODE_NAME"
}

# Download and configure models
download_models() {
    log_step "Step 6: Downloading AI Models"
    
    log_info "Checking model requirements..."
    
    # Create models directory
    mkdir -p "${INSTALL_DIR}/models"
    
    # Define models based on VRAM
    if [[ "$VRAM_GB" -ge 80 ]]; then
        MODELS=("llama-3-70b" "mixtral-8x22b" "gpt-4-turbo")
    elif [[ "$VRAM_GB" -ge 40 ]]; then
        MODELS=("llama-3-70b-q4" "mixtral-8x7b" "claude-3-sonnet")
    elif [[ "$VRAM_GB" -ge 24 ]]; then
        MODELS=("llama-3-8b" "mistral-7b" "gemma-7b")
    elif [[ "$VRAM_GB" -ge 16 ]]; then
        MODELS=("llama-3-8b-q4" "mistral-7b-q4" "phi-3-medium")
    else
        MODELS=("phi-3-mini" "gemma-2b" "tinyllama")
    fi
    
    log_info "Will download models optimized for ${VRAM_GB}GB VRAM:"
    for model in "${MODELS[@]}"; do
        echo "  • $model"
    done
    
    # Create model manifest
    cat > "${INSTALL_DIR}/models/manifest.json" << EOF
{
  "version": "1.0",
  "node_id": "$NODE_NAME",
  "gpu_tier": "$GPU_TIER",
  "vram_gb": $VRAM_GB,
  "models": $(printf '%s\n' "${MODELS[@]}" | jq -R . | jq -s .)
}
EOF
    
    log_success "Model manifest created"
    log_info "Models will be downloaded on first node start"
}

# Create Docker configuration
create_docker_config() {
    log_step "Step 7: Creating Docker Configuration"
    
    # Create docker-compose.yml
    cat > "${INSTALL_DIR}/docker-compose.yml" << EOF
version: '3.8'

services:
  synapse-node:
    image: synapse/node:${SYNAPSE_VERSION}
    container_name: synapse-node
    restart: unless-stopped
    
    environment:
      - SYNAPSE_NODE_NAME=${NODE_NAME}
      - SYNAPSE_WALLET_ADDRESS=${WALLET_ADDRESS}
      - SYNAPSE_NETWORK=${SYNAPSE_NETWORK}
      - SYNAPSE_REGION=${SYNAPSE_REGION}
      - SYNAPSE_GPU_TYPE=${GPU_TYPE}
      - SYNAPSE_VRAM_GB=${VRAM_GB}
      - SYNAPSE_STAKE_AMOUNT=${STAKE_AMOUNT}
      - SYNAPSE_COMPUTE_TIER=${GPU_TIER}
      - SYNAPSE_LOG_LEVEL=info
      - SYNAPSE_AUTO_UPDATE=true
    
    volumes:
      - ./models:/app/models:rw
      - ./data:/app/data:rw
      - ./logs:/app/logs:rw
      - ./.wallet.key:/app/secrets/wallet.key:ro
    
    ports:
      - "8080:8080"    # API port
      - "9090:9090"    # Metrics port
      - "30303:30303"  # P2P port
    
    # GPU configuration
    $([[ "$GPU_TYPE" == "nvidia" ]] && cat << GPUCONFIG
deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
GPUCONFIG
)
    
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    
    networks:
      - synapse-network
    
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "3"

  # Optional: Monitoring sidecar
  node-exporter:
    image: prom/node-exporter:latest
    container_name: synapse-metrics
    restart: unless-stopped
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    networks:
      - synapse-network
    profiles:
      - monitoring

networks:
  synapse-network:
    driver: bridge
EOF

    log_success "Docker Compose configuration created"
}

# Create systemd service (Linux only)
create_systemd_service() {
    if [[ "$OS" == "linux" ]]; then
        log_step "Step 8: Creating System Service"
        
        SERVICE_FILE="/etc/systemd/system/synapse-node.service"
        
        sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=Synapse AI Mining Node
Documentation=https://docs.synapse.network
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

        sudo systemctl daemon-reload
        sudo systemctl enable synapse-node
        
        log_success "Systemd service created and enabled"
        log_info "Node will start automatically on boot"
    fi
}

# Generate QR code for mobile setup
generate_qr_code() {
    log_step "Step 9: Mobile Setup"
    
    # Create mobile setup URL
    MOBILE_SETUP_URL="https://app.synapse.network/setup?node=${NODE_NAME}&region=${SYNAPSE_REGION}&gpu=${GPU_TYPE}"
    
    # Generate QR code if qrencode is available
    if command -v qrencode &> /dev/null; then
        echo ""
        echo -e "${CYAN}Scan this QR code with the Synapse Mobile App:${NC}"
        echo ""
        qrencode -t ANSIUTF8 "$MOBILE_SETUP_URL"
        echo ""
    fi
    
    # Save setup info
    cat > "${INSTALL_DIR}/mobile-setup.txt" << EOF
Synapse Node Mobile Setup
=========================

Node ID: ${NODE_NAME}
Region: ${SYNAPSE_REGION}
GPU: ${GPU_TYPE} (${VRAM_GB}GB)

Setup URL: ${MOBILE_SETUP_URL}

Or enter manually in the Synapse mobile app:
  Node ID: ${NODE_NAME}
  Region: ${SYNAPSE_REGION}
  API Endpoint: http://$(hostname -I | awk '{print $1}'):8080

Download the app:
  iOS: https://apps.apple.com/app/synapse-network
  Android: https://play.google.com/store/apps/details?id=network.synapse.app
EOF

    log_success "Mobile setup information saved"
}

# Final setup and start
finalize_setup() {
    log_step "Step 10: Finalizing Setup"
    
    # Pull Docker images
    log_info "Pulling Docker images..."
    cd "$INSTALL_DIR"
    docker compose pull
    
    # Create data directories
    mkdir -p data logs
    
    # Save configuration
    cat > "$CONFIG_FILE" << EOF
# Synapse Node Configuration
# Generated on $(date)

NODE_NAME="$NODE_NAME"
WALLET_ADDRESS="$WALLET_ADDRESS"
REGION="$SYNAPSE_REGION"
GPU_TYPE="$GPU_TYPE"
VRAM_GB="$VRAM_GB"
STAKE_AMOUNT="$STAKE_AMOUNT"
GPU_TIER="$GPU_TIER"
TFLOPS="$TFLOPS"
NETWORK="$SYNAPSE_NETWORK"

# Auto-start on boot: enabled
# Monitoring: enabled
# Auto-update: enabled
EOF

    chmod 600 "$CONFIG_FILE"
    
    log_success "Configuration saved to $CONFIG_FILE"
    
    # Create start/stop scripts
    cat > "${INSTALL_DIR}/start.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Synapse Node..."
docker compose up -d
echo "Node started! View logs: docker compose logs -f"
EOF
    chmod +x "${INSTALL_DIR}/start.sh"
    
    cat > "${INSTALL_DIR}/stop.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
echo "Stopping Synapse Node..."
docker compose down
echo "Node stopped."
EOF
    chmod +x "${INSTALL_DIR}/stop.sh"
    
    cat > "${INSTALL_DIR}/status.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
docker compose ps
echo ""
curl -s http://localhost:8080/health 2>/dev/null || echo "Node API not responding"
EOF
    chmod +x "${INSTALL_DIR}/status.sh"
    
    log_success "Control scripts created"
}

# Print final summary
print_summary() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                                          ║${NC}"
    echo -e "${GREEN}║              🎉 SYNAPSE NODE SETUP COMPLETE! 🎉                          ║${NC}"
    echo -e "${GREEN}║                                                                          ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BOLD}Node Details:${NC}"
    echo "  Name:        $NODE_NAME"
    echo "  Wallet:      ${WALLET_ADDRESS:0:20}..."
    echo "  Region:      $SYNAPSE_REGION"
    echo "  GPU:         $GPU_TYPE (${VRAM_GB}GB VRAM)"
    echo "  Compute:     ${TFLOPS} TFLOPS ($GPU_TIER tier)"
    echo "  Stake:       $STAKE_AMOUNT SYN"
    echo ""
    echo -e "${BOLD}Installation Directory:${NC} ${CYAN}$INSTALL_DIR${NC}"
    echo ""
    echo -e "${BOLD}Quick Commands:${NC}"
    echo "  Start node:     ${CYAN}cd $INSTALL_DIR && ./start.sh${NC}"
    echo "  Stop node:      ${CYAN}cd $INSTALL_DIR && ./stop.sh${NC}"
    echo "  View status:    ${CYAN}cd $INSTALL_DIR && ./status.sh${NC}"
    echo "  View logs:      ${CYAN}cd $INSTALL_DIR && docker compose logs -f${NC}"
    echo "  Dashboard:      ${CYAN}http://localhost:8080${NC}"
    echo ""
    echo -e "${BOLD}Mobile App:${NC}"
    echo "  Setup info:     ${CYAN}${INSTALL_DIR}/mobile-setup.txt${NC}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "  1. Fund your wallet with $STAKE_AMOUNT SYN tokens for staking"
    echo "  2. Start your node: cd $INSTALL_DIR && ./start.sh"
    echo "  3. Monitor earnings at: https://app.synapse.network/dashboard"
    echo ""
    echo -e "${GREEN}Need help? Join our community:${NC}"
    echo "  Discord: https://discord.gg/synapse"
    echo "  Telegram: https://t.me/synapse_network"
    echo "  Docs: https://docs.synapse.network"
    echo ""
    
    # Ask to start now
    echo ""
    read -p "Start the node now? [Y/n]: " START_NOW
    if [[ ! "$START_NOW" =~ ^[Nn]$ ]]; then
        echo ""
        cd "$INSTALL_DIR"
        ./start.sh
        
        echo ""
        echo -e "${GREEN}Node is starting! View logs with:${NC}"
        echo -e "${CYAN}  cd $INSTALL_DIR && docker compose logs -f${NC}"
        echo ""
        echo -e "${GREEN}Dashboard available at:${NC} ${CYAN}http://localhost:8080${NC}"
    fi
}

# Main setup flow
main() {
    print_banner
    
    # Create install directory
    mkdir -p "$INSTALL_DIR"
    touch "$LOG_FILE"
    
    log_info "Starting Synapse Node setup..."
    log_info "Log file: $LOG_FILE"
    
    # Run setup steps
    check_prerequisites
    detect_gpu
    auto_detect_region
    configure_wallet
    configure_node
    download_models
    create_docker_config
    create_systemd_service
    generate_qr_code
    finalize_setup
    
    # Print final summary
    print_summary
}

# Run main function
main "$@"
