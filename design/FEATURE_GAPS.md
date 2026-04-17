# Feature Gap Analysis

**Date**: 2026-04-17
**Method**: Competitive comparison vs ChatGPT, Claude.ai, Paperclip, CrewAI + user flow walkthroughs
**Status**: Active backlog -- fixing in priority order

## CRITICAL (5)

| # | Gap | Location | Status |
|---|-----|----------|--------|
| 1 | No markdown rendering in chat responses | `chat-panel.tsx` BlockRenderer | TODO |
| 2 | No "stop generating" button | `chat-panel.tsx` streaming UI | TODO |
| 11 | No Kanban drag-and-drop | `kanban-board.tsx` | TODO |
| 18 | No password change UI | `page.tsx` settings + users API | TODO |
| 21 | No global search (Cmd+K) | `shell.tsx` + new search API | TODO |

## HIGH (12)

| # | Gap | Location | Status |
|---|-----|----------|--------|
| 3 | No multi-conversation per agent | chat + messages API | TODO |
| 4 | No clipboard image paste in chat | `chat-panel.tsx` onPaste | TODO |
| 5 | No copy button on responses | `chat-panel.tsx` BlockRenderer | TODO |
| 8 | No agent pause/resume from surface | `agent-roster.tsx`, dashboard | TODO |
| 9 | No live run view (watch agent working) | `agent-profile.tsx` runs tab | TODO |
| 12 | No task filter/search | `kanban-board.tsx` | TODO |
| 13 | No task due dates | `db/schema.ts` + task UIs | TODO |
| 16 | No notification/approval badge in nav | `shell.tsx` | TODO |
| 19 | No post-setup API key management | `model-config.tsx` + providers API | TODO |
| 20 | No system logs view | settings + bridge logs endpoint | TODO |
| 22 | No keyboard shortcuts | `shell.tsx` global handler | TODO |
| 23 | No onboarding guidance after setup | `dashboard-home.tsx` | TODO |

## MEDIUM (8)

| # | Gap | Location | Status |
|---|-----|----------|--------|
| 6 | No edit/retry on messages | `chat-panel.tsx` | TODO |
| 7 | No token count per message | bridge done event + chat UI | TODO |
| 10 | No tool permission config per agent | `agent-profile.tsx` config tab | TODO |
| 14 | No task file attachments | `task-detail.tsx` | TODO |
| 15 | No task dependencies | `db/schema.ts` + task UIs | TODO |
| 17 | 30s polling (no real-time push) | `dashboard-home.tsx` | TODO |
| 24 | Image files read as text in chat | `chat-panel.tsx` handleSend | TODO |
| 25 | No loading skeleton on initial fetch | `page.tsx` | TODO |

## FEATURE REQUESTS (from CEO)

| Feature | Priority | Status |
|---------|----------|--------|
| Skills/Command Directory (browsable catalog) | HIGH | TODO |
| Models Sandbox (test any model via OpenRouter) | HIGH | TODO |
