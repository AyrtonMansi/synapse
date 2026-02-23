# SDK Integration Tutorials

## Python SDK

### Installation

```bash
pip install synapse-sdk
```

### Quick Start

```python
from synapse import SynapseClient

# Initialize client
client = SynapseClient(api_key="your_api_key")

# Simple inference
result = client.inference(
    model="meta-llama/Llama-2-70b",
    prompt="What is the capital of France?"
)
print(result.output)
```

### Authentication

```python
import os
from synapse import SynapseClient

# Method 1: Environment variable
# export SYNAPSE_API_KEY=your_key
client = SynapseClient()

# Method 2: Direct parameter
client = SynapseClient(api_key="your_api_key")

# Method 3: Config file
# ~/.synapse/config.yaml
# api_key: your_key
client = SynapseClient.from_config()
```

### Text Generation

```python
# Basic completion
response = client.complete(
    model="meta-llama/Llama-2-70b",
    prompt="Explain machine learning in simple terms:",
    max_tokens=500,
    temperature=0.7,
    top_p=0.9
)

print(response.text)
print(f"Tokens used: {response.usage.total_tokens}")

# Chat completion (OpenAI-compatible)
messages = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What can you do?"}
]

response = client.chat.completions.create(
    model="meta-llama/Llama-2-70b-chat",
    messages=messages,
    stream=True  # Enable streaming
)

# Handle streaming response
for chunk in response:
    print(chunk.choices[0].delta.content, end="")
```

### Image Generation

```python
# Generate image
image = client.images.generate(
    model="stability-ai/sdxl",
    prompt="A futuristic city at sunset, cyberpunk style",
    width=1024,
    height=1024,
    steps=30
)

# Save image
image.save("output.png")

# Or get base64
base64_image = image.to_base64()
```

### Embeddings

```python
# Generate embeddings
documents = [
    "The quick brown fox",
    "jumps over the lazy dog",
    "Machine learning is fascinating"
]

embeddings = client.embeddings.create(
    model="sentence-transformers/all-MiniLM-L6-v2",
    input=documents
)

# Use for similarity search
import numpy as np

def cosine_similarity(a, b):
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

query_embedding = client.embeddings.create(
    model="sentence-transformers/all-MiniLM-L6-v2",
    input=["What is machine learning?"]
).data[0].embedding

for doc, emb in zip(documents, embeddings.data):
    similarity = cosine_similarity(query_embedding, emb.embedding)
    print(f"{doc}: {similarity:.3f}")
```

### Advanced Usage

#### Async Support

```python
import asyncio
from synapse import AsyncSynapseClient

async def process_multiple():
    client = AsyncSynapseClient(api_key="your_key")
    
    # Concurrent requests
    tasks = [
        client.inference(
            model="meta-llama/Llama-2-70b",
            prompt=f"Question {i}"
        )
        for i in range(10)
    ]
    
    results = await asyncio.gather(*tasks)
    return results

results = asyncio.run(process_multiple())
```

#### Error Handling

```python
from synapse.exceptions import (
    SynapseError,
    RateLimitError,
    InsufficientFundsError,
    TaskTimeoutError
)

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    retry=retry_if_exception_type(RateLimitError)
)
def resilient_inference(prompt):
    try:
        return client.inference(
            model="meta-llama/Llama-2-70b",
            prompt=prompt
        )
    except InsufficientFundsError:
        print("Please add funds to your account")
        raise
    except TaskTimeoutError:
        print("Task took too long, try with shorter input")
        raise
    except SynapseError as e:
        print(f"Synapse error: {e}")
        raise
```

#### Custom Task Types

```python
# Fine-tuning task
training_job = client.training.create(
    base_model="meta-llama/Llama-2-7b",
    dataset="ipfs://Qm...",  # Dataset on IPFS
    config={
        "epochs": 3,
        "batch_size": 32,
        "learning_rate": 2e-5,
        "lora_r": 16,
        "lora_alpha": 32
    }
)

# Monitor progress
while training_job.status != "completed":
    training_job = client.training.get(training_job.id)
    print(f"Progress: {training_job.progress}%")
    time.sleep(30)

# Use fine-tuned model
result = client.inference(
    model=training_job.output_model_id,
    prompt="Test the fine-tuned model"
)
```

## JavaScript/TypeScript SDK

### Installation

```bash
npm install @synapse/sdk
# or
yarn add @synapse/sdk
```

### Basic Usage

```typescript
import { SynapseClient } from '@synapse/sdk';

const client = new SynapseClient({
  apiKey: process.env.SYNAPSE_API_KEY
});

// Simple completion
const result = await client.inference({
  model: 'meta-llama/Llama-2-70b',
  prompt: 'Explain quantum computing:'
});

console.log(result.output);
```

### Streaming Responses

```typescript
const stream = await client.inference({
  model: 'meta-llama/Llama-2-70b',
  prompt: 'Write a story about AI:',
  stream: true
});

for await (const chunk of stream) {
  process.stdout.write(chunk.content);
}
```

### React Integration

