# Soul Engine Test Plan -- Simulated Long-Term Usage

**Purpose**: Validate that persona evolution works correctly over simulated weeks/months of agent activity. Unit tests can't cover this -- we need synthetic runs, feedback signals, and refinement cycles compressed into minutes.

---

## Test Architecture

```
test-soul-engine.sh
  |
  ├── Phase 1: Setup (create agent + initial persona)
  ├── Phase 2: Simulate 4 weeks of usage
  │   ├── Week 1: baseline runs + micro-feedback
  │   ├── Week 2: pattern emergence + first proposals
  │   ├── Week 3: approved refinements + behavior shift
  │   └── Week 4: self-evaluations + autonomous proposals
  ├── Phase 3: Validate evolution
  │   ├── Persona version count
  │   ├── Proposal quality
  │   ├── Feedback aggregation accuracy
  │   └── Drift detection (core identity preserved)
  └── Phase 4: Edge cases
      ├── Zero feedback (system still works)
      ├── All feedback dismissed (auto-backoff)
      ├── Conflicting signals
      └── Guardrail preservation
```

---

## Phase 1: Setup

```bash
# Create test agent with known initial persona
POST /api/agents
{ "name": "test-soul", "role": "QA Tester", "departmentId": "eng" }

# Set initial persona via Soul Builder
POST /api/agents/{id}/persona
{
  "personaText": "You are a QA tester. You review code for bugs.",
  "structuredPersona": {
    "role": "QA Tester",
    "priorities": ["Find bugs", "Write clear reports"],
    "guardrails": ["Never approve code without testing", "Never modify production data"],
    "tone": "Professional",
    "tools": ["Read", "Grep", "Bash"],
    "hierarchy": { "reportsTo": "ceo" }
  },
  "changeSummary": "Initial persona via test setup",
  "changeSource": "soul_builder"
}

# Verify: version 1 created
GET /api/agents/{id}/persona
ASSERT: current.version == 1
ASSERT: current.changeSource == "soul_builder"
```

---

## Phase 2: Simulate 4 Weeks

### Week 1: Baseline Runs + Micro-Feedback (simulate 20 interactions)

```bash
# Simulate 20 chat interactions with thumbs feedback
for i in {1..20}; do
  # 70% thumbs up, 20% thumbs down, 10% no feedback
  RATING=$((RANDOM % 10))
  if [ $RATING -lt 7 ]; then
    POST /api/agents/{id}/feedback
    { "type": "thumbs", "rating": 1, "contextType": "chat", "contextId": "msg-$i" }
  elif [ $RATING -lt 9 ]; then
    POST /api/agents/{id}/feedback
    { "type": "thumbs", "rating": -1, "contextType": "chat", "contextId": "msg-$i", "comment": "Response was too verbose" }
  fi
done

# Simulate 5 task completions with ratings
for i in {1..5}; do
  POST /api/agents/{id}/feedback
  { "type": "task_rating", "rating": $((3 + RANDOM % 3)), "contextType": "task", "contextId": "TASK-00$i" }
done

# Verify feedback stored
GET /api/agents/{id}/feedback?limit=30
ASSERT: count >= 20
ASSERT: types include "thumbs" and "task_rating"
```

### Week 2: Pattern Emergence + First Proposals

```bash
# Add more negative feedback with consistent pattern
for i in {1..8}; do
  POST /api/agents/{id}/feedback
  { "type": "thumbs", "rating": -1, "contextType": "chat", "contextId": "msg-2$i", "comment": "Too verbose in status updates" }
done

# Simulate a daily pulse check
POST /api/agents/{id}/feedback
{ "type": "pulse_daily", "rating": 3, "comment": "Good at finding bugs but reports are too long" }

# Manually trigger refinement (in production this runs on schedule)
# Create proposal based on observed pattern
POST /api/agents/{id}/proposals
{
  "proposalType": "modify_tone",
  "section": "tone",
  "currentValue": "Professional",
  "proposedValue": "Professional and concise. Keep status updates under 3 sentences.",
  "reasoning": "8 negative feedback signals mention 'too verbose' in status updates. Daily pulse confirms reports are too long.",
  "confidence": "high",
  "source": "user_feedback",
  "evidenceCount": 9
}

# Verify proposal created
GET /api/agents/{id}/proposals?status=pending
ASSERT: count >= 1
ASSERT: proposals[0].confidence == "high"
ASSERT: proposals[0].evidenceCount >= 9
```

### Week 3: Approved Refinements

```bash
# Approve the tone proposal
PATCH /api/agents/{id}/proposals
{ "id": {proposal_id}, "status": "approved", "decidedBy": "admin" }

# Verify persona updated to version 2
GET /api/agents/{id}/persona
ASSERT: current.version == 2
ASSERT: current.changeSummary contains "tone"
ASSERT: current.changeSource == "refinement_engine"

# Verify old version preserved in history
ASSERT: history.length == 2
ASSERT: history[1].version == 1 (original)

# Simulate improvement after refinement (more positive feedback)
for i in {1..15}; do
  POST /api/agents/{id}/feedback
  { "type": "thumbs", "rating": 1, "contextType": "chat", "contextId": "msg-3$i" }
done

# Weekly pulse shows improvement
POST /api/agents/{id}/feedback
{ "type": "pulse_weekly", "rating": 4, "comment": "Much better. Reports are concise now." }
```

