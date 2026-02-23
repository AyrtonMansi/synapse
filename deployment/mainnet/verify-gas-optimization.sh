#!/bin/bash
# verify-gas-optimization.sh - Verify contracts are gas optimized

set -e

echo "═══════════════════════════════════════════════════════════"
echo "         GAS OPTIMIZATION VERIFICATION"
echo "═══════════════════════════════════════════════════════════"
echo ""

cd ../../synapse-contracts

# Compile with optimization report
echo "🔧 Compiling contracts with optimization..."
npx hardhat compile --force

echo ""
echo "📊 Gas Optimization Report"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check compiler settings
echo "✅ Compiler Settings:"
cat hardhat.config.cjs | grep -A 10 "solidity:"

echo ""
echo "📈 Contract Size Analysis:"
echo "═══════════════════════════════════════════════════════════"

# Get contract sizes
cat artifacts/build-info/*.json | jq -r '.output.contracts | 
  to_entries[] | 
  .value | 
  to_entries[] | 
  select(.value.evm.bytecode.object != null and .value.evm.bytecode.object != "0x") |
  [.key, (.value.evm.bytecode.object | length / 2)] |
  @tsv' 2>/dev/null | sort -k2 -n | awk '
  BEGIN {
    print "Contract\t\t\t\tSize (bytes)\tStatus"
    print "────────────────────────────────────────────────────────────"
  }
  {
    size = $2
    status = (size > 24576) ? "❌ TOO LARGE" : (size > 20000) ? "⚠️  WARNING" : "✅ OK"
    printf "%-30s\t%d\t\t%s\n", $1, size, status
  }'

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Note: Maximum contract size is 24,576 bytes (EIP-170)"
echo "═══════════════════════════════════════════════════════════"
