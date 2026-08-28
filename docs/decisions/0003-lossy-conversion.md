# 0003. Lossy conversion policy

## Status

Accepted

## Decision

Default policy is `error` for features the backend does not declare (tools, images, structured output, reasoning, streaming). Unknown fields use `preserve` via `raw` and `extensions`. `best-effort` dropping is opt-in only.

## Why

Silent degradation makes local debugging lie. A backend that cannot call tools must not look like it ignored `tools`.
