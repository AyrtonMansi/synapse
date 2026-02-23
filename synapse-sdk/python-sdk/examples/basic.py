"""
Synapse SDK Examples
Demonstrates various use cases of the Python SDK.
"""

import asyncio
import os
from datetime import datetime, timedelta

from synapse_sdk import (
    SynapseSDK,
    CompletionRequest,
    Message,
    MessageRole,
    EmbeddingRequest,
    Tool,
    FunctionDefinition,
    create_client,
)


async def basic_completion():
    """Basic chat completion example."""
    async with SynapseSDK(api_key=os.getenv("SYNAPSE_API_KEY", "test-key")) as sdk:
        response = await sdk.chat_completion(
            CompletionRequest(
                model="gpt-4",
                messages=[
                    Message(
                        role=MessageRole.SYSTEM,
                        content="You are a helpful assistant."
                    ),
                    Message(
                        role=MessageRole.USER,
                        content="What is the capital of France?"
                    ),
                ],
                temperature=0.7,
                max_tokens=150,
            )
        )

        print(f"Response: {response.choices[0].message.content}")
        print(f"Tokens used: {response.usage.total_tokens}")


async def streaming_completion():
    """Streaming completion example."""
    async with SynapseSDK(api_key=os.getenv("SYNAPSE_API_KEY", "test-key")) as sdk:
        print("Response: ", end="", flush=True)

        async for chunk in sdk.stream_chat_completion(
            CompletionRequest(
                model="gpt-4",
                messages=[
                    Message(
                        role=MessageRole.USER,
                        content="Write a short haiku about programming."
                    ),
                ],
                temperature=0.8,
            )
        ):
            content = chunk.choices[0].delta.get("content", "")
            if content:
                print(content, end="", flush=True)

        print()


async def function_calling():
    """Function calling example."""
    async with SynapseSDK(api_key=os.getenv("SYNAPSE_API_KEY", "test-key")) as sdk:
        response = await sdk.chat_completion(
            CompletionRequest(
                model="gpt-4",
                messages=[
                    Message(
                        role=MessageRole.USER,
                        content="What's the weather like in Paris?"
                    ),
                ],
                tools=[
                    Tool(
                        type="function",
                        function=FunctionDefinition(
                            name="get_weather",
                            description="Get the current weather for a location",
                            parameters={
                                "type": "object",
                                "properties": {
                                    "location": {
                                        "type": "string",
                                        "description": "The city and country",
                                    },
                                    "unit": {
                                        "type": "string",
                                        "enum": ["celsius", "fahrenheit"],
                                        "description": "Temperature unit",
                                    },
                                },
                                "required": ["location"],
                            },
                        ),
                    ),
                ],
            )
        )

        message = response.choices[0].message
        if message.tool_calls:
            for tool_call in message.tool_calls:
                print(f"Function called: {tool_call.function.name}")
                print(f"Arguments: {tool_call.function.arguments}")
        else:
            print(f"Response: {message.content}")


async def embeddings_example():
    """Embeddings example."""
    async with SynapseSDK(api_key=os.getenv("SYNAPSE_API_KEY", "test-key")) as sdk:
        # Single embedding
        response = await sdk.create_embedding(
            EmbeddingRequest(
                model="text-embedding-3-small",
                input="The quick brown fox jumps over the lazy dog.",
            )
        )

        print(f"Embedding dimensions: {len(response.data[0].embedding)}")
        print(f"First 5 values: {response.data[0].embedding[:5]}")


async def batch_embeddings():
    """Batch embeddings example."""
    async with SynapseSDK(api_key=os.getenv("SYNAPSE_API_KEY", "test-key")) as sdk:
        texts = [
            "Machine learning is fascinating",
            "Deep learning powers modern AI",
            "Natural language processing enables communication",
            "Computer vision helps machines see",
            "Reinforcement learning creates intelligent agents",
        ]

        responses = await sdk.create_embeddings_batch(
            texts=texts,
            model="text-embedding-3-small",
            batch_size=100,
            concurrency=5,
        )

        for i, text in enumerate(texts):
            print(f"Text: {text}")
            print(f"  Embedding dims: {len(responses[0].data[i].embedding)}")


async def batch_completions():
    """Batch completions example with progress tracking."""
    async with SynapseSDK(api_key=os.getenv("SYNAPSE_API_KEY", "test-key")) as sdk:
        prompts = [
            "What is 2 + 2?",
            "What is the capital of Italy?",
            "Who wrote Romeo and Juliet?",
            "What is the speed of light?",
            "What is the largest planet?",
        ]

        requests = [
            CompletionRequest(
                model="gpt-3.5-turbo",
                messages=[Message(role=MessageRole.USER, content=prompt)],
            )
            for prompt in prompts
        ]

        def on_progress(completed: int, total: int):
            print(f"Progress: {completed}/{total}", end="\r")

        results = await sdk.batch_completions(
            requests,
            concurrency=3,
            on_progress=on_progress,
        )

        print()  # New line after progress

        for prompt, result in zip(prompts, results):
            if isinstance(result, Exception):
                print(f"Error for '{prompt}': {result}")
            else:
                print(f"Q: {prompt}")
                print(f"A: {result.choices[0].message.content}\n")


