"""
Synapse Python SDK
Full async API wrapper with batch processing and Jupyter integration.
"""

import asyncio
import json
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import (
    Any,
    AsyncGenerator,
    Callable,
    Coroutine,
    Dict,
    List,
    Optional,
    TypeVar,
    Union,
    Protocol,
)

import aiohttp
from aiohttp import ClientTimeout, ClientError


# ============= TYPE DEFINITIONS =============

class MessageRole(str, Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class FinishReason(str, Enum):
    STOP = "stop"
    LENGTH = "length"
    TOOL_CALLS = "tool_calls"
    CONTENT_FILTER = "content_filter"


class ModelStatus(str, Enum):
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    BETA = "beta"


@dataclass
class Message:
    role: MessageRole
    content: Union[str, List[Dict[str, Any]]]
    name: Optional[str] = None
    tool_calls: Optional[List["ToolCall"]] = None
    tool_call_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        result = {"role": self.role, "content": self.content}
        if self.name:
            result["name"] = self.name
        if self.tool_calls:
            result["tool_calls"] = [tc.to_dict() for tc in self.tool_calls]
        if self.tool_call_id:
            result["tool_call_id"] = self.tool_call_id
        return result


@dataclass
class ToolCall:
    id: str
    type: str
    function: "FunctionCall"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "function": {
                "name": self.function.name,
                "arguments": self.function.arguments,
            },
        }


@dataclass
class FunctionCall:
    name: str
    arguments: str


@dataclass
class Tool:
    type: str
    function: "FunctionDefinition"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type,
            "function": {
                "name": self.function.name,
                "description": self.function.description,
                "parameters": self.function.parameters,
            },
        }


@dataclass
class FunctionDefinition:
    name: str
    description: str
    parameters: Dict[str, Any]


@dataclass
class CompletionRequest:
    model: str
    messages: List[Message]
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    top_p: Optional[float] = None
    frequency_penalty: Optional[float] = None
    presence_penalty: Optional[float] = None
    stop: Optional[List[str]] = None
    stream: bool = False
    tools: Optional[List[Tool]] = None
    tool_choice: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        result: Dict[str, Any] = {
            "model": self.model,
            "messages": [m.to_dict() for m in self.messages],
            "stream": self.stream,
        }
        if self.temperature is not None:
            result["temperature"] = self.temperature
        if self.max_tokens is not None:
            result["max_tokens"] = self.max_tokens
        if self.top_p is not None:
            result["top_p"] = self.top_p
        if self.frequency_penalty is not None:
            result["frequency_penalty"] = self.frequency_penalty
        if self.presence_penalty is not None:
            result["presence_penalty"] = self.presence_penalty
        if self.stop is not None:
            result["stop"] = self.stop
        if self.tools is not None:
            result["tools"] = [t.to_dict() for t in self.tools]
        if self.tool_choice is not None:
            result["tool_choice"] = self.tool_choice
        return result


@dataclass
class UsageInfo:
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int

    @classmethod
    def from_dict(cls, data: Dict[str, int]) -> "UsageInfo":
        return cls(
            prompt_tokens=data.get("promptTokens", 0),
            completion_tokens=data.get("completionTokens", 0),
            total_tokens=data.get("totalTokens", 0),
        )


@dataclass
class Choice:
    index: int
    message: Message
    finish_reason: Optional[FinishReason]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Choice":
        msg_data = data.get("message", {})
        return cls(
            index=data.get("index", 0),
            message=Message(
                role=MessageRole(msg_data.get("role", "assistant")),
                content=msg_data.get("content", ""),
                tool_calls=[
                    ToolCall(
                        id=tc["id"],
                        type=tc["type"],
                        function=FunctionCall(
                            name=tc["function"]["name"],
                            arguments=tc["function"]["arguments"],
                        ),
                    )
                    for tc in msg_data.get("toolCalls", [])
                ] if msg_data.get("toolCalls") else None,
            ),
            finish_reason=FinishReason(data["finishReason"]) if data.get("finishReason") else None,
        )


