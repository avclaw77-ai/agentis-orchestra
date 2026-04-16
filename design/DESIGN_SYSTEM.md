# AgentisOrchestra -- Design System

> The visual identity and UX framework for an open-source multi-agent orchestration platform.
> Audience: SME CEOs, ops managers, team leads. Not developers.

---

## 1. Brand Identity

### Name & Metaphor

**AgentisOrchestra** carries the right metaphor. An orchestra is coordinated autonomous performers working under a conductor toward a shared outcome. That maps perfectly to the product: departments as sections, agents as musicians, the CEO as conductor. Lean into the orchestral metaphor subtly -- not with musical notes and treble clefs, but with language: "compose routines," "conduct your team," "in concert."

The visual identity should feel like **a command center for a well-run organization**, not a music app.

### Color Palette

**Recommendation: Evolve from Cockpit's sky blue to a deeper, more authoritative palette.**

Cockpit is an internal tool. Orchestra is a product -- it needs to feel owned, not inherited.

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#1E40AF` (deep blue 700) | Primary actions, active nav, CTAs |
| `--primary-hover` | `#1E3A8A` (deep blue 800) | Hover states |
| `--primary-light` | `#DBEAFE` (blue 100) | Backgrounds, badges, selected states |
| `--primary-lighter` | `#EFF6FF` (blue 50) | Subtle tints |
| `--background` | `#F8FAFC` (slate 50) | Page background |
| `--card` | `#FFFFFF` | Cards, modals, panels |
| `--foreground` | `#0F172A` (slate 900) | Primary text |
| `--muted-foreground` | `#64748B` (slate 500) | Secondary text |
| `--border` | `#E2E8F0` (slate 200) | Borders |
| `--inset` | `#F1F5F9` (slate 100) | Inset backgrounds, input fields |
| `--destructive` | `#DC2626` (red 600) | Errors, destructive actions |
| `--success` | `#16A34A` (green 600) | Active, healthy, completed |
| `--warning` | `#D97706` (amber 600) | Warnings, thinking states |
| `--accent` | `#7C3AED` (violet 600) | Highlights, premium features, subtle differentiation |

**Rationale:** Deep blue conveys trust, authority, and professionalism. Sky blue reads "SaaS dashboard." Deep blue reads "enterprise-grade platform." The shift is subtle but meaningful for the target audience (CEOs and ops managers want gravitas, not friendliness).

### Department Color System

Six-plus departments need visual distinction without visual chaos. Use a curated palette with fixed saturation and lightness:

| Department | Dot/Badge | Background | Usage |
|------------|-----------|------------|-------|
| Engineering | `#2563EB` (blue 600) | `#DBEAFE` | Primary dept |
| Design | `#7C3AED` (violet 600) | `#EDE9FE` | Creative dept |
| Research | `#D97706` (amber 600) | `#FEF3C7` | Exploration |
| Operations | `#0891B2` (cyan 600) | `#CFFAFE` | Infrastructure |
| Sales | `#059669` (emerald 600) | `#D1FAE5` | Revenue |
| Support | `#DC2626` (red 600) | `#FEE2E2` | Customer-facing |
| Custom | `#6366F1` (indigo 600) | `#E0E7FF` | User-defined |

**Rules:**
- Department colors appear ONLY as small indicators: 12px dots, left borders on cards, badge backgrounds
- Never use department color as the primary fill of a large surface
- The card background stays white; the department color is an accent marker
- In "CEO View" (all departments), show all department dots; no single color dominates

### Typography

**Keep Manrope.** It is geometric, modern, highly legible at small sizes, and works perfectly for data-dense UIs. No change needed.

| Use | Weight | Size |
|-----|--------|------|
| Page titles | 700 (bold) | 20px / 1.25rem |
| Section headers | 600 (semibold) | 14px / 0.875rem |
| Body / labels | 500 (medium) | 14px / 0.875rem |
| Secondary text | 400 (regular) | 13px / 0.8125rem |
| Captions | 400 (regular) | 12px / 0.75rem |
| Monospace (code, IDs) | JetBrains Mono 400 | 13px |

### Icon Style

**Keep Lucide.** Consistent stroke weight, comprehensive coverage, MIT licensed. No additions needed unless we add domain-specific icons (orchestral baton for routines? No -- keep it functional).

---

## 2. Design Principles

### What It Should Feel Like

**A well-organized control room.** Not a Bloomberg terminal (too dense), not a generic SaaS dashboard (too empty). Think:

