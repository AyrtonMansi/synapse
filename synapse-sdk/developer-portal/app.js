/**
 * Synapse Developer Portal App
 * Interactive functionality for API explorer, code generator, and webhook tester
 */

// OpenAPI Spec
const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Synapse AI API',
    version: '1.0.0',
    description: 'Build powerful AI applications with Synapse'
  },
  servers: [{ url: 'https://api.synapse.ai/v1' }],
  paths: {
    '/chat/completions': {
      post: {
        summary: 'Create chat completion',
        operationId: 'createChatCompletion',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['model', 'messages'],
                properties: {
                  model: { type: 'string', example: 'gpt-4' },
                  messages: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        role: { type: 'string', enum: ['system', 'user', 'assistant'] },
                        content: { type: 'string' }
                      }
                    }
                  },
                  temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
                  max_tokens: { type: 'integer', minimum: 1 },
                  stream: { type: 'boolean', default: false }
                }
              }
            }
          }
        }
      }
    },
    '/embeddings': {
      post: {
        summary: 'Create embeddings',
        operationId: 'createEmbedding',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['model', 'input'],
                properties: {
                  model: { type: 'string', example: 'text-embedding-3-small' },
                  input: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
                  encoding_format: { type: 'string', enum: ['float', 'base64'] }
                }
              }
            }
          }
        }
      }
    },
    '/models': {
      get: {
        summary: 'List models',
        operationId: 'listModels'
      }
    }
  }
};

