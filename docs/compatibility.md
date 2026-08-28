# Compatibility

This project implements **compatible subsets**, not complete clones of vendor APIs. Do not describe it as "fully compatible".

Sources checked while implementing v0.1 (2026-08-28):

- OpenAI Chat Completions and Responses API references (`developers.openai.com`)
- Anthropic Messages API (`platform.claude.com/docs/en/api/messages`)
- Gemini `generateContent` / `streamGenerateContent` (`ai.google.dev/api`)
- xAI Chat Completions and Responses (`docs.x.ai`)

## OpenAI-compatible subset

Supported:

- `POST /v1/chat/completions` (non-stream and SSE)
- `POST /v1/responses` (non-stream and SSE)
- `GET /v1/models`
- text messages, image_url parts, function tools, basic `response_format`, `reasoning_effort`

Not supported in v0.1:

- stored conversation state / `previous_response_id` execution
- audio, moderation, embeddings, images generation, realtime
- `n > 1`
- Assistants API

## Anthropic-compatible subset

Supported: `POST /v1/messages` with `system`, `messages`, content blocks, `max_tokens`, `temperature`, `tools`, `tool_choice`, `stream`.

Not supported: batches, files API, token counting, complete server-tool result round-trips.

## Gemini-compatible subset

Supported: `POST /v1beta/models/{model}:generateContent` and `:streamGenerateContent`, including `alt=sse`.

Mapped: `contents`, `parts`, `systemInstruction`, `generationConfig`, function declarations.

Not supported: Live API, embeddings, file upload endpoints, tuned-model management.

## xAI / Grok subset

Supported: Chat Completions, Responses, Models. Server-side tools (`web_search`, `x_search`, `code_interpreter`) are preserved as `ProviderTool` / `extensions.xai` rather than rewritten as function tools.

Not supported: deferred completions polling, Collections, image generation endpoints.
