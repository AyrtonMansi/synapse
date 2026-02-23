import { SynapseSDK, createSynapseClient } from '@synapse-ai/sdk';

// Initialize the SDK
const sdk = createSynapseClient({
  apiKey: process.env.SYNAPSE_API_KEY || 'your-api-key',
  baseUrl: 'https://api.synapse.ai/v1',
});

// Basic chat completion
async function basicCompletion() {
  const response = await sdk.chatCompletion({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'What is the capital of France?' },
    ],
    temperature: 0.7,
    maxTokens: 150,
  });

  console.log('Response:', response.choices[0].message.content);
  console.log('Tokens used:', response.usage.totalTokens);
}

// Streaming completion
async function streamingCompletion() {
  const stream = sdk.streamChatCompletion({
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'Write a short poem about AI.' },
    ],
    temperature: 0.8,
  });

  process.stdout.write('Response: ');
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      process.stdout.write(content);
    }
  }
  console.log();
}

// Function calling example
async function functionCalling() {
  const response = await sdk.chatCompletion({
    model: 'gpt-4',
    messages: [
      { role: 'user', content: 'What is the weather in Paris?' },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get the current weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'The city and country',
              },
              unit: {
                type: 'string',
                enum: ['celsius', 'fahrenheit'],
              },
            },
            required: ['location'],
          },
        },
      },
    ],
  });

  const toolCalls = response.choices[0].message.toolCalls;
  if (toolCalls) {
    console.log('Function called:', toolCalls[0].function.name);
    console.log('Arguments:', toolCalls[0].function.arguments);
  }
}

// Embeddings example
async function createEmbeddings() {
  const texts = [
    'The quick brown fox',
    'jumps over the lazy dog',
    'Machine learning is fascinating',
  ];

  // Single embedding
  const response = await sdk.createEmbedding({
    model: 'text-embedding-3-small',
    input: texts[0],
  });

  console.log('Embedding dimensions:', response.data[0].embedding.length);

  // Batch embeddings
  const batchResponses = await sdk.createEmbeddingsBatch(
    texts,
    'text-embedding-3-small'
  );

  console.log('Batch results:', batchResponses.length);
}

// Batch processing example
async function batchProcessing() {
  const prompts = [
    'What is 2 + 2?',
    'What is the capital of Italy?',
    'Who wrote Romeo and Juliet?',
    'What is the speed of light?',
  ];

  const requests = prompts.map((prompt) => ({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
  }));

  const results = await sdk.batchCompletions(requests, 2);

  results.forEach((result, index) => {
    if (result instanceof Error) {
      console.log(`Prompt ${index}: Error - ${result.message}`);
    } else {
      console.log(`Prompt ${index}: ${result.choices[0].message.content}`);
    }
  });
}

// Error handling example
async function errorHandling() {
  try {
    await sdk.chatCompletion({
      model: 'invalid-model',
      messages: [{ role: 'user', content: 'Test' }],
    });
  } catch (error) {
    if (error instanceof SynapseSDK.ValidationError) {
      console.log('Validation failed:', error.message);
    } else if (error instanceof SynapseSDK.RateLimitError) {
      console.log('Rate limited. Retry after:', error.retryAfter, 'seconds');
    } else if (error instanceof SynapseSDK.AuthenticationError) {
      console.log('Authentication failed. Check your API key.');
    } else {
      console.log('Unexpected error:', error);
    }
  }
}

// Usage monitoring
async function checkUsage() {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30); // Last 30 days

  const usage = await sdk.getUsage(startDate, new Date());

  console.log('Total requests:', usage.totalRequests);
  console.log('Total tokens:', usage.totalTokens);
  console.log('Total cost: $', usage.cost);

  console.log('\nBreakdown by model:');
  for (const [model, stats] of Object.entries(usage.models)) {
    console.log(`  ${model}: ${stats.requests} requests, $${stats.cost}`);
  }
}

// Run examples
async function main() {
  console.log('=== Basic Completion ===');
  await basicCompletion();

  console.log('\n=== Streaming Completion ===');
  await streamingCompletion();

  console.log('\n=== Function Calling ===');
  await functionCalling();

  console.log('\n=== Embeddings ===');
  await createEmbeddings();

  console.log('\n=== Batch Processing ===');
  await batchProcessing();

  console.log('\n=== Usage Stats ===');
  await checkUsage();
}

main().catch(console.error);