@dataclass
class CompletionResponse:
    id: str
    object: str
    created: int
    model: str
    choices: List[Choice]
    usage: UsageInfo

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CompletionResponse":
        return cls(
            id=data["id"],
            object=data["object"],
            created=data["created"],
            model=data["model"],
            choices=[Choice.from_dict(c) for c in data.get("choices", [])],
            usage=UsageInfo.from_dict(data.get("usage", {})),
        )


@dataclass
class StreamChoice:
    index: int
    delta: Dict[str, Any]
    finish_reason: Optional[str]


@dataclass
class StreamChunk:
    id: str
    object: str
    created: int
    model: str
    choices: List[StreamChoice]


@dataclass
class ModelInfo:
    id: str
    name: str
    provider: str
    capabilities: List[str]
    context_window: int
    pricing: Dict[str, float]
    status: ModelStatus

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ModelInfo":
        return cls(
            id=data["id"],
            name=data["name"],
            provider=data["provider"],
            capabilities=data.get("capabilities", []),
            context_window=data.get("contextWindow", 0),
            pricing=data.get("pricing", {}),
            status=ModelStatus(data.get("status", "active")),
        )


@dataclass
class EmbeddingRequest:
    model: str
    input: Union[str, List[str]]
    encoding_format: Optional[str] = None
    dimensions: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        result: Dict[str, Any] = {"model": self.model, "input": self.input}
        if self.encoding_format:
            result["encodingFormat"] = self.encoding_format
        if self.dimensions:
            result["dimensions"] = self.dimensions
        return result


@dataclass
class EmbeddingData:
    object: str
    embedding: List[float]
    index: int

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "EmbeddingData":
        return cls(
            object=data["object"],
            embedding=data["embedding"],
            index=data["index"],
        )


@dataclass
class EmbeddingResponse:
    object: str
    data: List[EmbeddingData]
    model: str
    usage: UsageInfo

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "EmbeddingResponse":
        return cls(
            object=data["object"],
            data=[EmbeddingData.from_dict(d) for d in data.get("data", [])],
            model=data["model"],
            usage=UsageInfo.from_dict(data.get("usage", {})),
        )


@dataclass
class ModelUsage:
    requests: int
    tokens: int
    cost: float


@dataclass
class UsageStats:
    period: str
    total_requests: int
    total_tokens: int
    cost: float
    models: Dict[str, ModelUsage]


# ============= ERROR CLASSES =============

