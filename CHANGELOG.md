# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-28

### Added

- External API Interface layer with a Backend SPI
- Protocol Adapter Framework
- OpenAI-compatible subset: `POST /v1/chat/completions`, `POST /v1/responses`, `GET /v1/models`
- Anthropic-compatible subset: `POST /v1/messages`
- Gemini-compatible subset: `POST /v1beta/models/:model:generateContent` and `:streamGenerateContent`
- xAI / Grok protocol dialect sharing the OpenAI-compatible codec
- Custom protocol API (`createProtocolAdapter`, `createSimpleProtocol`)
- Fastify route plugin with HTTP/SSE serialization and client-disconnect `AbortSignal`
- Optional `llm-mimic-surface/standalone` convenience entry point
- Host-owned server lifecycle, bind/TLS, authentication, middleware, logging, limits, and timeouts
- Mock / echo backend
- CLI: `llm-mimic-surface serve`
- Example backend for `headless_core`
