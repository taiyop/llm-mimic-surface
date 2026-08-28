# Protocol Adapter Framework

A protocol adapter is a plugin that maps one external API onto the boundary contract.

```ts
export interface ProtocolAdapter {
  readonly id: string;
  readonly version: string;
  registerRoutes(registrar: RouteRegistrar, backend: ExternalApiBackend, options?: ProtocolOptions): void;
  capabilities(): ProtocolCapabilities;
}
```

Codecs are pure functions so they can be tested without Fastify:

```ts
decodeRequest(raw, meta) → InvocationRequest
encodeResponse(response, request) → wire JSON
encodeEvent(event, state) → EncodedStreamEvent
encodeError(error) → EncodedError
```

## Built-in adapters

| Adapter | Default paths | Notes |
| --- | --- | --- |
| `openAIProtocol()` | `/v1/chat/completions`, `/v1/responses`, `/v1/models` | OpenAI-compatible subset |
| `xaiProtocol()` | same as OpenAI | Separate dialect; shares `openai-compatible` codecs |
| `anthropicProtocol()` | `/v1/messages` | Messages API subset |
| `geminiProtocol()` | `/v1beta/models/:model:generateContent` | generateContent subset |
| `createSimpleProtocol()` | `/api/generate` | Example custom protocol |

xAI API shares significant compatibility with the OpenAI API, but is implemented as a separate protocol dialect so that xAI-specific capabilities can be preserved.

## Custom adapters

```ts
createProtocolAdapter({
  id: "ping",
  registerRoutes(registrar, backend) {
    registrar.route({
      method: "GET",
      path: "/ping",
      protocolId: "ping",
      encodeError: (error) => ({ status: error.status, body: { error: error.message } }),
      handler: async (_req, reply) => reply.send({ pong: true })
    });
  }
});
```

Adapters receive a framework-agnostic `RouteRegistrar`. Only the HTTP transport depends on Fastify.
