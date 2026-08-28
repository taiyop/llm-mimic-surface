# Backend SPI

The backend is the only place application logic belongs.

```ts
export interface ExternalApiBackend {
  invoke(request: InvocationRequest, context: InvocationContext): Promise<InvocationResponse>;
  stream?(request: InvocationRequest, context: InvocationContext): AsyncIterable<InvocationEvent>;
  listModels?(context: InvocationContext): Promise<ModelInfo[]>;
  capabilities?(): BackendCapabilities;
}
```

`InvocationContext` contains `requestId`, `AbortSignal`, redacted-safe headers, protocol id, and remote address. It never contains Fastify request/reply objects.

## Capabilities

If a request needs tools, images, structured output, reasoning, or streaming and the backend does not declare that capability, the protocol adapter returns a protocol-specific error. Fields are not silently dropped.

When `capabilities()` is omitted:

- `streaming` is true only if `stream()` exists
- `input.text` is true
- tools, images, files, reasoning, and structured output are false

## Mock backend

`createEchoBackend()` / `MockBackend` are included so protocol tests do not need `headless_core` or any LLM.

## headless_core

`headless_core` is an example backend, not a runtime dependency. See `examples/headless-core/`.