// Code Templates
const codeTemplates = {
  javascript: {
    'chat-completion': (params) => `import { SynapseSDK } from '@synapse-ai/sdk';

const sdk = new SynapseSDK({ apiKey: 'your-api-key' });

const response = await sdk.chatCompletion({
  model: '${params.model}',
  messages: ${JSON.stringify(params.messages, null, 2)},
  temperature: ${params.temperature},
  maxTokens: ${params.maxTokens}
});

console.log(response.choices[0].message.content);`,
    
    'chat-stream': (params) => `import { SynapseSDK } from '@synapse-ai/sdk';

const sdk = new SynapseSDK({ apiKey: 'your-api-key' });

const stream = sdk.streamChatCompletion({
  model: '${params.model}',
  messages: ${JSON.stringify(params.messages, null, 2)},
  temperature: ${params.temperature}
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
  }
}`,
    
    'create-embedding': (params) => `import { SynapseSDK } from '@synapse-ai/sdk';

const sdk = new SynapseSDK({ apiKey: 'your-api-key' });

const response = await sdk.createEmbedding({
  model: '${params.model}',
  input: 'Your text here'
});

console.log(response.data[0].embedding);`,
    
    'list-models': () => `import { SynapseSDK } from '@synapse-ai/sdk';

const sdk = new SynapseSDK({ apiKey: 'your-api-key' });

const models = await sdk.listModels();
console.log(models);`,
    
    'get-model': (params) => `import { SynapseSDK } from '@synapse-ai/sdk';

const sdk = new SynapseSDK({ apiKey: 'your-api-key' });

const model = await sdk.getModel('${params.model}');
console.log(model);`
  },
  
  typescript: {
    'chat-completion': (params) => `import { SynapseSDK, CompletionRequest } from '@synapse-ai/sdk';

const sdk = new SynapseSDK({ apiKey: 'your-api-key' });

const request: CompletionRequest = {
  model: '${params.model}',
  messages: ${JSON.stringify(params.messages, null, 2)},
  temperature: ${params.temperature},
  maxTokens: ${params.maxTokens}
};

const response = await sdk.chatCompletion(request);
console.log(response.choices[0].message.content);`,
    
    'chat-stream': (params) => `import { SynapseSDK } from '@synapse-ai/sdk';

const sdk = new SynapseSDK({ apiKey: 'your-api-key' });

const stream = sdk.streamChatCompletion({
  model: '${params.model}',
  messages: ${JSON.stringify(params.messages, null, 2)},
  temperature: ${params.temperature}
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
  }
}`,
    
    'create-embedding': (params) => `import { SynapseSDK, EmbeddingRequest } from '@synapse-ai/sdk';

const sdk = new SynapseSDK({ apiKey: 'your-api-key' });

const request: EmbeddingRequest = {
  model: '${params.model}',
  input: 'Your text here'
};

const response = await sdk.createEmbedding(request);
console.log(response.data[0].embedding);`,
    
    'list-models': () => `import { SynapseSDK } from '@synapse-ai/sdk';

const sdk = new SynapseSDK({ apiKey: 'your-api-key' });

const models = await sdk.listModels();
console.log(models);`,
    
    'get-model': (params) => `import { SynapseSDK } from '@synapse-ai/sdk';

const sdk = new SynapseSDK({ apiKey: 'your-api-key' });

const model = await sdk.getModel('${params.model}');
console.log(model);`
  },
  
  python: {
    'chat-completion': (params) => `import asyncio
from synapse_sdk import SynapseSDK, CompletionRequest, Message, MessageRole

async def main():
    sdk = SynapseSDK(api_key='your-api-key')
    
    request = CompletionRequest(
        model='${params.model}',
        messages=[
            Message(role=MessageRole(role['role']), content=role['content'])
            for role in ${JSON.stringify(params.messages)}
        ],
        temperature=${params.temperature},
        max_tokens=${params.maxTokens}
    )
    
    response = await sdk.chat_completion(request)
    print(response.choices[0].message.content)
    
    await sdk.close()

asyncio.run(main())`,
    
    'chat-stream': (params) => `import asyncio
from synapse_sdk import SynapseSDK, CompletionRequest, Message, MessageRole

async def main():
    sdk = SynapseSDK(api_key='your-api-key')
    
    request = CompletionRequest(
        model='${params.model}',
        messages=[
            Message(role=MessageRole(role['role']), content=role['content'])
            for role in ${JSON.stringify(params.messages)}
        ],
        temperature=${params.temperature}
    )
    
    async for chunk in sdk.stream_chat_completion(request):
        content = chunk.choices[0].delta.get('content', '')
        if content:
            print(content, end='', flush=True)
    
    await sdk.close()

asyncio.run(main())`,
    
    'create-embedding': (params) => `import asyncio
from synapse_sdk import SynapseSDK, EmbeddingRequest

async def main():
    sdk = SynapseSDK(api_key='your-api-key')
    
    request = EmbeddingRequest(
        model='${params.model}',
        input='Your text here'
    )
    
    response = await sdk.create_embedding(request)
    print(response.data[0].embedding)
    
    await sdk.close()

asyncio.run(main())`,
    
    'list-models': () => `import asyncio
from synapse_sdk import SynapseSDK

async def main():
    sdk = SynapseSDK(api_key='your-api-key')
    
    models = await sdk.list_models()
    print(models)
    
    await sdk.close()

asyncio.run(main())`,
    
    'get-model': (params) => `import asyncio
from synapse_sdk import SynapseSDK

async def main():
    sdk = SynapseSDK(api_key='your-api-key')
    
    model = await sdk.get_model('${params.model}')
    print(model)
    
    await sdk.close()

asyncio.run(main())`
  },
  
  curl: {
    'chat-completion': (params) => `curl https://api.synapse.ai/v1/chat/completions \\
  -H "Authorization: Bearer $SYNAPSE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${params.model}",
    "messages": ${JSON.stringify(params.messages)},
    "temperature": ${params.temperature},
    "max_tokens": ${params.maxTokens}
  }'`,
    
    'chat-stream': (params) => `curl https://api.synapse.ai/v1/chat/completions \\
  -H "Authorization: Bearer $SYNAPSE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${params.model}",
    "messages": ${JSON.stringify(params.messages)},
    "temperature": ${params.temperature},
    "stream": true
  }'`,
    
    'create-embedding': (params) => `curl https://api.synapse.ai/v1/embeddings \\
  -H "Authorization: Bearer $SYNAPSE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${params.model}",
    "input": "Your text here"
  }'`,
    
    'list-models': () => `curl https://api.synapse.ai/v1/models \\
  -H "Authorization: Bearer $SYNAPSE_API_KEY"`,
    
    'get-model': (params) => `curl https://api.synapse.ai/v1/models/${params.model} \\
  -H "Authorization: Bearer $SYNAPSE_API_KEY"`
  },
  
  go: {
    'chat-completion': (params) => `package main

import (
    "context"
    "fmt"
    "log"
    
    "github.com/synapse-ai/sdk-go"
)

func main() {
    client := synapse.NewClient("your-api-key")
    
    resp, err := client.ChatCompletion(context.Background(), synapse.CompletionRequest{
        Model: "${params.model}",
        Messages: []synapse.Message{
            {Role: "user", Content: "Hello!"},
        },
        Temperature: ${params.temperature},
        MaxTokens: ${params.maxTokens},
    })
    if err != nil {
        log.Fatal(err)
    }
    
    fmt.Println(resp.Choices[0].Message.Content)
}`,
    
    'create-embedding': (params) => `package main

import (
    "context"
    "fmt"
    "log"
    
    "github.com/synapse-ai/sdk-go"
)

func main() {
    client := synapse.NewClient("your-api-key")
    
    resp, err := client.CreateEmbedding(context.Background(), synapse.EmbeddingRequest{
        Model: "${params.model}",
        Input: "Your text here",
    })
    if err != nil {
        log.Fatal(err)
    }
    
    fmt.Println(resp.Data[0].Embedding)
}`
  },
  
  rust: {
    'chat-completion': (params) => `use synapse_sdk::SynapseClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = SynapseClient::new("your-api-key");
    
    let response = client
        .chat_completion()
        .model("${params.model}")
        .messages(vec![
            serde_json::json!({
                "role": "user",
                "content": "Hello!"
            })
        ])
        .temperature(${params.temperature})
        .send()
        .await?;
    
    println!("{}", response.choices[0].message.content);
    Ok(())
}`,
    
    'create-embedding': (params) => `use synapse_sdk::SynapseClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = SynapseClient::new("your-api-key");
    
    let response = client
        .create_embedding()
        .model("${params.model}")
        .input("Your text here")
        .send()
        .await?;
    
    println!("{:?}", response.data[0].embedding);
    Ok(())
}`
  }
};