class SynapseError(Exception):
    """Base error for Synapse SDK."""

    def __init__(
        self,
        message: str,
        code: str,
        status_code: Optional[int] = None,
        response: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.response = response


class AuthenticationError(SynapseError):
    """Raised when API authentication fails."""

    def __init__(self, message: str, response: Optional[Dict[str, Any]] = None):
        super().__init__(message, "AUTHENTICATION_ERROR", 401, response)


class RateLimitError(SynapseError):
    """Raised when rate limit is exceeded."""

    def __init__(
        self,
        message: str,
        retry_after: Optional[int] = None,
        response: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message, "RATE_LIMIT_ERROR", 429, response)
        self.retry_after = retry_after


class ValidationError(SynapseError):
    """Raised when request validation fails."""

    def __init__(
        self,
        message: str,
        field_errors: Optional[Dict[str, List[str]]] = None,
        response: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message, "VALIDATION_ERROR", 422, response)
        self.field_errors = field_errors


class ServerError(SynapseError):
    """Raised when server returns an error."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        response: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message, "SERVER_ERROR", status_code, response)


class TimeoutError(SynapseError):
    """Raised when request times out."""

    def __init__(self, message: str = "Request timeout"):
        super().__init__(message, "TIMEOUT_ERROR", 408)


# ============= MAIN SDK CLASS =============

T = TypeVar("T")


class SynapseSDK:
    """Async SDK for Synapse AI API."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.synapse.ai/v1",
        timeout: float = 60.0,
        retries: int = 3,
        version: str = "v1",
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.retries = retries
        self.version = version
        self._session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session."""
        if self._session is None or self._session.closed:
            timeout = ClientTimeout(total=self.timeout)
            self._session = aiohttp.ClientSession(
                timeout=timeout,
                headers=self._get_headers(),
            )
        return self._session

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "X-Synapse-Version": self.version,
            "X-Synapse-SDK": "python",
        }

    async def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        attempt: int = 1,
    ) -> Dict[str, Any]:
        """Make HTTP request with retry logic."""
        url = f"{self.base_url}{endpoint}"
        session = await self._get_session()

        try:
            async with session.request(method, url, json=data) as response:
                if not response.ok:
                    await self._handle_error(response)

                return await response.json()

        except asyncio.TimeoutError:
            if attempt < self.retries:
                await asyncio.sleep(2 ** attempt)
                return await self._request(method, endpoint, data, attempt + 1)
            raise TimeoutError()

        except ClientError as e:
            if attempt < self.retries:
                await asyncio.sleep(2 ** attempt)
                return await self._request(method, endpoint, data, attempt + 1)
            raise SynapseError(str(e), "REQUEST_ERROR")

    async def _handle_error(self, response: aiohttp.ClientResponse) -> None:
        """Handle error responses."""
        try:
            body = await response.json()
        except:
            body = {}

        error_msg = body.get("error", {}).get("message", f"HTTP {response.status}")

        if response.status == 401:
            raise AuthenticationError(error_msg, body)
        elif response.status == 429:
            retry_after = response.headers.get("Retry-After")
            raise RateLimitError(
                error_msg,
                int(retry_after) if retry_after else None,
                body,
            )
        elif response.status == 422:
            field_errors = body.get("error", {}).get("fieldErrors")
            raise ValidationError(error_msg, field_errors, body)
        elif response.status >= 500:
            raise ServerError(error_msg, response.status, body)
        else:
            raise SynapseError(error_msg, "API_ERROR", response.status, body)

    # ============= CORE API METHODS =============

    async def chat_completion(self, request: CompletionRequest) -> CompletionResponse:
        """Create a chat completion."""
        data = await self._request("POST", "/chat/completions", request.to_dict())
        return CompletionResponse.from_dict(data)

    async def stream_chat_completion(
        self, request: CompletionRequest
    ) -> AsyncGenerator[StreamChunk, None]:
        """Stream a chat completion."""
        stream_request = CompletionRequest(**{**request.__dict__, "stream": True})
        url = f"{self.base_url}/chat/completions"
        session = await self._get_session()

        async with session.post(url, json=stream_request.to_dict()) as response:
            if not response.ok:
                await self._handle_error(response)

            async for line in response.content:
                line = line.decode("utf-8").strip()
                if not line or line == "data: [DONE]":
                    continue

                if line.startswith("data: "):
                    try:
                        json_data = json.loads(line[6:])
                        yield StreamChunk(
                            id=json_data["id"],
                            object=json_data["object"],
                            created=json_data["created"],
                            model=json_data["model"],
                            choices=[
                                StreamChoice(
                                    index=c["index"],
                                    delta=c["delta"],
                                    finish_reason=c.get("finishReason"),
                                )
                                for c in json_data.get("choices", [])
                            ],
                        )
                    except json.JSONDecodeError:
                        continue

    async def create_embedding(self, request: EmbeddingRequest) -> EmbeddingResponse:
        """Create embeddings."""
        data = await self._request("POST", "/embeddings", request.to_dict())
        return EmbeddingResponse.from_dict(data)

    # ============= MODEL MANAGEMENT =============

    async def list_models(self) -> List[ModelInfo]:
        """List available models."""
        data = await self._request("GET", "/models")
        return [ModelInfo.from_dict(m) for m in data]

    async def get_model(self, model_id: str) -> ModelInfo:
        """Get model information."""
        data = await self._request("GET", f"/models/{model_id}")
        return ModelInfo.from_dict(data)

    async def is_model_available(self, model_id: str) -> bool:
        """Check if a model is available."""
        try:
            model = await self.get_model(model_id)
            return model.status == ModelStatus.ACTIVE
        except SynapseError:
            return False

    # ============= BATCH PROCESSING =============

    async def batch_completions(
        self,
        requests: List[CompletionRequest],
        concurrency: int = 5,
        on_progress: Optional[Callable[[int, int], None]] = None,
    ) -> List[Union[CompletionResponse, SynapseError]]:
        """Process multiple completions in parallel with concurrency control."""
        semaphore = asyncio.Semaphore(concurrency)
        completed = 0

        async def process_single(
            req: CompletionRequest,
        ) -> Union[CompletionResponse, SynapseError]:
            nonlocal completed
            async with semaphore:
                try:
                    result = await self.chat_completion(req)
                    completed += 1
                    if on_progress:
                        on_progress(completed, len(requests))
                    return result
                except SynapseError as e:
                    completed += 1
                    if on_progress:
                        on_progress(completed, len(requests))
                    return e

        tasks = [process_single(req) for req in requests]
        return await asyncio.gather(*tasks)

    async def create_embeddings_batch(
        self,
        inputs: List[str],
        model: str,
        batch_size: int = 100,
        concurrency: int = 5,
    ) -> List[EmbeddingResponse]:
        """Create embeddings for multiple inputs in batches."""
        semaphore = asyncio.Semaphore(concurrency)
        results: List[EmbeddingResponse] = []

        async def process_batch(batch: List[str]) -> None:
            async with semaphore:
                response = await self.create_embedding(
                    EmbeddingRequest(model=model, input=batch)
                )
                results.append(response)

        batches = [inputs[i : i + batch_size] for i in range(0, len(inputs), batch_size)]
        await asyncio.gather(*[process_batch(batch) for batch in batches])

        # Sort results by index
        all_embeddings: List[EmbeddingData] = []
        for resp in results:
            all_embeddings.extend(resp.data)
        all_embeddings.sort(key=lambda x: x.index)

        return [
            EmbeddingResponse(
                object="list",
                data=all_embeddings,
                model=model,
                usage=UsageInfo(0, 0, 0),  # Aggregated usage would require summing
            )
        ]

    async def batch_with_retry(
        self,
        items: List[T],
        processor: Callable[[T], Coroutine[Any, Any, Any]],
        concurrency: int = 5,
        max_retries: int = 3,
    ) -> List[Any]:
        """Process items with automatic retry for failures."""
        semaphore = asyncio.Semaphore(concurrency)
        results: List[Any] = [None] * len(items)

        async def process_with_retry(index: int, item: T, attempt: int = 0) -> None:
            async with semaphore:
                try:
                    results[index] = await processor(item)
                except Exception as e:
                    if attempt < max_retries:
                        await asyncio.sleep(2 ** attempt)
                        await process_with_retry(index, item, attempt + 1)
                    else:
                        results[index] = e

        await asyncio.gather(
            *[process_with_retry(i, item) for i, item in enumerate(items)]
        )
        return results

    # ============= USAGE & ANALYTICS =============

    async def get_usage(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> UsageStats:
        """Get usage statistics."""
        params: Dict[str, str] = {}
        if start_date:
            params["start"] = start_date.isoformat()
        if end_date:
            params["end"] = end_date.isoformat()

        query = "&".join([f"{k}={v}" for k, v in params.items()])
        endpoint = f"/usage?{query}" if query else "/usage"

        data = await self._request("GET", endpoint)
        return UsageStats(
            period=data["period"],
            total_requests=data["totalRequests"],
            total_tokens=data["totalTokens"],
            cost=data["cost"],
            models={
                k: ModelUsage(
                    requests=v["requests"],
                    tokens=v["tokens"],
                    cost=v["cost"],
                )
                for k, v in data.get("models", {}).items()
            },
        )

    # ============= WEBHOOKS =============

    async def register_webhook(
        self, url: str, events: List[str], secret: Optional[str] = None
    ) -> Dict[str, str]:
        """Register a webhook."""
        data = {"url": url, "events": events}
        if secret:
            data["secret"] = secret
        return await self._request("POST", "/webhooks", data)

    async def list_webhooks(self) -> List[Dict[str, Any]]:
        """List registered webhooks."""
        return await self._request("GET", "/webhooks")

    async def delete_webhook(self, webhook_id: str) -> None:
        """Delete a webhook."""
        await self._request("DELETE", f"/webhooks/{webhook_id}")

    # ============= CONTEXT MANAGER =============

    async def close(self) -> None:
        """Close the HTTP session."""
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None

    async def __aenter__(self) -> "SynapseSDK":
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        await self.close()


# ============= JUPYTER INTEGRATION =============

class JupyterIntegration:
    """Integration utilities for Jupyter notebooks."""

    def __init__(self, sdk: SynapseSDK):
        self.sdk = sdk

    async def chat(
        self,
        message: str,
        model: str = "gpt-4",
        system: Optional[str] = None,
        **kwargs: Any,
    ) -> str:
        """Simple chat interface for Jupyter."""
        messages = []
        if system:
            messages.append(Message(role=MessageRole.SYSTEM, content=system))
        messages.append(Message(role=MessageRole.USER, content=message))

        response = await self.sdk.chat_completion(
            CompletionRequest(model=model, messages=messages, **kwargs)
        )
        return response.choices[0].message.content or ""

    async def chat_stream(
        self,
        message: str,
        model: str = "gpt-4",
        system: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Streaming chat for Jupyter."""
        from IPython.display import display, clear_output

        messages = []
        if system:
            messages.append(Message(role=MessageRole.SYSTEM, content=system))
        messages.append(Message(role=MessageRole.USER, content=message))

        full_content = ""
        async for chunk in self.sdk.stream_chat_completion(
            CompletionRequest(model=model, messages=messages)
        ):
            delta = chunk.choices[0].delta.get("content", "")
            if delta:
                full_content += delta
                clear_output(wait=True)
                display(full_content)
                yield delta

    async def embed(
        self,
        texts: Union[str, List[str]],
        model: str = "text-embedding-3-small",
    ) -> Union[List[float], List[List[float]]]:
        """Create embeddings with automatic batching."""
        if isinstance(texts, str):
            response = await self.sdk.create_embedding(
                EmbeddingRequest(model=model, input=texts)
            )
            return response.data[0].embedding

        responses = await self.sdk.create_embeddings_batch(texts, model)
        all_embeddings = []
        for resp in responses:
            all_embeddings.extend([d.embedding for d in resp.data])
        return all_embeddings

    def display_usage(self, usage: UsageStats) -> None:
        """Display usage statistics in a nice format."""
        try:
            from IPython.display import HTML, display

            html = f"""
            <div style="padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                <h4>Usage Statistics - {usage.period}</h4>
                <table style="width: 100%;">
                    <tr><td><b>Total Requests:</b></td><td>{usage.total_requests:,}</td></tr>
                    <tr><td><b>Total Tokens:</b></td><td>{usage.total_tokens:,}</td></tr>
                    <tr><td><b>Total Cost:</b></td><td>${usage.cost:.2f}</td></tr>
                </table>
                <h5>By Model:</h5>
                <table style="width: 100%;">
                    <tr><th>Model</th><th>Requests</th><th>Tokens</th><th>Cost</th></tr>
            """
            for model, stats in usage.models.items():
                html += f"""
                    <tr>
                        <td>{model}</td>
                        <td>{stats.requests:,}</td>
                        <td>{stats.tokens:,}</td>
                        <td>${stats.cost:.2f}</td>
                    </tr>
                """
            html += "</table></div>"
            display(HTML(html))
        except ImportError:
            # Fallback for non-Jupyter environments
            print(f"Usage - {usage.period}")
            print(f"  Requests: {usage.total_requests:,}")
            print(f"  Tokens: {usage.total_tokens:,}")
            print(f"  Cost: ${usage.cost:.2f}")


# ============= CONVENIENCE FUNCTIONS =============

def create_client(
    api_key: str,
    base_url: str = "https://api.synapse.ai/v1",
    **kwargs: Any,
) -> SynapseSDK:
    """Create a new Synapse SDK client."""
    return SynapseSDK(api_key=api_key, base_url=base_url, **kwargs)