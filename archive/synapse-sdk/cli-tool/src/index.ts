#!/usr/bin/env node
/**
 * Synapse CLI Tool
 * API key management, usage monitoring, model testing, deployment helpers
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createSynapseClient, SynapseSDK } from '@synapse-ai/sdk';
import Table from 'cli-table3';
import { execSync } from 'child_process';

const CONFIG_DIR = path.join(os.homedir(), '.synapse');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const VERSION = '1.0.0';

// ============= CONFIG MANAGEMENT =============

interface Config {
  defaultKey?: string;
  keys: Record<string, { name: string; key: string; createdAt: string }>;
  settings: {
    defaultModel: string;
    temperature: number;
    maxTokens: number;
  };
}

async function loadConfig(): Promise<Config> {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { keys: {}, settings: { defaultModel: 'gpt-4', temperature: 0.7, maxTokens: 1000 } };
  }
}

async function saveConfig(config: Config): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

async function getSDK(): Promise<SynapseSDK> {
  const config = await loadConfig();
  const key = config.defaultKey ? config.keys[config.defaultKey]?.key : undefined;
  
  if (!key) {
    console.error(chalk.red('Error: No API key configured. Run: synapse auth add'));
    process.exit(1);
  }
  
  return createSynapseClient({ apiKey: key });
}

// ============= COMMANDS =============

const program = new Command();

program
  .name('synapse')
  .description('Synapse AI CLI Tool')
  .version(VERSION);

// Auth commands
const authCmd = program.command('auth').description('Manage API keys');

authCmd
  .command('add')
  .description('Add a new API key')
  .argument('[name]', 'Name for the API key')
  .option('-k, --key <key>', 'API key')
  .action(async (name, options) => {
    const config = await loadConfig();
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Key name:',
        default: name || 'default',
        when: !name,
      },
      {
        type: 'password',
        name: 'key',
        message: 'API key:',
        mask: '*',
        when: !options.key,
      },
    ]);
    
    const keyName = name || answers.name;
    const apiKey = options.key || answers.key;
    
    config.keys[keyName] = {
      name: keyName,
      key: apiKey,
      createdAt: new Date().toISOString(),
    };
    
    if (!config.defaultKey) {
      config.defaultKey = keyName;
    }
    
    await saveConfig(config);
    console.log(chalk.green(`✓ API key '${keyName}' added successfully`));
    
    if (!config.defaultKey || config.defaultKey === keyName) {
      console.log(chalk.gray(`  Set as default key`));
    }
  });

authCmd
  .command('list')
  .description('List configured API keys')
  .action(async () => {
    const config = await loadConfig();
    const keys = Object.values(config.keys);
    
    if (keys.length === 0) {
      console.log(chalk.yellow('No API keys configured'));
      return;
    }
    
    const table = new Table({
      head: [chalk.bold('Name'), chalk.bold('Default'), chalk.bold('Created')],
    });
    
    keys.forEach((k) => {
      table.push([
        k.name,
        k.name === config.defaultKey ? chalk.green('✓') : '',
        new Date(k.createdAt).toLocaleDateString(),
      ]);
    });
    
    console.log(table.toString());
  });

authCmd
  .command('use')
  .description('Set default API key')
  .argument('<name>', 'Name of the key to use')
  .action(async (name) => {
    const config = await loadConfig();
    
    if (!config.keys[name]) {
      console.error(chalk.red(`Error: Key '${name}' not found`));
      process.exit(1);
    }
    
    config.defaultKey = name;
    await saveConfig(config);
    console.log(chalk.green(`✓ Default key set to '${name}'`));
  });

authCmd
  .command('remove')
  .description('Remove an API key')
  .argument('<name>', 'Name of the key to remove')
  .action(async (name) => {
    const config = await loadConfig();
    
    if (!config.keys[name]) {
      console.error(chalk.red(`Error: Key '${name}' not found`));
      process.exit(1);
    }
    
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: `Remove key '${name}'?`,
      default: false,
    }]);
    
    if (confirm) {
      delete config.keys[name];
      if (config.defaultKey === name) {
        config.defaultKey = Object.keys(config.keys)[0] || undefined;
      }
      await saveConfig(config);
      console.log(chalk.green(`✓ Key '${name}' removed`));
    }
  });

// Models commands
const modelsCmd = program.command('models').description('Manage AI models');

modelsCmd
  .command('list')
  .description('List available models')
  .option('-f, --filter <filter>', 'Filter by provider or capability')
  .action(async (options) => {
    const spinner = ora('Loading models...').start();
    
    try {
      const sdk = await getSDK();
      const models = await sdk.listModels();
      spinner.stop();
      
      let filtered = models;
      if (options.filter) {
        const f = options.filter.toLowerCase();
        filtered = models.filter(
          (m) =>
            m.provider.toLowerCase().includes(f) ||
            m.capabilities.some((c) => c.toLowerCase().includes(f))
        );
      }
      
      const table = new Table({
        head: [chalk.bold('Model'), chalk.bold('Provider'), chalk.bold('Context'), chalk.bold('Status')],
      });
      
      filtered.forEach((m) => {
        const statusColor = m.status === 'active' ? chalk.green : m.status === 'beta' ? chalk.yellow : chalk.gray;
        table.push([
          m.id,
          m.provider,
          m.contextWindow.toLocaleString(),
          statusColor(m.status),
        ]);
      });
      
      console.log(table.toString());
      console.log(chalk.gray(`\n${filtered.length} models shown`));
    } catch (error) {
      spinner.stop();
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

modelsCmd
  .command('info')
  .description('Get model information')
  .argument('<model>', 'Model ID')
  .action(async (modelId) => {
    const spinner = ora('Loading model info...').start();
    
    try {
      const sdk = await getSDK();
      const model = await sdk.getModel(modelId);
      spinner.stop();
      
      console.log(chalk.bold(`\n${model.name} (${model.id})\n`));
      console.log(`Provider: ${model.provider}`);
      console.log(`Status: ${model.status}`);
      console.log(`Context Window: ${model.contextWindow.toLocaleString()} tokens`);
      console.log(`Capabilities: ${model.capabilities.join(', ')}`);
      console.log('\nPricing:');
      console.log(`  Input: $${model.pricing.input}/1K tokens`);
      console.log(`  Output: $${model.pricing.output}/1K tokens`);
    } catch (error) {
      spinner.stop();
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

modelsCmd
  .command('test')
  .description('Test a model')
  .argument('[model]', 'Model ID (default: gpt-4)')
  .option('-p, --prompt <prompt>', 'Test prompt')
  .option('-t, --temperature <temp>', 'Temperature', '0.7')
  .option('--stream', 'Stream output', false)
  .action(async (modelId, options) => {
    const config = await loadConfig();
    modelId = modelId || config.settings.defaultModel;
    
    let prompt = options.prompt;
    if (!prompt) {
      const answer = await inquirer.prompt([{
        type: 'input',
        name: 'prompt',
        message: 'Test prompt:',
        default: 'Explain the concept of machine learning in one paragraph.',
      }]);
      prompt = answer.prompt;
    }
    
    const spinner = ora(`Testing ${modelId}...`).start();
    
    try {
      const sdk = await getSDK();
      
      if (options.stream) {
        spinner.stop();
        console.log(chalk.bold('\nResponse:\n'));
        
        const stream = sdk.streamChatCompletion({
          model: modelId,
          messages: [{ role: 'user', content: prompt }],
          temperature: parseFloat(options.temperature),
        });
        
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            process.stdout.write(content);
          }
        }
        console.log('\n');
      } else {
        const response = await sdk.chatCompletion({
          model: modelId,
          messages: [{ role: 'user', content: prompt }],
          temperature: parseFloat(options.temperature),
        });
        
        spinner.stop();
        console.log(chalk.bold('\nResponse:\n'));
        console.log(response.choices[0].message.content);
        console.log(chalk.gray(`\nTokens: ${response.usage.totalTokens}`));
      }
    } catch (error) {
      spinner.stop();
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

// Usage commands
const usageCmd = program.command('usage').description('Monitor API usage');

usageCmd
  .command('show')
  .description('Show usage statistics')
  .option('-d, --days <days>', 'Number of days', '30')
  .action(async (options) => {
    const spinner = ora('Loading usage data...').start();
    
    try {
      const sdk = await getSDK();
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(options.days));
      
      const usage = await sdk.getUsage(startDate, endDate);
      spinner.stop();
      
      console.log(chalk.bold(`\nUsage Statistics (${options.days} days)\n`));
      console.log(`Total Requests: ${usage.totalRequests.toLocaleString()}`);
      console.log(`Total Tokens: ${usage.totalTokens.toLocaleString()}`);
      console.log(`Total Cost: $${usage.cost.toFixed(2)}`);
      
      if (Object.keys(usage.models).length > 0) {
        console.log(chalk.bold('\nBy Model:'));
        const table = new Table({
          head: [chalk.bold('Model'), chalk.bold('Requests'), chalk.bold('Tokens'), chalk.bold('Cost')],
        });
        
        Object.entries(usage.models).forEach(([model, stats]) => {
          table.push([
            model,
            stats.requests.toLocaleString(),
            stats.tokens.toLocaleString(),
            `$${stats.cost.toFixed(2)}`,
          ]);
        });
        
        console.log(table.toString());
      }
    } catch (error) {
      spinner.stop();
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

// Chat command
program
  .command('chat')
  .description('Start an interactive chat session')
  .argument('[model]', 'Model ID (default: gpt-4)')
  .option('-s, --system <prompt>', 'System prompt')
  .option('-t, --temperature <temp>', 'Temperature', '0.7')
  .action(async (modelId, options) => {
    const config = await loadConfig();
    modelId = modelId || config.settings.defaultModel;
    
    console.log(chalk.bold(`\nSynapse Chat (${modelId})`));
    console.log(chalk.gray('Type "exit" or press Ctrl+C to quit\n'));
    
    const sdk = await getSDK();
    const messages: any[] = [];
    
    if (options.system) {
      messages.push({ role: 'system', content: options.system });
    }
    
    while (true) {
      const { input } = await inquirer.prompt([{
        type: 'input',
        name: 'input',
        message: chalk.blue('You:'),
      }]);
      
      if (input.toLowerCase() === 'exit') {
        console.log(chalk.gray('\nGoodbye!'));
        break;
      }
      
      messages.push({ role: 'user', content: input });
      
      const spinner = ora('Thinking...').start();
      
      try {
        const response = await sdk.chatCompletion({
          model: modelId,
          messages,
          temperature: parseFloat(options.temperature),
        });
        
        spinner.stop();
        const reply = response.choices[0].message.content;
        console.log(chalk.green('Assistant:'), reply);
        console.log(chalk.gray(`  (${response.usage.totalTokens} tokens)\n`));
        
        messages.push({ role: 'assistant', content: reply });
      } catch (error) {
        spinner.stop();
        console.error(chalk.red(`Error: ${error}`));
      }
    }
  });

// Embed command
program
  .command('embed')
  .description('Create embeddings')
  .argument('<text>', 'Text to embed')
  .option('-m, --model <model>', 'Embedding model', 'text-embedding-3-small')
  .action(async (text, options) => {
    const spinner = ora('Creating embedding...').start();
    
    try {
      const sdk = await getSDK();
      const response = await sdk.createEmbedding({
        model: options.model,
        input: text,
      });
      
      spinner.stop();
      console.log(chalk.green('✓ Embedding created'));
      console.log(`Dimensions: ${response.data[0].embedding.length}`);
      console.log(`Tokens: ${response.usage.totalTokens}`);
    } catch (error) {
      spinner.stop();
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

// Deploy commands
const deployCmd = program.command('deploy').description('Deployment helpers');

deployCmd
  .command('init')
  .description('Initialize a new Synapse project')
  .argument('[name]', 'Project name')
  .action(async (name) => {
    const projectName = name || 'synapse-project';
    
    const { framework, language } = await inquirer.prompt([
      {
        type: 'list',
        name: 'framework',
        message: 'Choose framework:',
        choices: ['Next.js', 'Express', 'FastAPI', 'Flask', 'Other'],
      },
      {
        type: 'list',
        name: 'language',
        message: 'Choose language:',
        choices: ['TypeScript', 'JavaScript', 'Python'],
        when: (answers) => ['Next.js', 'Express'].includes(answers.framework),
      },
    ]);
    
    const spinner = ora('Creating project...').start();
    
    try {
      await fs.mkdir(projectName, { recursive: true });
      
      // Create basic structure
      const files: Record<string, string> = {
        '.env.example': 'SYNAPSE_API_KEY=your-api-key\n',
        '.gitignore': 'node_modules/\n__pycache__/\n.env\n',
        'README.md': `# ${projectName}\n\nSynapse AI powered project.\n`,
      };
      
      if (language === 'TypeScript' || framework === 'Next.js') {
        files['package.json'] = JSON.stringify({
          name: projectName,
          version: '1.0.0',
          dependencies: { '@synapse-ai/sdk': '^1.0.0' },
          devDependencies: { typescript: '^5.0.0', '@types/node': '^20.0.0' },
        }, null, 2);
      } else if (language === 'Python' || framework === 'FastAPI' || framework === 'Flask') {
        files['requirements.txt'] = 'synapse-ai-sdk\n';
        files['pyproject.toml'] = '[build-system]\nrequires = ["setuptools"]\n';
      }
      
      for (const [filename, content] of Object.entries(files)) {
        await fs.writeFile(path.join(projectName, filename), content);
      }
      
      spinner.stop();
      console.log(chalk.green(`✓ Project '${projectName}' created`));
      console.log(chalk.gray(`  cd ${projectName}`));
    } catch (error) {
      spinner.stop();
      console.error(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

deployCmd
  .command('env')
  .description('Generate environment configuration')
  .option('-o, --output <file>', 'Output file', '.env')
  .action(async (options) => {
    const config = await loadConfig();
    
    if (!config.defaultKey) {
      console.error(chalk.red('No API key configured'));
      process.exit(1);
    }
    
    const key = config.keys[config.defaultKey].key;
    const envContent = `# Synapse AI Configuration
SYNAPSE_API_KEY=${key}
SYNAPSE_BASE_URL=https://api.synapse.ai/v1
SYNAPSE_DEFAULT_MODEL=${config.settings.defaultModel}
`;
    
    await fs.writeFile(options.output, envContent);
    console.log(chalk.green(`✓ Environment file created: ${options.output}`));
  });

// Run the CLI
program.parse();