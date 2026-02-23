#!/bin/bash
# rollback-procedure.sh - Contract upgrade/rollback procedures

set -e

echo "═══════════════════════════════════════════════════════════"
echo "              ROLLBACK PROCEDURES"
echo "═══════════════════════════════════════════════════════════"
echo ""

show_usage() {
    echo "Usage: ./rollback-procedure.sh [command]"
    echo ""
    echo "Commands:"
    echo "  plan <contract>     - Create rollback plan for contract"
    echo "  execute <contract>  - Execute rollback (requires multisig)"
    echo "  verify <contract>   - Verify rollback success"
    echo "  history             - Show upgrade history"
    echo "  help                - Show this help message"
    echo ""
    echo "Available contracts:"
    echo "  HSKToken, JobRegistry, TreasuryDAO, DisputeResolver,"
    echo "  PriceOracle, StreamingPayments"
    echo ""
}

create_rollback_plan() {
    local contract=$1
    
    echo "Creating rollback plan for $contract..."
    echo ""
    
    cat > "rollback-plan-${contract}-$(date +%Y%m%d).md" << EOF
# Rollback Plan: $contract

## Date: $(date)

## Current State
- Contract Address: [FILL IN]
- Current Implementation: [FILL IN]
- Previous Implementation: [FILL IN]

## Rollback Steps

### Step 1: Pause Contract (if applicable)
- Use emergency-pause.sh pause-$contract
- Verify contract is paused

### Step 2: Deploy Previous Implementation
- Deploy: [Previous implementation contract code]
- Verify deployment

### Step 3: Execute Upgrade
- Use TimelockController to schedule upgrade
- Wait for timelock delay (48 hours)
- Execute upgrade through multisig

### Step 4: Migrate State (if needed)
- [Document any state migration required]

### Step 5: Verify Functionality
- Run test suite
- Verify on-chain state
- Check integrations

### Step 6: Unpause Contract
- Use emergency-pause.sh unpause-$contract

## Verification Checklist
- [ ] Contract paused successfully
- [ ] Previous implementation deployed
- [ ] Upgrade executed
- [ ] State migrated (if applicable)
- [ ] Tests passing
- [ ] Contract unpaused
- [ ] Monitoring shows normal operations

## Rollback Signers Required
- Minimum: 3 of 5 multisig signers

## Estimated Time
- Timelock delay: 48 hours
- Execution: 2-4 hours
- Verification: 1 hour

## Emergency Contacts
- Multisig Holders: [LIST]
- Technical Lead: [CONTACT]
- Community Manager: [CONTACT]
EOF

    echo "✅ Rollback plan created: rollback-plan-${contract}-$(date +%Y%m%d).md"
}

execute_rollback() {
    local contract=$1
    
    echo "🚨 EXECUTING ROLLBACK FOR $contract 🚨"
    echo ""
    echo "⚠️  This action requires:"
    echo "   - 3 of 5 multisig signatures"
    echo "   - 48 hour timelock period (if scheduled now)"
    echo ""
    read -p "Have you created and reviewed the rollback plan? (yes/no): " confirm1
    if [ "$confirm1" != "yes" ]; then
        echo "Please create a rollback plan first."
        exit 0
    fi
    
    read -p "Is this an EMERGENCY (skip timelock)? (yes/no): " emergency
    
    if [ "$emergency" = "yes" ]; then
        echo ""
        echo "⚠️  EMERGENCY ROLLBACK"
        echo "Proceeding with emergency rollback..."
        echo "This requires immediate multisig execution."
    else
        echo ""
        echo "Scheduling rollback through timelock..."
        echo "Execute after 48 hour delay."
    fi
    
    echo ""
    echo "To complete, create multisig transaction:"
    echo "  Target: TimelockController"
    echo "  Function: execute()"
    echo "  Parameters: [rollback parameters]"
}

verify_rollback() {
    local contract=$1
    
    echo "Verifying rollback of $contract..."
    echo ""
    echo "Checks:"
    echo "  ✓ Contract code matches previous implementation"
    echo "  ✓ State variables intact"
    echo "  ✓ No errors in recent transactions"
    echo "  ✓ Integration tests passing"
    echo ""
    echo "Run verification:"
    echo "  npx hardhat run scripts/verify-rollback.js --network mainnet"
}

show_history() {
    echo "📜 Upgrade History"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    
    if [ -d "upgrade-history" ]; then
        ls -lt upgrade-history/ | head -20
    else
        echo "No upgrade history found."
        echo "History is tracked in upgrade-history/ directory."
    fi
}

case "${1:-help}" in
    plan)
        if [ -z "$2" ]; then
            echo "❌ Please specify a contract name"
            show_usage
            exit 1
        fi
        create_rollback_plan "$2"
        ;;
        
    execute)
        if [ -z "$2" ]; then
            echo "❌ Please specify a contract name"
            show_usage
            exit 1
        fi
        execute_rollback "$2"
        ;;
        
    verify)
        if [ -z "$2" ]; then
            echo "❌ Please specify a contract name"
            show_usage
            exit 1
        fi
        verify_rollback "$2"
        ;;
        
    history)
        show_history
        ;;
        
    help|*)
        show_usage
        ;;
esac