// Initialize Swagger UI
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Swagger
  SwaggerUIBundle({
    spec: openApiSpec,
    dom_id: '#swagger-ui',
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIBundle.presets.standalone
    ],
    layout: 'BaseLayout',
    theme: 'dark'
  });

  // Initialize navigation
  initNavigation();
  
  // Initialize code generator
  initCodeGenerator();
  
  // Initialize webhook tester
  initWebhookTester();
  
  // Initialize modal
  initModal();
  
  // Initialize docs tabs
  initDocsTabs();
});

// Navigation
function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-links a');
  const sections = document.querySelectorAll('.section');
  
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('href').slice(1);
      
      // Update nav active state
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      
      // Update section visibility
      sections.forEach(section => {
        section.classList.remove('active');
        if (section.id === target) {
          section.classList.add('active');
        }
      });
      
      // Scroll to top
      window.scrollTo(0, 0);
    });
  });
}

// Code Generator
function initCodeGenerator() {
  const langSelect = document.getElementById('lang-select');
  const endpointSelect = document.getElementById('endpoint-select');
  const modelSelect = document.getElementById('model-select');
  const temperature = document.getElementById('temperature');
  const maxTokens = document.getElementById('max-tokens');
  const messagesJson = document.getElementById('messages-json');
  const generateBtn = document.getElementById('generate-btn');
  const copyBtn = document.getElementById('copy-btn');
  const codeOutput = document.getElementById('code-output');
  const rangeValue = document.querySelector('.range-value');
  
  // Update range value display
  temperature.addEventListener('input', () => {
    rangeValue.textContent = temperature.value;
  });
  
  // Update model based on endpoint
  endpointSelect.addEventListener('change', () => {
    const endpoint = endpointSelect.value;
    if (endpoint === 'create-embedding') {
      modelSelect.value = 'text-embedding-3-small';
    } else {
      modelSelect.value = 'gpt-4';
    }
  });
  
  // Generate code
  generateBtn.addEventListener('click', () => {
    const lang = langSelect.value;
    const endpoint = endpointSelect.value;
    const model = modelSelect.value;
    
    let messages;
    try {
      messages = JSON.parse(messagesJson.value);
    } catch (e) {
      codeOutput.textContent = `// Error parsing messages JSON: ${e.message}`;
      return;
    }
    
    const params = {
      model,
      messages,
      temperature: parseFloat(temperature.value),
      maxTokens: parseInt(maxTokens.value)
    };
    
    const template = codeTemplates[lang]?.[endpoint];
    if (template) {
      codeOutput.textContent = template(params);
    } else {
      codeOutput.textContent = '// Template not available for this combination';
    }
  });
  
  // Copy code
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(codeOutput.textContent);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyBtn.textContent = 'Copy';
    }, 2000);
  });
}