### Week 4: Self-Evaluations + Autonomous Proposals

```bash
# Simulate 5 self-evaluations (from heartbeat runs)
for i in {1..5}; do
  POST /api/agents/{id}/self-eval
  {
    "runId": "run-test-$i",
    "whatWorked": "Found 3 bugs in the auth module",
    "whatWasHard": "Couldn't access deployment logs to verify fixes",
    "wouldChangeTo": "Request deployment log access before starting ops-related reviews",
    "confidenceInResult": $((60 + RANDOM % 30))
  }
done

# Verify self-evaluations stored
GET /api/agents/{id}/self-eval
ASSERT: count == 5
ASSERT: all have whatWorked != null

# Create autonomous proposal from self-eval pattern
POST /api/agents/{id}/proposals
{
  "proposalType": "add_skill",
  "section": "tools",
  "currentValue": "Read, Grep, Bash",
  "proposedValue": "Read, Grep, Bash, WebFetch (for deployment logs)",
  "reasoning": "3/5 self-evaluations mention difficulty accessing deployment logs. Adding WebFetch would resolve this.",
  "confidence": "medium",
  "source": "self_evaluation",
  "evidenceCount": 3
}
```

---

## Phase 3: Validate Evolution

```bash
# 1. Version count
GET /api/agents/{id}/persona
ASSERT: totalVersions >= 2

# 2. Feedback aggregation
GET /api/agents/{id}/feedback?limit=100
ASSERT: total >= 50
# Calculate: positive ratio should increase after refinement
# Week 1-2: ~70% positive
# Week 3-4: ~90% positive (after tone fix)

# 3. Proposal quality
GET /api/agents/{id}/proposals
ASSERT: at least 2 proposals created
ASSERT: at least 1 approved
ASSERT: approved proposals have evidenceCount > 5

# 4. Core identity preserved (drift detection)
GET /api/agents/{id}/persona
ASSERT: structuredPersona.role == "QA Tester" (never changed)
ASSERT: structuredPersona.guardrails includes "Never approve code without testing"
ASSERT: structuredPersona.guardrails includes "Never modify production data"
# Guardrails should ONLY grow, never shrink
ASSERT: structuredPersona.guardrails.length >= 2
```

---

## Phase 4: Edge Cases

### E1: Zero Feedback
```bash
# Create agent, run 10 heartbeats, give zero feedback
# System should still work -- no proposals, no persona changes
GET /api/agents/{id}/persona
ASSERT: totalVersions == 1 (initial only)
GET /api/agents/{id}/proposals
ASSERT: count == 0
```

### E2: All Feedback Dismissed
```bash
# Dismiss daily pulse 3 times
for i in {1..3}; do
  PATCH /api/feedback-preferences
  { "frequency": "light" }
  # Simulate dismiss by incrementing count
done

GET /api/feedback-preferences
ASSERT: dailyDismissCount >= 3
# UI should stop showing daily prompts (verified in component logic)
```

### E3: Conflicting Signals
```bash
# Send equal positive and negative feedback
for i in {1..10}; do
  POST /api/agents/{id}/feedback { "type": "thumbs", "rating": 1 }
  POST /api/agents/{id}/feedback { "type": "thumbs", "rating": -1 }
done

# Refinement engine should NOT propose changes (low confidence)
# Any proposals should have confidence: "low"
```

### E4: Guardrail Preservation
```bash
# Try to create a proposal that removes a guardrail
POST /api/agents/{id}/proposals
{
  "proposalType": "remove_behavior",
  "section": "guardrails",
  "currentValue": "Never modify production data",
  "proposedValue": "",
  "reasoning": "Agent finds this restrictive",
  "confidence": "high",
  "source": "self_evaluation",
  "evidenceCount": 1
}

# Even if approved, verify the guardrail check in the approval handler
# Core guardrails from initial persona should be protected
```

---

## Automation Script

```bash
#!/bin/bash
# tests/test-soul-engine.sh
# Runs the full simulation against a live instance

BASE_URL="${1:-http://localhost:3000}"
AGENT_ID=""
PASS=0
FAIL=0

function assert_eq() {
  if [ "$1" == "$2" ]; then
    PASS=$((PASS + 1))
  else
    echo "FAIL: expected '$2', got '$1' ($3)"
    FAIL=$((FAIL + 1))
  fi
}

function assert_gte() {
  if [ "$1" -ge "$2" ] 2>/dev/null; then
    PASS=$((PASS + 1))
  else
    echo "FAIL: expected >= $2, got '$1' ($3)"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Soul Engine Test Suite ==="
echo "Target: $BASE_URL"
echo ""

# ... (phases 1-4 implemented as curl calls with jq assertions)

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
exit $FAIL
```

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Persona versions after 4-week sim | >= 2 |
| Feedback signals captured | >= 50 |
| Proposals generated | >= 2 |
| At least 1 approved proposal | Yes |
| Core identity preserved after changes | Yes |
| Guardrails never reduced | Yes |
| System works with zero feedback | Yes |
| Dismissed feedback auto-backoff | Yes |
| Conflicting signals = no change | Yes |

---

## Run Cadence

- **Pre-release**: Full suite before every version tag
- **CI**: Phases 1 + 3 (setup + validate) as smoke test
- **Weekly**: Full 4-week simulation on staging