- **Linear** -- clean hierarchy, purposeful whitespace, every element earns its space
- **Vercel** -- confident minimalism, dark-on-light contrast, monospace accents for technical data
- **Notion** -- structured content, collapsible sections, information unfolds on demand

**Not:**
- Figma (too creative-tool)
- Jira (too cluttered)
- Salesforce (too enterprise-heavy)

### Information Density

**Medium-high with progressive disclosure.**

The CEO view should show a scannable overview at a glance. Details expand on click or hover. Think: newspaper layout -- headline, summary, drill-down.

- Dashboard: 4-6 summary widgets visible without scrolling
- Agent cards: 2-line summaries, expand for detail
- Task board: column headers + card titles visible, metadata on hover
- Cost data: summary numbers at top, breakdown below the fold

### The "Guided Config" UX

Setup wizards, routine builders, and agent configuration should feel:

1. **Linear** -- step-by-step, one question at a time, clear progress indicator
2. **Opinionated** -- smart defaults pre-filled, templates as starting points
3. **Forgiving** -- easy to go back, easy to skip, nothing feels permanent
4. **Educational** -- inline help text explains WHY, not just WHAT

Example: When setting a heartbeat schedule, show presets ("Every morning at 7 AM", "Every hour during business hours") above the cron input. The cron field exists for power users but is not the default interface.

### Navigation

**Switch from top bar to a sidebar layout.**

The current top bar has 7+ items and feels cramped, especially with the department selector and settings competing for space. A sidebar:

- Accommodates 10+ nav items without crowding
- Provides room for the department selector as a prominent element
- Allows collapsing to icons-only on smaller screens
- Groups related items (core views vs. config)

**Sidebar structure:**

```
[Company logo + name]
[Department selector dropdown]
---
Dashboard           (LayoutDashboard)
Agents & Chat       (MessageSquare)
Tasks               (KanbanSquare)
Goals               (Target)
Routines            (Repeat)
---
Costs               (DollarSign)
Models              (Cpu)
Settings            (Settings)
---
[User avatar + logout]
```

The sidebar should be 240px expanded, 56px collapsed (icon-only). Toggle via a button or responsive breakpoint.

---

## 3. Component Library

### Card Styles

Cards are the atomic unit. Every major entity (agent, task, routine, goal, run) renders as a card.

**Base card:**
- `background: #FFFFFF`
- `border: 1px solid #E2E8F0`
- `border-radius: 12px`
- `padding: 16px` (compact) or `20px` (standard)
- `box-shadow: 0 1px 3px rgba(0,0,0,0.04)` (subtle, not floating)
- Hover: `box-shadow: 0 2px 8px rgba(0,0,0,0.06)`, `border-color: #CBD5E1`

**Agent card:**
- Left border: 3px solid [department color]
- Top row: agent name (semibold) + status dot + role (muted)
- Bottom row: current task or "Idle" + last active timestamp
- Compact variant for sidebar: avatar + name + status dot only

**Task card (Kanban):**
- Department dot (top-left)
- Title (14px semibold, 2 lines max, truncate)
- Assignee avatar/initials (bottom-left)
- Priority indicator (bottom-right): colored dot (P1 red, P2 amber, P3 blue, P4 gray)
- Drag handle on hover

**Routine card:**
- Status badge (draft/active/paused/archived)
- Name + description (1 line)
- Trigger summary ("Every weekday 7 AM" or "Manual")
- Step count + last run timestamp
- Quick actions: play/pause/trigger

**Cost summary card:**
- Large number (spent) top-left
- Trend indicator (up/down arrow + %)
- Subtitle (period label)
- Progress bar if budget exists

### Status Indicators

| Status | Color | Animation | Dot Size |
|--------|-------|-----------|----------|
| Active | `#16A34A` (green 600) | Gentle pulse (2.5s ease, opacity 0.7-1.0) | 10px |
| Thinking | `#D97706` (amber 600) | Faster pulse (1.5s ease, opacity 0.5-1.0) | 10px |
| Idle | `#94A3B8` (slate 400) | None | 8px |
| Error | `#DC2626` (red 600) | None (static, attention via color) | 10px |
| Queued | `#6366F1` (indigo 600) | None | 8px |

**Animation philosophy:** Minimal. Only active and thinking states animate. Everything else is static. We do not want a dashboard that feels like a Christmas tree.

### Data Visualization

**Cost charts:**
- Use simple horizontal bar charts for "by department" and "by model" breakdowns
- Budget bars: progress fill with color thresholds (green < 60%, amber 60-80%, red > 80%)
- Daily trend: minimal line chart or sparkline, not a full chart library

