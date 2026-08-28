# headless_core backend example

This example is **not** part of the published package. `headless_core` is one possible backend, not a required dependency of `llm-mimic-surface`.

```text
OpenAI SDK
  → Fastify host
  → LLMMimicSurface plugin
  → HeadlessCoreBackend
  → @headless-core/core
  → Codex / Claude Code / Grok CLI
```

## Setup

```sh
npm install @headless-core/core
```

The corresponding Agent CLI must be installed locally.

The example owns Fastify and its `listen()` lifecycle. `HeadlessCoreBackend` is the adapter between the LLMMimicSurface `ExternalApiBackend` contract and `headless_core`; the library itself does not import `headless_core`.

## Run

From the repository root, after `npm run build`:

```sh
npx tsx examples/headless-core/server.ts
```

Then:

```ts
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://127.0.0.1:8080/v1",
  apiKey: "dummy"
});

const completion = await client.chat.completions.create({
  model: "codex/default",
  messages: [{ role: "user", content: "Say hello in one line." }]
});
```

## Capabilities

This backend is text-in / text-out:

| Feature | Supported |
| --- | --- |
| Streaming via `onProgress` | yes |
| AbortSignal / timeout | yes |
| Tools | no |
| Image / file input | no |
| Structured output | no |

Unsupported features return protocol errors instead of being silently ignored.

`partialOutput` from headless_core is a stdout chunk while `state === "running"` and the full output on `completed`. The example converts that into SSE deltas without duplicating text.
