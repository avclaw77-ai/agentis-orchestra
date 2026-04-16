# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in AgentisOrchestra, please report it responsibly:

**Email:** alex@agentislab.ai

**Do NOT open a public GitHub issue for security vulnerabilities.**

We will acknowledge receipt within 48 hours and provide a timeline for a fix.

## Security Model

### Authentication
- Admin accounts use scrypt password hashing (CPU+memory-hard)
- Sessions are httpOnly cookies with SHA-256 token hashing
- Session expiry: 30 days

### Encryption
- Provider API keys encrypted at rest with AES-256-GCM
- Encryption key stored as environment variable, never in database
- IV and auth tag stored alongside ciphertext

### Network
- Bridge and MCP server authenticate via BRIDGE_TOKEN
- Production deploy uses Caddy for automatic TLS
- Database port not exposed in production compose

### Execution
- Plugin system uses Worker thread isolation
- CLI adapter spawns processes as non-root user in Docker
- Heartbeat engine has budget pre-checks to prevent runaway cost

## Supported Versions

| Version | Supported |
|---------|-----------|
| main branch | Yes |
| Tagged releases | Yes |
| Older commits | No |