**Run timeline:**
- Horizontal timeline with step markers
- Color-coded by status (green success, red failed, amber in-progress)
- Duration labels between steps

**Goal tree:**
- Indented tree with expand/collapse
- Progress indicator per goal (completed tasks / total tasks)

### Empty States

Empty states are the first thing a new user sees. They must:
1. Explain what goes here
2. Show how to get started
3. Not feel broken or sad

**Pattern:**
```
[Subtle icon, 48px, muted color]
[Title: "No agents yet"]
[Description: "Create your first department and agents to get started."]
[CTA button: "Create Department"]
```

No sad-face illustrations. No "nothing to see here." Functional, encouraging, action-oriented.

---

## 4. Layout Specifications

### Dashboard (CEO View -- all departments)

```
+--sidebar--+--main-content-------------------------------------+
|  Logo      |                                                    |
|  Dept: All |  [Welcome, {companyName}]        [Today's date]   |
|            |                                                    |
|  Dashboard |  +--Agent Grid (2-col)--+  +--Cost Summary--+     |
|  Agents    |  | [CIO] [Dev] [QA]     |  | $45.20 spent   |     |
|  Tasks     |  | [UIUX] [Ops] [RnD]   |  | 80% of budget  |     |
|  Goals     |  +----------------------+  +----------------+     |
|  Routines  |                                                    |
|  ---       |  +--Active Routines-----+  +--Goal Progress-+     |
|  Costs     |  | Morning brief: 7 AM  |  | Q2 Revenue: 40%|     |
|  Models    |  | Research: 6:30 AM    |  | Ship v2: 75%   |     |
|  Settings  |  +----------------------+  +----------------+     |
|            |                                                    |
|  [User]    |  +--Recent Activity (full width)----------------+ |
|            |  | 10:32 Dev completed task "Fix auth bug"      | |
|            |  | 10:15 QA reviewed PR #42 -- approved         | |
|            |  | 09:45 RnD published research brief           | |
|            |  +----------------------------------------------+ |
+------------+----------------------------------------------------+
```

### Dashboard (Department View)

Same layout but:
- Agent grid shows only that department's agents
- Cost summary scoped to department
- Routines filtered to department
- Goals filtered to department
- Activity feed filtered to department
- Department color appears as a subtle accent on the page header

### Responsive Behavior

- **> 1280px:** Full sidebar + multi-column dashboard
- **960-1280px:** Collapsed sidebar (icons) + 2-column
- **< 960px:** Sidebar becomes bottom nav (5 key items), single column
- **< 640px:** Mobile -- stacked cards, hamburger for nav, bottom tab bar

---

## 5. Interaction Patterns

### Transitions

- Page transitions: instant (no page-level animation)
- Card hover: 150ms ease border/shadow change
- Panel open/close (task detail, routine builder): 200ms slide from right
- Dropdown menus: 150ms fade + 4px translate-y
- Status dot pulse: CSS animation only (no JS)

### Feedback

- Button click: subtle scale (0.98) + color change
- Form submit: button shows loading spinner, disabled state
- Success: green toast notification, 3s auto-dismiss
- Error: red toast notification, persists until dismissed
- Destructive action: confirmation dialog (not just a red button)

### Keyboard

- `/` to focus search (future)
- `Cmd+K` command palette (future)
- `Esc` to close any panel/modal
- Arrow keys for nav items (sidebar)

---

## 6. Landing Page Design Direction

The landing page (orchestra.agentislab.ai) is separate from the app. It is a marketing surface.

**Mood:** Confident, clean, premium. Like a Linear or Vercel landing page -- not a VC-funded startup with gradients everywhere.

**Key sections:**
1. Hero with clear value prop and CTA
2. "How it works" -- 4 steps with icons
3. Feature grid -- 6 cards, one per key capability
4. "Who is this for?" -- 3 persona cards
5. Quebec/Canada positioning with subtle maple leaf or Quebec flag reference
6. Footer with AgentisLab branding

**Color on landing page:**
- Background: white (#FFFFFF) with subtle off-white sections (#F8FAFC)
- Primary CTA: deep blue (#1E40AF) with white text
- Text: slate 900 (#0F172A) for headings, slate 500 (#64748B) for body
- Accent: use sparingly for feature icons or highlights

**No:**
- Gradient backgrounds
- Glassmorphism
- Floating 3D illustrations
- Stock photos
- "AI" in neon letters
