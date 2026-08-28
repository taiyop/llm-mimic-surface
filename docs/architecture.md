# Architecture

`llm-mimic-surface` is an **External API Interface layer**. It is not an LLM core, proxy, router, or agent runtime.

```text
Client
  │
  ▼
Transport
HTTP / SSE
  │
  ▼
Protocol Adapter
OpenAI / Anthropic / Gemini / xAI / Custom
  │
  ▼
Boundary Contract
  │
  ▼
Backend SPI
  │
  ▼
User supplied backend
```

```mermaid
flowchart TD
    Client[Client SDK / curl] --> Transport[HTTP / SSE transport]
    Transport --> OpenAI[OpenAI adapter]
    Transport --> Anthropic[Anthropic adapter]
    Transport --> Gemini[Gemini adapter]
    Transport --> XAI[xAI dialect]
    Transport --> Custom[Custom adapter]
    OpenAI --> Boundary[Boundary contract]
    Anthropic --> Boundary
    Gemini --> Boundary
    XAI --> Boundary
    Custom --> Boundary
    Boundary --> SPI[Backend SPI]
    SPI --> Mock[Mock / echo]
    SPI --> Headless[headless_core example]
    SPI --> Other[Any core / agent / runtime]
```

## Layers

| Layer | Responsibility | Must not do |
| --- | --- | --- |
| Transport | HTTP, SSE, CORS, request IDs, AbortSignal, timeouts | Understand provider APIs |
| Protocol adapter | Decode/encode wire format | Call an LLM provider |
| Boundary | Shared request/response/event contract | Become an LLM core |
| Backend SPI | Invoke user code | See Fastify or protocol SSE events |

**Protocol Adapter ≠ Provider Adapter.** A protocol adapter exposes an external API shape. A provider adapter would call OpenAI/Anthropic/Gemini/xAI with API keys. Provider adapters are out of scope.

## Streaming

Backends emit `InvocationEvent` values. Each protocol adapter converts those events to its own SSE/JSON stream. Protocol-specific event names never leak into the backend.

## Route collision

OpenAI and xAI default to `/v1/chat/completions`, `/v1/responses`, and `/v1/models`. Registering both without prefixes throws `RouteCollisionError`. Use prefixes such as `/openai` and `/xai`.
