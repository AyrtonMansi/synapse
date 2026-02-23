const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Fuzzing configuration
const CONFIG = {
  iterations: 1000,
  maxInputSize: 4096,
  seed: Date.now(),
  timeout: 30000,
};

// Mutation strategies
const MUTATORS = {
  bitFlip: (buf) => {
    const pos = Math.floor(Math.random() * buf.length);
    const bit = 1 << Math.floor(Math.random() * 8);
    buf[pos] ^= bit;
    return buf;
  },
  
  byteFlip: (buf) => {
    const pos = Math.floor(Math.random() * buf.length);
    buf[pos] = Math.floor(Math.random() * 256);
    return buf;
  },
  
  insertBytes: (buf) => {
    const pos = Math.floor(Math.random() * (buf.length + 1));
    const bytes = Buffer.alloc(Math.floor(Math.random() * 10) + 1);
    return Buffer.concat([buf.slice(0, pos), bytes, buf.slice(pos)]);
  },
  
  deleteBytes: (buf) => {
    if (buf.length === 0) return buf;
    const pos = Math.floor(Math.random() * buf.length);
    const len = Math.floor(Math.random() * 10) + 1;
    return Buffer.concat([buf.slice(0, pos), buf.slice(pos + len)]);
  },
  
  interestingValues: () => {
    const values = [
      Buffer.from([0x00]),
      Buffer.from([0xFF]),
      Buffer.from([0x7F]),
      Buffer.from([0x80]),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]),
      Buffer.from('true'),
      Buffer.from('false'),
      Buffer.from('null'),
      Buffer.from('undefined'),
    ];
    return values[Math.floor(Math.random() * values.length)];
  },
};

class ContractFuzzer {
  constructor(provider, contractABI, contractAddress) {
    this.provider = provider;
    this.contract = new ethers.Contract(contractAddress, contractABI, provider);
    this.corpus = [];
    this.crashes = [];
    this.coverage = new Set();
  }

  // Generate random input based on type
  generateInput(type) {
    switch (type) {
      case 'address':
        return ethers.Wallet.createRandom().address;
      
      case 'uint256':
      case 'uint':
        return ethers.toBigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
      
      case 'int256':
      case 'int':
        return ethers.toBigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) * 
          (Math.random() > 0.5 ? 1 : -1));
      
      case 'bool':
        return Math.random() > 0.5;
      
      case 'bytes32':
        return ethers.randomBytes(32);
      
      case 'bytes':
        const len = Math.floor(Math.random() * CONFIG.maxInputSize);
        return ethers.randomBytes(len);
      
      case 'string':
        const strings = [
          '',
          'a'.repeat(1000),
          '<script>alert(1)</script>',
          "'; DROP TABLE users; --",
          Buffer.from([0x00, 0x00]).toString(),
          '🚀🔥💀',
          ...Array(100).fill(null).map(() => Math.random().toString(36)),
        ];
        return strings[Math.floor(Math.random() * strings.length)];
      
      default:
        if (type.startsWith('uint') || type.startsWith('int')) {
          return ethers.toBigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
        }
        return '0x' + Math.random().toString(16).slice(2);
    }
  }

  // Mutate existing input
  mutate(input) {
    const mutators = Object.values(MUTATORS);
    const mutator = mutators[Math.floor(Math.random() * mutators.length)];
    
    try {
      const buf = Buffer.from(JSON.stringify(input));
      const mutated = mutator(buf);
      return JSON.parse(mutated.toString());
    } catch (e) {
      return input;
    }
  }

  // Get callable functions from ABI
  getCallableFunctions() {
    return this.contract.interface.fragments
      .filter(f => f.type === 'function' && f.stateMutability !== 'view')
      .map(f => ({
        name: f.name,
        inputs: f.inputs.map(i => i.type),
      }));
  }

  // Execute fuzzing iteration
  async fuzzFunction(func, inputs) {
    try {
      const tx = await this.contract[func.name](...inputs, {
        gasLimit: 1000000,
      });
      
      if (tx.wait) {
        const receipt = await tx.wait();
        this.coverage.add(`${func.name}:${receipt.status}`);
        return { success: true, receipt };
      }
      
      return { success: true };
    } catch (error) {
      // Check for interesting errors
      const errorMsg = error.message.toLowerCase();
      
      if (errorMsg.includes('overflow') || 
          errorMsg.includes('underflow') ||
          errorMsg.includes('division by zero') ||
          errorMsg.includes('out of gas') ||
          errorMsg.includes('revert') === false) {
        this.crashes.push({
          function: func.name,
          inputs,
          error: error.message,
          timestamp: Date.now(),
        });
      }
      
      return { success: false, error: error.message };
    }
  }

  // Main fuzzing loop
  async run(iterations = CONFIG.iterations) {
    const functions = this.getCallableFunctions();
    
    console.log(`Starting fuzzing with ${functions.length} functions`);
    console.log(`Target iterations: ${iterations}`);
    
    for (let i = 0; i < iterations; i++) {
      // Select random function
      const func = functions[Math.floor(Math.random() * functions.length)];
      
      // Generate or mutate inputs
      let inputs;
      if (this.corpus.length > 0 && Math.random() > 0.3) {
        const base = this.corpus[Math.floor(Math.random() * this.corpus.length)];
        inputs = this.mutate(base);
      } else {
        inputs = func.inputs.map(type => this.generateInput(type));
      }
      
      // Execute
      const result = await this.fuzzFunction(func, inputs);
      
      // Add to corpus if successful
      if (result.success && Math.random() > 0.7) {
        this.corpus.push(inputs);
      }
      
      // Progress report
      if ((i + 1) % 100 === 0) {
        console.log(`Progress: ${i + 1}/${iterations} | ` +
          `Corpus: ${this.corpus.length} | Crashes: ${this.crashes.length}`);
      }
    }
    
    return this.generateReport();
  }

  // Generate fuzzing report
  generateReport() {
    const report = {
      summary: {
        totalIterations: CONFIG.iterations,
        corpusSize: this.corpus.length,
        crashesFound: this.crashes.length,
        uniqueCrashes: new Set(this.crashes.map(c => c.error)).size,
        coverage: this.coverage.size,
      },
      crashes: this.crashes,
      coverage: Array.from(this.coverage),
      timestamp: new Date().toISOString(),
    };
    
    // Save report
    const reportPath = path.join(__dirname, '../../reports/fuzzing-report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n=== Fuzzing Report ===');
    console.log(`Iterations: ${report.summary.totalIterations}`);
    console.log(`Corpus Size: ${report.summary.corpusSize}`);
    console.log(`Crashes Found: ${report.summary.crashesFound}`);
    console.log(`Unique Crashes: ${report.summary.uniqueCrashes}`);
    console.log(`Coverage: ${report.summary.coverage}`);
    console.log(`Report saved to: ${reportPath}`);
    
    return report;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const contractAddress = args[0];
  const abiPath = args[1];
  const iterations = parseInt(args[2]) || CONFIG.iterations;
  
  if (!contractAddress || !abiPath) {
    console.log('Usage: node contract-fuzzer.js <contract-address> <abi-path> [iterations]');
    process.exit(1);
  }
  
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://localhost:8545');
  const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  
  const fuzzer = new ContractFuzzer(provider, abi, contractAddress);
  const report = await fuzzer.run(iterations);
  
  if (report.summary.crashesFound > 0) {
    console.log('\n⚠️  Crashes detected! Review the report for details.');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { ContractFuzzer, MUTATORS, CONFIG };
