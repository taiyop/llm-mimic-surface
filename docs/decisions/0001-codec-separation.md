# 0001. Codec and adapter separation

## Status

Accepted

## Decision

Protocol conversion is implemented as pure codecs (`decodeRequest`, `encodeResponse`, `encodeEvent`, `encodeError`). Adapters only register HTTP routes against a framework-agnostic `RouteRegistrar`.

## Why

- Codecs can be golden-tested without starting Fastify.
- Fastify types never reach backends.
- Custom protocols can reuse dispatch/SSE without copying HTTP glue.
