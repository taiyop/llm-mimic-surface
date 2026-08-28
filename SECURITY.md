# Security

## Supported versions

Security fixes are accepted for the latest `0.x` release.

## Reporting a vulnerability

Please open a private report on GitHub or email the maintainer. Do not file a public issue for credential leaks or remote-code-execution reports.

## Host application boundary

- LLMMimicSurface does not bind a socket or own TLS, authentication, CORS, global middleware, or application logging.
- The host application must set a safe bind address, authenticate requests, configure limits/timeouts, and avoid logging secrets.
- Client disconnects abort the signal passed to the backend.
- The standalone CLI binds to `127.0.0.1` unless the operator explicitly supplies another host.

## What this project does not do

This package does not store or rotate LLM provider credentials. Host authentication tokens and provider credentials must be treated as secrets and never printed.
