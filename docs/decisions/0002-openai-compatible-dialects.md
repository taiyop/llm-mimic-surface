# 0002. OpenAI-compatible dialects

## Status

Accepted

## Decision

OpenAI and xAI share `src/protocol/openai-compatible/` and differ through a `OpenAICompatibleDialect`. Public constructors remain `openAIProtocol()` and `xaiProtocol()`.

## Why

xAI's HTTP API overlaps Chat Completions and Responses, but copying the codec would drift. A dialect keeps shared parsing in one place while preserving xAI fields such as `search_parameters` and server-side tools in `extensions.xai`.
