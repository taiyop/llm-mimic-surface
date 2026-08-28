# Security

## Supported versions

Security fixes are accepted for the latest `0.x` release.

## Reporting a vulnerability

Please open a private report on GitHub or email the maintainer. Do not file a public issue for credential leaks or remote-code-execution reports.

## Local server defaults

- The HTTP server binds to `127.0.0.1` unless a host is set explicitly.
- Binding to `0.0.0.0` is never implied.
- Request bodies, prompts, file contents, and API keys are not logged by default.
- Authorization headers are redacted in any hook metadata you choose to log.
- Local `auth: false` is intended for development only.

## What this project does not do

This package does not store or rotate LLM provider credentials. If you enable bearer auth on the local server, treat those tokens as secrets and never print them.