async def list_models():
    """List available models."""
    async with SynapseSDK(api_key=os.getenv("SYNAPSE_API_KEY", "test-key")) as sdk:
        models = await sdk.list_models()

        print("Available Models:")
        print("-" * 60)
        for model in models:
            print(f"ID: {model.id}")
            print(f"  Name: {model.name}")
            print(f"  Provider: {model.provider}")
            print(f"  Context Window: {model.context_window:,} tokens")
            print(f"  Capabilities: {', '.join(model.capabilities)}")
            print(f"  Status: {model.status.value}")
            print()


async def check_usage():
    """Check usage statistics."""
    async with SynapseSDK(api_key=os.getenv("SYNAPSE_API_KEY", "test-key")) as sdk:
        # Last 30 days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)

        usage = await sdk.get_usage(start_date, end_date)

        print(f"Usage Statistics ({usage.period})")
        print("-" * 40)
        print(f"Total Requests: {usage.total_requests:,}")
        print(f"Total Tokens: {usage.total_tokens:,}")
        print(f"Total Cost: ${usage.cost:.2f}")
        print()
        print("Breakdown by Model:")
        for model, stats in usage.models.items():
            print(f"  {model}:")
            print(f"    Requests: {stats.requests:,}")
            print(f"    Tokens: {stats.tokens:,}")
            print(f"    Cost: ${stats.cost:.2f}")


async def error_handling():
    """Error handling example."""
    from synapse_sdk import (
        AuthenticationError,
        RateLimitError,
        ValidationError,
        TimeoutError,
    )

    async with SynapseSDK(
        api_key="invalid-key",
        timeout=5.0,
    ) as sdk:
        try:
            await sdk.chat_completion(
                CompletionRequest(
                    model="gpt-4",
                    messages=[Message(role=MessageRole.USER, content="Test")],
                )
            )
        except AuthenticationError as e:
            print(f"Authentication failed: {e.message}")
        except RateLimitError as e:
            print(f"Rate limited. Retry after {e.retry_after} seconds")
        except ValidationError as e:
            print(f"Validation failed: {e.field_errors}")
        except TimeoutError:
            print("Request timed out")
        except Exception as e:
            print(f"Unexpected error: {e}")


async def concurrent_requests():
    """Multiple concurrent requests."""
    async with SynapseSDK(api_key=os.getenv("SYNAPSE_API_KEY", "test-key")) as sdk:
        # Create multiple concurrent tasks
        tasks = [
            sdk.chat_completion(
                CompletionRequest(
                    model="gpt-3.5-turbo",
                    messages=[Message(role=MessageRole.USER, content=f"Question {i}")],
                )
            )
            for i in range(5)
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                print(f"Task {i}: Error - {result}")
            else:
                print(f"Task {i}: {result.choices[0].message.content[:50]}...")


async def jupyter_example():
    """Example of Jupyter integration (when running in a notebook)."""
    async with SynapseSDK(api_key=os.getenv("SYNAPSE_API_KEY", "test-key")) as sdk:
        from synapse_sdk import JupyterIntegration

        jupyter = JupyterIntegration(sdk)

        # Simple chat
        response = await jupyter.chat(
            "Explain quantum computing in simple terms",
            system="You are a physics teacher explaining to a 10-year-old.",
        )
        print(f"Response: {response}")

        # Get embeddings
        embeddings = await jupyter.embed(
            ["Machine learning", "Deep learning", "Neural networks"]
        )
        print(f"Got {len(embeddings)} embeddings")


async def main():
    """Run all examples."""
    examples = [
        ("Basic Completion", basic_completion),
        ("Streaming Completion", streaming_completion),
        ("Function Calling", function_calling),
        ("Embeddings", embeddings_example),
        ("Batch Embeddings", batch_embeddings),
        ("Batch Completions", batch_completions),
        ("List Models", list_models),
        ("Check Usage", check_usage),
        ("Error Handling", error_handling),
        ("Concurrent Requests", concurrent_requests),
    ]

    for name, example_func in examples:
        print(f"\n{'='*60}")
        print(f"Example: {name}")
        print("=" * 60)
        try:
            await example_func()
        except Exception as e:
            print(f"Error: {e}")


if __name__ == "__main__":
    asyncio.run(main())