#!/bin/bash
# emergency-pause.sh - Emergency contract pause procedures

set -e

echo "═══════════════════════════════════════════════════════════"
echo "              🚨 EMERGENCY PAUSE PROCEDURE 🚨"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Load environment
if [ -f ".env" ]; then
    source .env
fi

show_usage() {
    echo "Usage: ./emergency-pause.sh [command]"
    echo ""
    echo "Commands:"
    echo "  pause-all       - Pause all contracts"
    echo "  pause-token     - Pause HSKToken"
    echo "  pause-registry  - Pause JobRegistry"
    echo "  pause-payments  - Pause StreamingPayments"
    echo "  status          - Check pause status of all contracts"
    echo "  unpause-all     - Unpause all contracts (requires multisig)"
    echo "  help            - Show this help message"
    echo ""
}

check_pause_status() {
    local contract=$1
    local address=$2
    
    echo "Checking $contract ($address)..."
    # This would use cast or hardhat to check paused status
    echo "  Status: [Would query contract here]"
}

pause_contract() {
    local contract=$1
    local address=$2
    
    echo "🚨 PAUSING $contract ($address)..."
    echo "This action requires multisig approval."
    echo ""
    echo "To execute, create a multisig transaction:"
    echo "  Contract: $address"
    echo "  Function: pause()"
    echo "  Data: 0x8456cb59"
    echo ""
}

unpause_contract() {
    local contract=$1
    local address=$2
    
    echo "▶️  UNPAUSING $contract ($address)..."
    echo "This action requires multisig approval."
    echo ""
    echo "To execute, create a multisig transaction:"
    echo "  Contract: $address"
    echo "  Function: unpause()"
    echo "  Data: 0x3f4ba83a"
    echo ""
}

case "${1:-help}" in
    pause-all)
        echo "🚨 INITIATING EMERGENCY PAUSE OF ALL CONTRACTS 🚨"
        echo ""
        read -p "Are you sure? This will halt all operations. (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            echo "Cancelled."
            exit 0
        fi
        
        pause_contract "HSKToken" "$HSK_TOKEN_ADDRESS"
        pause_contract "JobRegistry" "$JOB_REGISTRY_ADDRESS"
        pause_contract "StreamingPayments" "$STREAMING_PAYMENTS_ADDRESS"
        
        echo "✅ Emergency pause procedures initiated."
        echo "Check multisig for pending transactions."
        ;;
        
    pause-token)
        pause_contract "HSKToken" "$HSK_TOKEN_ADDRESS"
        ;;
        
    pause-registry)
        pause_contract "JobRegistry" "$JOB_REGISTRY_ADDRESS"
        ;;
        
    pause-payments)
        pause_contract "StreamingPayments" "$STREAMING_PAYMENTS_ADDRESS"
        ;;
        
    unpause-all)
        echo "▶️  INITIATING UNPAUSE OF ALL CONTRACTS"
        echo ""
        read -p "Has the issue been resolved? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            echo "Cancelled. Please resolve the issue first."
            exit 0
        fi
        
        unpause_contract "HSKToken" "$HSK_TOKEN_ADDRESS"
        unpause_contract "JobRegistry" "$JOB_REGISTRY_ADDRESS"
        unpause_contract "StreamingPayments" "$STREAMING_PAYMENTS_ADDRESS"
        
        echo "✅ Unpause procedures initiated."
        echo "Check multisig for pending transactions."
        ;;
        
    status)
        echo "📊 Checking pause status of all contracts..."
        echo ""
        check_pause_status "HSKToken" "$HSK_TOKEN_ADDRESS"
        check_pause_status "JobRegistry" "$JOB_REGISTRY_ADDRESS"
        check_pause_status "StreamingPayments" "$STREAMING_PAYMENTS_ADDRESS"
        ;;
        
    help|*)
        show_usage
        ;;
esac
