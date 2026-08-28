# 0005. Gemini colon paths

## Status

Accepted

## Decision

Gemini is registered as `POST /v1beta/models/:modelAction`. The handler splits `:generateContent` / `:streamGenerateContent` from the model id.

## Why

The official path is `/v1beta/models/{model}:generateContent`. Fastify parameters stop at `/`, so the colon stays inside `:modelAction`.