// Webhook Tester
function initWebhookTester() {
  const webhookUrl = document.getElementById('webhook-url');
  const webhookSecret = document.getElementById('webhook-secret');
  const eventType = document.getElementById('event-type');
  const webhookPayload = document.getElementById('webhook-payload');
  const sendBtn = document.getElementById('send-webhook-btn');
  const clearLogsBtn = document.getElementById('clear-logs-btn');
  const logsContainer = document.getElementById('logs-container');
  
  // Update payload when event type changes
  eventType.addEventListener('change', () => {
    const type = eventType.value;
    const payload = {
      id: `evt_${Date.now()}`,
      object: 'event',
      created: Math.floor(Date.now() / 1000),
      type: type,
      data: getSampleData(type)
    };
    webhookPayload.value = JSON.stringify(payload, null, 2);
  });
  
  // Send webhook
  sendBtn.addEventListener('click', async () => {
    const url = webhookUrl.value;
    if (!url) {
      alert('Please enter a webhook URL');
      return;
    }
    
    let payload;
    try {
      payload = JSON.parse(webhookPayload.value);
    } catch (e) {
      alert('Invalid JSON payload: ' + e.message);
      return;
    }
    
    const logEntry = createLogEntry();
    logsContainer.innerHTML = '';
    logsContainer.appendChild(logEntry.element);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Synapse-Signature': generateSignature(webhookPayload.value, webhookSecret.value)
        },
        body: webhookPayload.value
      });
      
      const responseBody = await response.text();
      
      logEntry.update({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody,
        success: response.ok
      });
    } catch (error) {
      logEntry.update({
        error: error.message,
        success: false
      });
    }
  });
  
  // Clear logs
  clearLogsBtn.addEventListener('click', () => {
    logsContainer.innerHTML = '<div class="log-placeholder">Send a test event to see the request details</div>';
  });
}

function getSampleData(type) {
  const samples = {
    'completion.created': {
      id: 'chat_123',
      model: 'gpt-4',
      object: 'chat.completion'
    },
    'completion.completed': {
      id: 'chat_123',
      model: 'gpt-4',
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      }
    },
    'embedding.created': {
      id: 'emb_123',
      model: 'text-embedding-3-small',
      usage: {
        prompt_tokens: 5,
        total_tokens: 5
      }
    },
    'usage.threshold': {
      organization_id: 'org_123',
      current_usage: 95,
      threshold: 100,
      unit: 'dollars'
    },
    'model.updated': {
      model: 'gpt-4',
      previous_status: 'beta',
      new_status: 'active'
    }
  };
  return samples[type] || {};
}

function generateSignature(payload, secret) {
  if (!secret) return 'test-signature';
  // In a real implementation, this would generate an HMAC signature
  return 'sha256=' + btoa(payload + secret).slice(0, 64);
}

function createLogEntry() {
  const element = document.createElement('div');
  element.className = 'log-entry';
  element.innerHTML = '<div class="log-entry-header"><span>Sending request...</span></div>';
  
  return {
    element,
    update: (data) => {
      if (data.error) {
        element.className = 'log-entry error';
        element.innerHTML = `
          <div class="log-entry-header">
            <span>Request Failed</span>
            <span class="log-entry-status error">ERROR</span>
          </div>
          <div class="log-entry-body">${data.error}</div>
        `;
      } else {
        element.className = data.success ? 'log-entry success' : 'log-entry error';
        element.innerHTML = `
          <div class="log-entry-header">
            <span>HTTP ${data.status}</span>
            <span class="log-entry-status ${data.success ? 'success' : 'error'}">${data.success ? 'SUCCESS' : 'FAILED'}</span>
          </div>
          <div class="log-entry-body">
            Status: ${data.status} ${data.statusText}
            
            Response:
            ${data.body}
          </div>
        `;
      }
    }
  };
}

// Modal
function initModal() {
  const modal = document.getElementById('api-key-modal');
  const openBtn = document.getElementById('api-key-btn');
  const closeBtn = modal.querySelector('.modal-close');
  const cancelBtn = modal.querySelector('.modal-cancel');
  const saveBtn = document.getElementById('save-api-key');
  const apiKeyInput = document.getElementById('modal-api-key');
  
  openBtn.addEventListener('click', () => {
    modal.classList.add('active');
  });
  
  const close = () => modal.classList.remove('active');
  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  
  saveBtn.addEventListener('click', () => {
    const key = apiKeyInput.value;
    if (key) {
      localStorage.setItem('synapse_api_key', key);
      alert('API key saved!');
      close();
    }
  });
  
  // Load saved key
  const savedKey = localStorage.getItem('synapse_api_key');
  if (savedKey) {
    apiKeyInput.value = savedKey;
  }
}

// Docs Tabs
function initDocsTabs() {
  document.querySelectorAll('.code-tabs').forEach(container => {
    const buttons = container.querySelectorAll('.tab-btn');
    const contents = container.querySelectorAll('.tab-content');
    
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        
        buttons.forEach(b => b.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        container.querySelector(`.tab-content[data-tab="${tab}"]`).classList.add('active');
      });
    });
  });
}

// Smooth scroll for docs links
document.querySelectorAll('.docs-nav a').forEach(link => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href');
    if (href.startsWith('#')) {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }
  });
});