```typescript
// hooks/useSynapse.ts
import { useState, useCallback } from 'react';
import { SynapseClient } from '@synapse/sdk';

const client = new SynapseClient({
  apiKey: process.env.REACT_APP_SYNAPSE_API_KEY!
});

export function useSynapse() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generate = useCallback(async (prompt: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await client.inference({
        model: 'meta-llama/Llama-2-70b',
        prompt,
        stream: true
      });
      
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generate, loading, error };
}
```

```tsx
// components/Chat.tsx
import React, { useState } from 'react';
import { useSynapse } from '../hooks/useSynapse';

export function Chat() {
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const { generate, loading } = useSynapse();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setMessages(prev => [...prev, `User: ${input}`]);
    
    const result = await generate(input);
    setMessages(prev => [...prev, `AI: ${result.output}`]);
    setInput('');
  };

  return (
    <div>
      {messages.map((msg, i) => (
        <p key={i}>{msg}</p>
      ))}
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Generating...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
```

## Go SDK

### Installation

```bash
go get github.com/synapse-protocol/synapse-go
```

### Basic Usage

```go
package main

import (
    "context"
    "fmt"
    "log"
    
    "github.com/synapse-protocol/synapse-go"
)

func main() {
    client, err := synapse.NewClient("your_api_key")
    if err != nil {
        log.Fatal(err)
    }

    result, err := client.Inference(context.Background(), synapse.InferenceRequest{
        Model:  "meta-llama/Llama-2-70b",
        Prompt: "Explain Go channels:",
    })
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println(result.Output)
}
```

### Concurrent Requests

```go
func processBatch(client *synapse.Client, prompts []string) ([]string, error) {
    ctx := context.Background()
    results := make([]string, len(prompts))
    errChan := make(chan error, len(prompts))
    
    var wg sync.WaitGroup
    
    for i, prompt := range prompts {
        wg.Add(1)
        go func(index int, p string) {
            defer wg.Done()
            
            result, err := client.Inference(ctx, synapse.InferenceRequest{
                Model:  "meta-llama/Llama-2-70b",
                Prompt: p,
            })
            if err != nil {
                errChan <- fmt.Errorf("prompt %d: %w", index, err)
                return
            }
            
            results[index] = result.Output
        }(i, prompt)
    }
    
    wg.Wait()
    close(errChan)
    
    for err := range errChan {
        if err != nil {
            return nil, err
        }
    }
    
    return results, nil
}
```

## Rust SDK

### Installation

```toml
[dependencies]
synapse = "0.1"
tokio = { version = "1", features = ["full"] }
```

### Basic Usage

```rust
use synapse::Client;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::new("your_api_key");
    
    let result = client
        .inference("meta-llama/Llama-2-70b")
        .prompt("Explain Rust ownership:")
        .send()
        .await?;
    
    println!("{}", result.output);
    Ok(())
}
```

## Building a Complete Application

### Example: AI Document Processor

```python
# document_processor.py
from synapse import SynapseClient
from typing import List, Dict
import asyncio

class DocumentProcessor:
    def __init__(self, api_key: str):
        self.client = SynapseClient(api_key=api_key)
    
    async def summarize(self, text: str, max_length: int = 200) -> str:
        """Summarize a document"""
        prompt = f"Summarize the following text in {max_length} words:\n\n{text}"
        
        result = await self.client.inference(
            model="meta-llama/Llama-2-70b",
            prompt=prompt,
            max_tokens=max_length * 2
        )
        return result.output
    
    async def extract_entities(self, text: str) -> Dict:
        """Extract named entities"""
        prompt = f"""Extract entities from this text as JSON:
        {text}
        
        Format: {{"people": [], "organizations": [], "locations": [], "dates": []}}"""
        
        result = await self.client.inference(
            model="meta-llama/Llama-2-70b",
            prompt=prompt,
            max_tokens=500
        )
        
        # Parse JSON response
        import json
        return json.loads(result.output)
    
    async def answer_question(self, context: str, question: str) -> str:
        """Answer question based on context"""
        prompt = f"""Context: {context}
        
        Question: {question}
        
        Answer:"""
        
        result = await self.client.inference(
            model="meta-llama/Llama-2-70b",
            prompt=prompt
        )
        return result.output
    
    async def process_batch(self, documents: List[str]) -> List[Dict]:
        """Process multiple documents"""
        tasks = []
        for doc in documents:
            tasks.append(self._process_single(doc))
        
        return await asyncio.gather(*tasks)
    
    async def _process_single(self, document: str) -> Dict:
        """Process a single document"""
        summary, entities = await asyncio.gather(
            self.summarize(document),
            self.extract_entities(document)
        )
        
        return {
            "summary": summary,
            "entities": entities,
            "word_count": len(document.split())
        }

# Usage
async def main():
    processor = DocumentProcessor(api_key="your_key")
    
    documents = [
        "Document 1 text...",
        "Document 2 text...",
    ]
    
    results = await processor.process_batch(documents)
    
    for i, result in enumerate(results):
        print(f"\nDocument {i+1}:")
        print(f"Summary: {result['summary']}")
        print(f"Entities: {result['entities']}")

if __name__ == "__main__":
    asyncio.run(main())
```

---

For more examples and advanced patterns, visit:
- Python SDK: https://github.com/synapse-protocol/synapse-python
- JS SDK: https://github.com/synapse-protocol/synapse-js
- Go SDK: https://github.com/synapse-protocol/synapse-go
