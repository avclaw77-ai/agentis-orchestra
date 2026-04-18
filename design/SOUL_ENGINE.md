# Agent Soul Engine -- Design Document

**Author**: CIO
**Date**: 2026-04-18
**Status**: Approved -- Layer 1 planned for v1.1

---

## Vision

Agents that get better at their job the more they work. Not through retraining -- through structured persona evolution driven by real execution feedback and user signals.

No platform does this today. Every competitor has static agent definitions. The Soul Engine is Orchestra's differentiator.

---

## The Three Layers

### Layer 1: Guided Soul Builder (v1.1)

A structured interview that helps non-technical users define an agent through conversation.

**Flow:**
1. "What does this agent do day-to-day?" -> role + responsibilities
2. "What's the most important thing it should get right?" -> core priorities
3. "What should it absolutely never do?" -> guardrails
4. "How should it talk to your team?" -> tone + communication style
5. "What tools and systems does it need?" -> tool permissions + data sources
6. "Who does it report to? Who reviews its work?" -> hierarchy + escalation
7. Review generated persona -> edit inline -> save

**Output:** A structured persona with sections (role, priorities, guardrails, tone, tools, hierarchy) instead of a raw system prompt blob. Versioned. Diffable.

**Extends:** The existing AI config generator (Sparkles button in agent-profile.tsx) from a one-shot generation to a guided multi-step refinement.

---

### Layer 2: Feedback-Driven Refinement (v1.2)

#### Embedded Feedback Moments

The key insight: non-expert users won't proactively write feedback. The system must ask at the right moments, in the right way, with minimal friction.

**Micro-feedback (in the moment, 1 click):**

| Moment | Prompt | Input | Signal |
|--------|--------|-------|--------|
| After chat response | Thumbs up/down on response | 1 click | Response quality |
| After task completion | "Did [Agent] do this well?" | Yes/Meh/No | Task execution quality |
| After approval rejection | "What should the agent do differently?" | Optional text (pre-filled with rejection note) | Behavior correction |
| After run failure | "Was this the right approach?" | Yes (bad luck) / No (wrong approach) | Strategy feedback |

**Pulse checks (periodic, 30 seconds):**

| Cadence | Prompt | Format |
|---------|--------|--------|
| Daily (end of day, optional) | "Quick check: how did your agents perform today?" | 1-5 star per active agent + optional note |
| Weekly (Friday, prompted) | "This week with [Agent]: What's working? What's not?" | Two text fields, pre-filled with suggestions from run data |
| Monthly (1st, dashboard card) | "Agent Performance Review" | Structured form: keep doing / stop doing / start doing |

**Implementation:**
- Daily/weekly prompts appear as a non-blocking card on the dashboard
- Dismiss = skip, no penalty
- Responses stored in a `agent_feedback` table with structured metadata
- Dashboard shows feedback history and trends per agent

**Automatic signals (no user action needed):**

| Signal | Source | What it tells us |
|--------|--------|-----------------|
| Run success/failure rate | heartbeat_runs | Is the agent effective? |
| Average response time | run duration_ms | Is the model appropriate? |
| Token efficiency trend | tokens per task | Is the persona too verbose? |
| Tool usage patterns | run metadata | Which tools does it actually use? |
| Escalation frequency | approval requests | Is it asking for help too often? |
| Correction patterns | chat history (user follows up with "no, I meant...") | Misunderstanding patterns |
| Task reassignment rate | activity_log | Is work being moved away from this agent? |

#### Refinement Engine

Runs weekly (or after N feedback signals):

1. **Aggregate** -- collect all feedback + automatic signals since last run
2. **Analyze** -- LLM identifies patterns:
   - "Agent X gets thumbs-down on research tasks but thumbs-up on code review"
   - "Users consistently correct Agent Y's tone in client-facing outputs"
   - "Agent Z's guardrails are too restrictive -- 40% of runs hit the 'never modify config' rule unnecessarily"
3. **Propose patches** -- structured diff to the persona:
   ```
   SUGGEST ADD to guardrails: "Always confirm before deleting files"
   REASON: 3 negative feedback signals related to unexpected file deletions
   CONFIDENCE: HIGH (direct user corrections)
   
   SUGGEST MODIFY tone: "More concise in status updates"
   REASON: 5/7 weekly pulse checks mention "too verbose"
   CONFIDENCE: MEDIUM (consistent but subjective)
   ```
4. **Review** -- patches appear in the Approvals workflow
5. **Apply** -- approved patches update the persona, versioned with full diff

---

### Layer 3: Autonomous Evolution (v2.0)

The agent reflects on its own performance and proposes self-improvements.

**Post-run self-evaluation (automatic, after each heartbeat run):**
```
{
  "runId": "run-abc",
  "selfAssessment": {
    "whatWorked": "Broke the task into clear subtasks before executing",
    "whatWasHard": "Didn't have access to the deployment logs, had to guess",
    "wouldChangeTo": "Ask for deployment log access before starting ops tasks",
    "confidenceInResult": 0.7
  }
}
```

**Monthly retrospective routine (built-in routine template):**
- Aggregates self-evaluations + user feedback
- Agent writes its own persona improvement proposal
- Constrained: can only modify behavior/preferences, not core identity
- Requires human approval before applying
- Full audit trail

