# Feature Gap Analysis

**Date**: 2026-04-17
**Last updated**: 2026-04-18
**Status**: All gaps closed. Soul Engine complete. Model Governance enforced. Connectors wired.

---

## FIXED (All items closed)

### v1.0 Sprint (33 feature gaps)
All original competitive gaps closed. See CHANGELOG.md v1.0.0.

### v1.0+ (Post-release, all closed)

| Item | Fix |
|------|-----|
| Soul Engine Layer 1 | Guided Soul Builder (7-step, structured personas, versioning, personaText generation) |
| Soul Engine Layer 2 | Feedback thumbs, pulse checks, persona proposals, Refinement Engine (LLM auto-analysis) |
| Soul Engine Layer 3 | Autonomous self-evaluation after heartbeat runs |
| Refinement Engine | LLM aggregates 30 days of feedback + self-evals -> structured proposals -> approval workflow |
| Model Governance | Admin selects allowed models, provider dedup, enforced at router + UI level |
| Agent Escalation | request_approval + report_blocked MCP tools (22 tools total) |
| Email Notifications | Nodemailer on approval/escalation creation (branded HTML templates) |
| Connector Credentials | connectionConfig injected into agent persona for real API calls |
| Session Rotation | 24h sliding window token refresh |
| ConversationId storage | Both user + assistant messages tagged for multi-conversation |
| Model Sandbox override | Selected model actually used (not ignored) |
| Tool Permissions enforcement | Bridge reads + passes allowedTools to CLI |
| Soul Builder save fix | personaText generated from structured persona (was 400) |
| GPT-5.4 family | Updated to current OpenAI models |

## REMAINING (v1.2 backlog)

| Item | Priority | Notes |
|------|----------|-------|
| Server-side full-text search | LOW | Currently client-side against in-memory state |
| Dedicated connector adapters | LOW | Current: LLM uses credentials via persona. Future: native HTTP/DB adapters |

## SECURITY BACKLOG

All items closed.
