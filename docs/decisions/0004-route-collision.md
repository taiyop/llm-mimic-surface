# 0004. Route collision is an error

## Status

Accepted

## Decision

Registering two routes with the same method and path throws `RouteCollisionError`. Last-write-wins is forbidden.

## Why

OpenAI and xAI share `/v1/*`. Overwriting one with the other would look like a working dual-protocol server while one client is silently mishandled.
