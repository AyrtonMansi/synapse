import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from synapse_sdk import (
    SynapseSDK,
    CompletionRequest,
    Message,
    MessageRole,
    EmbeddingRequest,
    ModelStatus,
    AuthenticationError,
    RateLimitError,
    ValidationError,
    ServerError,
    TimeoutError,
    create_client,
)


@pytest.fixture
async def sdk():
    """Create a test SDK instance."""
    sdk = SynapseSDK(api_key="test-key")
    yield sdk
    await sdk.close()


@pytest.fixture
def mock_response():
    """Create a mock response."""
    def _create_response(status=200, json_data=None, headers=None):
        response = AsyncMock()
        response.ok = status < 400
        response.status = status
        response.json = AsyncMock(return_value=json_data or {})
        response.headers = headers or {}
        return response
    return _create_response


class TestSynapseSDK:
    """Test suite for SynapseSDK."""

    def test_initialization(self):
        """Test SDK initialization."""
        sdk = SynapseSDK(api_key="test-key")
        assert sdk.api_key == "test-key"
        assert sdk.base_url == "https://api.synapse.ai/v1"
        assert sdk.timeout == 60.0
        assert sdk.retries == 3

    def test_initialization_custom(self):
        """Test SDK initialization with custom options."""
        sdk = SynapseSDK(
            api_key="test-key",
            base_url="https://custom.api.com",
            timeout=30.0,
            retries=5,
        )
        assert sdk.base_url == "https://custom.api.com"
        assert sdk.timeout == 30.0
        assert sdk.retries == 5

    def test_create_client(self):
        """Test factory function."""
        sdk = create_client(api_key="test-key")
        assert isinstance(sdk, SynapseSDK)

    @pytest.mark.asyncio
    async def test_chat_completion(self, sdk, mock_response):
        """Test chat completion."""
        response_data = {
            "id": "chat-123",
            "object": "chat.completion",
            "created": 1234567890,
            "model": "gpt-4",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": "Hello!"},
                    "finishReason": "stop",
                }
            ],
            "usage": {"promptTokens": 10, "completionTokens": 5, "totalTokens": 15},
        }

        with patch.object(sdk, "_request", return_value=response_data):
            request = CompletionRequest(
                model="gpt-4",
                messages=[Message(role=MessageRole.USER, content="Hi")],
            )
            response = await sdk.chat_completion(request)

            assert response.id == "chat-123"
            assert response.model == "gpt-4"
            assert response.choices[0].message.content == "Hello!"
            assert response.usage.total_tokens == 15

    @pytest.mark.asyncio
    async def test_stream_chat_completion(self, sdk):
        """Test streaming chat completion."""
        chunks = [
            {"id": "1", "object": "chat.completion.chunk", "created": 1234567890, "model": "gpt-4", "choices": [{"index": 0, "delta": {"content": "Hello"}, "finishReason": None}]},
            {"id": "2", "object": "chat.completion.chunk", "created": 1234567890, "model": "gpt-4", "choices": [{"index": 0, "delta": {"content": " world"}, "finishReason": "stop"}]},
        ]

        # Mock the session and response
        mock_session = AsyncMock()
        mock_response = AsyncMock()
        mock_response.ok = True

        # Create async iterator for content
        async def async_iter():
            for chunk in chunks:
                yield f"data: {json.dumps(chunk)}\n\n".encode()

        mock_response.content = async_iter()
        mock_session.post = AsyncMock(return_value=mock_response)
        sdk._session = mock_session

        request = CompletionRequest(
            model="gpt-4",
            messages=[Message(role=MessageRole.USER, content="Hi")],
        )

        results = []
        async for chunk in sdk.stream_chat_completion(request):
            results.append(chunk)

        assert len(results) == 2

    @pytest.mark.asyncio
    async def test_create_embedding(self, sdk):
        """Test create embedding."""
        response_data = {
            "object": "list",
            "data": [
                {"object": "embedding", "embedding": [0.1, 0.2, 0.3], "index": 0}
            ],
            "model": "text-embedding-3-small",
            "usage": {"promptTokens": 5, "completionTokens": 0, "totalTokens": 5},
        }

        with patch.object(sdk, "_request", return_value=response_data):
            request = EmbeddingRequest(model="text-embedding-3-small", input="Hello")
            response = await sdk.create_embedding(request)

            assert response.object == "list"
            assert len(response.data[0].embedding) == 3

    @pytest.mark.asyncio
    async def test_list_models(self, sdk):
        """Test list models."""
        response_data = [
            {
                "id": "gpt-4",
                "name": "GPT-4",
                "provider": "openai",
                "capabilities": ["chat", "function-calling"],
                "contextWindow": 8192,
                "pricing": {"input": 0.03, "output": 0.06},
                "status": "active",
            }
        ]

        with patch.object(sdk, "_request", return_value=response_data):
            models = await sdk.list_models()

            assert len(models) == 1
            assert models[0].id == "gpt-4"
            assert models[0].status == ModelStatus.ACTIVE

    @pytest.mark.asyncio
    async def test_get_model(self, sdk):
        """Test get model."""
        response_data = {
            "id": "gpt-4",
            "name": "GPT-4",
            "provider": "openai",
            "capabilities": ["chat"],
            "contextWindow": 8192,
            "pricing": {},
            "status": "active",
        }

        with patch.object(sdk, "_request", return_value=response_data):
            model = await sdk.get_model("gpt-4")

            assert model.id == "gpt-4"
            assert model.status == ModelStatus.ACTIVE

    @pytest.mark.asyncio
    async def test_is_model_available_true(self, sdk):
        """Test model availability check (true)."""
        with patch.object(sdk, "get_model", return_value=MagicMock(status=ModelStatus.ACTIVE)):
            available = await sdk.is_model_available("gpt-4")
            assert available is True

    @pytest.mark.asyncio
    async def test_is_model_available_false(self, sdk):
        """Test model availability check (false)."""
        with patch.object(sdk, "get_model", side_effect=SynapseSDK.SynapseError("Not found", "NOT_FOUND", 404)):
            available = await sdk.is_model_available("invalid-model")
            assert available is False

    @pytest.mark.asyncio
    async def test_batch_completions(self, sdk):
        """Test batch completions."""
        response_data = {
            "id": "chat-123",
            "object": "chat.completion",
            "created": 1234567890,
            "model": "gpt-4",
            "choices": [{"index": 0, "message": {"role": "assistant", "content": "Test"}, "finishReason": "stop"}],
            "usage": {"promptTokens": 10, "completionTokens": 5, "totalTokens": 15},
        }

        with patch.object(sdk, "chat_completion", return_value=MagicMock(**response_data)):
            requests = [
                CompletionRequest(model="gpt-4", messages=[Message(role=MessageRole.USER, content="Q1")]),
                CompletionRequest(model="gpt-4", messages=[Message(role=MessageRole.USER, content="Q2")]),
            ]

            results = await sdk.batch_completions(requests, concurrency=2)
            assert len(results) == 2

    @pytest.mark.asyncio
    async def test_get_usage(self, sdk):
        """Test get usage stats."""
        response_data = {
            "period": "2024-01",
            "totalRequests": 1000,
            "totalTokens": 50000,
            "cost": 12.5,
            "models": {
                "gpt-4": {"requests": 500, "tokens": 30000, "cost": 10.0},
            },
        }

        with patch.object(sdk, "_request", return_value=response_data):
            usage = await sdk.get_usage()

            assert usage.period == "2024-01"
            assert usage.total_requests == 1000
            assert usage.cost == 12.5


