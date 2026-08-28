# 0006. headless_core partialOutput is mixed delta/cumulative

## Status

Accepted

## Context

`taiyop/headless_core` `runCommand` passes stdout/stderr **chunks** to `onProgress` during `running`. On `completed` / `failed` it passes the **full** accumulated output.

## Decision

The example backend:

- ignores `completed` / `failed` snapshots for streaming
- treats a value that starts with the previous accumulation as cumulative
- treats other values as deltas
- drops shrinking values so text is not replayed

Tests assert that streamed deltas plus any remainder equal the final `run()` string without duplication.
