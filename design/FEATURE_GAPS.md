# Feature Gap Analysis

**Date**: 2026-04-17
**Last updated**: 2026-04-17
**Method**: Competitive comparison vs ChatGPT, Claude.ai, Paperclip, CrewAI + user flow walkthroughs

---

## FIXED (17 items closed this session)

| # | Gap | Fix |
|---|-----|-----|
| 1 | No markdown rendering | react-markdown + remark-gfm + prose styling |
| 2 | No stop generating button | AbortController + red stop icon |
| 5 | No copy button on responses | Hover-reveal clipboard copy |
| 12 | No task filter/search | Search input + priority + assignee dropdowns |
| 16 | No notification badge | Red count badge on Approvals nav |
| 18 | No password change UI | Settings > General + PATCH /api/auth/password |
| 19 | No post-setup API key management | Models > API Keys tab (add/rotate/delete) |
| 22 | No keyboard shortcuts | Cmd+K, Cmd+1-9, Escape |
| 24 | Image files read as text | Base64 encoding for binary files |
| -- | No file browser | Files view with browse, preview, upload |
| -- | No file attachments in chat | Paperclip button + inline content |
| -- | No logout button | Sidebar footer sign-out icon |
| -- | No login error messages | Red alert box with specific messages |
| -- | Login redirect loop | Cookie recovery + form hydration fix |
| -- | Session cookie Secure flag on HTTP | SECURE_COOKIES env var |
| -- | Skills definitions empty | 23 skills populated with real definitions |
| -- | No Models Sandbox | Test any model with prompt presets |

## REMAINING -- CRITICAL (2)

| # | Gap | Location | Effort |
|---|-----|----------|--------|
| 11 | **No Kanban drag-and-drop** | `kanban-board.tsx` | Medium (add @hello-pangea/dnd) |
| 21 | **No global search modal** (Cmd+K opens chat, not search) | `shell.tsx` + new `/api/search` | Medium |

## REMAINING -- HIGH (7)

| # | Gap | Location | Effort |
|---|-----|----------|--------|
| 3 | No multi-conversation per agent | `chat-panel.tsx` + conversations API | Medium |
| 4 | No clipboard image paste (Ctrl+V) | `chat-panel.tsx` onPaste handler | Small |
| 8 | No agent pause/resume from dashboard | `agent-roster.tsx` heartbeat toggle | Small |
| 9 | No live run view (watch agent in progress) | `agent-profile.tsx` + SSE endpoint | Medium |
| 13 | No task due dates | `db/schema.ts` + task UIs | Small |
| 20 | No system/bridge logs view in UI | Settings tab + bridge logs endpoint | Medium |
| 23 | No onboarding guidance for new installs | `dashboard-home.tsx` first-run checklist | Small |

## REMAINING -- MEDIUM (6)

| # | Gap | Location | Effort |
|---|-----|----------|--------|
| 6 | No edit/retry on chat messages | `chat-panel.tsx` | Small |
| 7 | No token count per message in chat | Bridge done event + chat UI | Small |
| 10 | No tool permission config per agent | `agent-profile.tsx` config tab | Medium |
| 14 | No task file attachments | `task-detail.tsx` | Small |
| 15 | No task dependencies (blocking/blocked-by) | `db/schema.ts` + task UIs | Medium |
| 25 | No loading skeleton on initial page fetch | `page.tsx` | Small |

## REMAINING -- LOW (3)

| # | Gap | Location | Effort |
|---|-----|----------|--------|
| 17 | 30s polling on dashboard (no real-time push) | `dashboard-home.tsx` | Medium |
| -- | Contextual help tooltips on forms/fields | Various components | Small |
| -- | Bilingual: new UI strings not translated to FR | Various components | Medium |

## FEATURE REQUESTS (from CEO)

| Feature | Priority | Status |
|---------|----------|--------|
| Skills/Command Directory | HIGH | DONE (upgraded with search + definitions) |
| Models Sandbox | HIGH | DONE (Models > Sandbox tab) |
| Kanban drag-and-drop | CRITICAL | TODO |
| Global search (Cmd+K modal) | CRITICAL | TODO |
| Help tooltips on key UI elements | LOW | PARTIAL (nav done, forms pending) |

## SECURITY BACKLOG

See `design/SECURITY_BACKLOG.md` for 3 medium + 3 low security items.

## TOKEN ECONOMICS

See `design/TOKEN_ECONOMICS.md` for optimization strategy and implementation status.