**Hard constraints on autonomous evolution:**
- Core identity (name, role, department) = locked
- Guardrails can only be added, never removed autonomously
- Budget limits can never be increased
- Escalation rules can never be loosened
- All changes require at least one human approval

---

## Data Model

```sql
-- Feedback from users (micro + pulse)
agent_feedback (
  id SERIAL PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id),
  type TEXT NOT NULL,          -- 'thumbs', 'task_rating', 'pulse_daily', 'pulse_weekly', 'pulse_monthly'
  rating INTEGER,              -- 1-5 or -1/0/1 for thumbs
  comment TEXT,
  context_type TEXT,           -- 'chat', 'task', 'run', 'approval'
  context_id TEXT,             -- reference to the specific item
  user_id TEXT,
  created_at TIMESTAMP
)

-- Persona versions (full history)
persona_versions (
  id SERIAL PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id),
  version INTEGER NOT NULL,
  persona_text TEXT NOT NULL,
  structured_persona JSONB,    -- {role, priorities, guardrails, tone, tools, hierarchy}
  change_summary TEXT,
  change_source TEXT,          -- 'manual', 'soul_builder', 'refinement_engine', 'self_evolution'
  approved_by TEXT,
  created_at TIMESTAMP
)

-- Refinement proposals (from Layer 2/3)
persona_proposals (
  id SERIAL PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id),
  proposal_type TEXT,          -- 'add_guardrail', 'modify_tone', 'adjust_priority', etc.
  current_value TEXT,
  proposed_value TEXT,
  reasoning TEXT,
  confidence TEXT,             -- 'high', 'medium', 'low'
  source TEXT,                 -- 'user_feedback', 'run_analysis', 'self_evaluation'
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  decided_by TEXT,
  created_at TIMESTAMP
)
```

---

## UX Touchpoints

### For the CEO/Manager:
- Dashboard card: "Agent Performance Pulse" (weekly)
- Agent profile: "Soul" tab with version history, pending proposals, feedback trends
- Approvals queue: persona change proposals alongside regular approvals

### For the Employee (non-expert):
- Thumbs up/down after every chat response (tiny, non-intrusive)
- End-of-day optional pulse: "How did your agents do today?" (dismissible)
- Friday prompt: "Quick feedback on [Agent] this week" (2 fields, 30 seconds)
- Never asks them to write prompts or edit personas directly

### For the Agent (autonomous):
- Post-run self-eval stored as run metadata
- Monthly retrospective via built-in routine
- Persona diff view showing evolution over time

---

## Why This Wins

1. **For INOGENI (and every client):** Their team won't know how to write AI prompts. The Soul Builder + feedback loops mean agents improve through normal work, not prompt engineering.

2. **For sales:** "Your agents learn and improve automatically" is a one-line pitch that no competitor can match.

3. **For retention:** The longer a client uses Orchestra, the more valuable their agents become. Switching cost increases organically.

4. **For us (AgentisLab):** Every client deployment generates anonymized persona improvement patterns we can use to build better templates.

---

## Implementation Timeline

| Layer | Version | Effort | Key Components |
|-------|---------|--------|----------------|
| Soul Builder | v1.1 | 3 days | Guided interview UI, structured persona format, version history |
| Micro-feedback | v1.1 | 2 days | Thumbs on chat, task rating, feedback table |
| Pulse checks | v1.2 | 2 days | Daily/weekly/monthly prompts, dashboard cards |
| Refinement Engine | v1.2 | 4 days | Signal aggregation, LLM analysis, proposal workflow |
| Self-evaluation | v2.0 | 3 days | Post-run hooks, retrospective routine |
| Autonomous evolution | v2.0 | 5 days | Self-proposal system, safety constraints, audit trail |

---

## Hard Rule: Always Optional, Never Annoying

Every feedback touchpoint MUST follow these principles:

1. **Dismissible in one click.** No confirmation dialogs. No "are you sure you want to skip?" guilt trips.
2. **Never blocks workflow.** Feedback prompts appear as passive cards or inline elements. Never as modals, never interrupting active work.
3. **Frequency respects the user.** If a user dismisses 3 daily pulses in a row, stop showing them. Surface weekly instead. If they dismiss weekly, go monthly. If monthly, stop entirely until they opt back in via Settings.
4. **Zero feedback = zero penalty.** The system works fine without any user input. Automatic signals (run outcomes, token patterns, tool usage) drive refinement even if the user never clicks a single thumbs up.
5. **No notification spam.** Feedback prompts never generate push notifications, emails, or badges. They appear only when the user is already looking at the relevant screen.
6. **Configurable per user.** Settings > Preferences: "Agent feedback frequency" with options: Active / Light / Off. Default: Light.

The goal is that users who want to shape their agents can, and users who just want to work are never bothered. If anyone ever describes the feedback system as "annoying," we failed.

---

## Open Questions

1. Should persona proposals go through the existing Approvals workflow or a dedicated "Soul Review" interface?
2. How aggressive should auto-suggestions be? Start conservative (high-confidence only) and tune?
3. Should agents be aware of their own feedback scores? Could create perverse incentives if self-evaluating.
4. Template sharing: when a refined persona works well for one client, should it feed back into the template library?
