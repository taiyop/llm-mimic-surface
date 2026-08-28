# Contributing

Thank you for contributing.

## Development

Requires Node.js 20+.

```sh
npm install
npm run check
```

`npm run check` runs lint, typecheck, tests, and build.

## Design rules

- Protocol adapters convert wire protocols to the boundary contract. They are not LLM provider adapters.
- Do not add provider API key management, model routing, RAG, or agent runtimes to this package.
- Keep Fastify types out of the Backend SPI.
- Keep protocol-specific SSE events out of the backend.
- Preserve unknown fields through `raw` / `extensions` instead of dropping them.
- Unsupported backend features must return a protocol error, not a silent fallback.
- OpenAI and xAI must share `src/protocol/openai-compatible/` instead of copying codecs.
- Registering OpenAI and xAI on the same prefix must fail with a route collision error.

## Tests

Add fixture-based decode/encode tests for every protocol change. If a field is shared between OpenAI and xAI, still add an xAI-specific fixture.

SDK integration tests live in `test/integration/` and talk to a localhost server backed by `MockBackend`.

## Pull requests

1. Keep the public API small.
2. Record non-obvious decisions in `docs/decisions/`.
3. Update `CHANGELOG.md` and compatibility notes when the supported subset changes.