class TestErrorHandling:
    """Test error handling."""

    @pytest.mark.asyncio
    async def test_authentication_error(self, sdk, mock_response):
        """Test authentication error."""
        mock_resp = mock_response(
            status=401,
            json_data={"error": {"message": "Invalid API key"}}
        )

        with patch.object(sdk, "_request", side_effect=AuthenticationError("Invalid API key")):
            with pytest.raises(AuthenticationError):
                await sdk.chat_completion(CompletionRequest(model="gpt-4", messages=[]))

    @pytest.mark.asyncio
    async def test_rate_limit_error(self, sdk):
        """Test rate limit error."""
        error = RateLimitError("Rate limit exceeded", retry_after=60)
        assert error.retry_after == 60
        assert error.status_code == 429

    @pytest.mark.asyncio
    async def test_validation_error(self, sdk):
        """Test validation error."""
        field_errors = {"model": ["required"], "messages": ["invalid format"]}
        error = ValidationError("Validation failed", field_errors=field_errors)
        assert error.field_errors == field_errors

    @pytest.mark.asyncio
    async def test_server_error(self, sdk):
        """Test server error."""
        error = ServerError("Internal server error", status_code=500)
        assert error.status_code == 500

    @pytest.mark.asyncio
    async def test_timeout_error(self, sdk):
        """Test timeout error."""
        error = TimeoutError("Request timeout")
        assert error.status_code == 408


class TestJupyterIntegration:
    """Test Jupyter integration."""

    @pytest.mark.asyncio
    async def test_chat(self):
        """Test simple chat."""
        from synapse_sdk import JupyterIntegration

        sdk = MagicMock()
        response = MagicMock()
        response.choices = [MagicMock(message=MagicMock(content="Hello!"))]
        sdk.chat_completion = AsyncMock(return_value=response)

        jupyter = JupyterIntegration(sdk)
        result = await jupyter.chat("Hi", model="gpt-4")

        assert result == "Hello!"

    @pytest.mark.asyncio
    async def test_embed_single(self):
        """Test single embedding."""
        from synapse_sdk import JupyterIntegration

        sdk = MagicMock()
        response = MagicMock()
        response.data = [MagicMock(embedding=[0.1, 0.2, 0.3])]
        sdk.create_embedding = AsyncMock(return_value=response)

        jupyter = JupyterIntegration(sdk)
        result = await jupyter.embed("Hello", model="text-embedding-3-small")

        assert result == [0.1, 0.2, 0.3]

    @pytest.mark.asyncio
    async def test_embed_batch(self):
        """Test batch embeddings."""
        from synapse_sdk import JupyterIntegration

        sdk = MagicMock()
        sdk.create_embeddings_batch = AsyncMock(return_value=[
            MagicMock(data=[
                MagicMock(embedding=[0.1]),
                MagicMock(embedding=[0.2]),
            ])
        ])

        jupyter = JupyterIntegration(sdk)
        result = await jupyter.embed(["Hello", "World"])

        assert len(result) == 2
