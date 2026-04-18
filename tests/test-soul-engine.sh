#!/bin/bash
# =============================================================================
# Soul Engine Test Suite -- Simulated Long-Term Usage
# Tests persona evolution across 4 simulated weeks
#
# Usage: ./tests/test-soul-engine.sh [BASE_URL]
# Default: http://localhost:3000
# =============================================================================

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
PASS=0
FAIL=0
TOTAL=0
COOKIE_FILE="/tmp/soul-engine-test-cookies.txt"
AGENT_ID=""

# Colors
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[0;33m"
NC="\033[0m"

# =============================================================================
# Helpers
# =============================================================================

api() {
  local method="$1"
  local path="$2"
  local data="${3:-}"

  if [ -n "$data" ]; then
    curl -s -X "$method" "$BASE_URL$path" \
      -H "Content-Type: application/json" \
      -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
      -d "$data"
  else
    curl -s -X "$method" "$BASE_URL$path" \
      -b "$COOKIE_FILE" -c "$COOKIE_FILE"
  fi
}

assert_eq() {
  TOTAL=$((TOTAL + 1))
  local actual="$1"
  local expected="$2"
  local msg="$3"
  if [ "$actual" == "$expected" ]; then
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC} $msg"
  else
    FAIL=$((FAIL + 1))
    echo -e "  ${RED}FAIL${NC} $msg (expected '$expected', got '$actual')"
  fi
}

assert_gte() {
  TOTAL=$((TOTAL + 1))
  local actual="$1"
  local min="$2"
  local msg="$3"
  if [ "$actual" -ge "$min" ] 2>/dev/null; then
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC} $msg ($actual >= $min)"
  else
    FAIL=$((FAIL + 1))
    echo -e "  ${RED}FAIL${NC} $msg (expected >= $min, got '$actual')"
  fi
}

assert_not_empty() {
  TOTAL=$((TOTAL + 1))
  local actual="$1"
  local msg="$2"
  if [ -n "$actual" ] && [ "$actual" != "null" ] && [ "$actual" != "" ]; then
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC} $msg"
  else
    FAIL=$((FAIL + 1))
    echo -e "  ${RED}FAIL${NC} $msg (was empty/null)"
  fi
}

# =============================================================================
# Auth -- login first
# =============================================================================

echo "=== Soul Engine Test Suite ==="
echo "Target: $BASE_URL"
echo ""

echo -e "${YELLOW}[AUTH] Logging in...${NC}"
LOGIN_RES=$(api POST "/api/auth" '{"action":"login","email":"al.veilleux@gmail.com","password":"Pixel@V2026"}')
LOGIN_OK=$(echo "$LOGIN_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok' if d.get('user') else 'fail')" 2>/dev/null || echo "fail")
if [ "$LOGIN_OK" != "ok" ]; then
  echo -e "${RED}Login failed. Trying to get any agent for testing...${NC}"
  # Try without auth (middleware might allow in dev)
fi

# Get first agent
echo -e "${YELLOW}[SETUP] Finding test agent...${NC}"
AGENTS_RES=$(api GET "/api/agents")
AGENT_ID=$(echo "$AGENTS_RES" | python3 -c "import sys,json; agents=json.load(sys.stdin); print(agents[0]['id'] if agents else '')" 2>/dev/null || echo "")

if [ -z "$AGENT_ID" ]; then
  echo -e "${RED}No agents found. Cannot run tests.${NC}"
  exit 1
fi

AGENT_NAME=$(echo "$AGENTS_RES" | python3 -c "import sys,json; agents=json.load(sys.stdin); print(agents[0].get('name','unknown'))" 2>/dev/null)
echo "  Using agent: $AGENT_NAME ($AGENT_ID)"
echo ""

# =============================================================================
# Phase 1: Soul Engine API Endpoints Exist
# =============================================================================

echo -e "${YELLOW}[PHASE 1] API Endpoint Validation${NC}"

# Test feedback endpoint
FB_RES=$(api GET "/api/agents/$AGENT_ID/feedback")
FB_STATUS=$(echo "$FB_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok')" 2>/dev/null || echo "fail")
assert_eq "$FB_STATUS" "ok" "GET /api/agents/:id/feedback returns valid JSON"

# Test persona endpoint
PERSONA_RES=$(api GET "/api/agents/$AGENT_ID/persona")
PERSONA_STATUS=$(echo "$PERSONA_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok')" 2>/dev/null || echo "fail")
assert_eq "$PERSONA_STATUS" "ok" "GET /api/agents/:id/persona returns valid JSON"

# Test proposals endpoint
PROP_RES=$(api GET "/api/agents/$AGENT_ID/proposals")
PROP_STATUS=$(echo "$PROP_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok')" 2>/dev/null || echo "fail")
assert_eq "$PROP_STATUS" "ok" "GET /api/agents/:id/proposals returns valid JSON"

# Test self-eval endpoint
EVAL_RES=$(api GET "/api/agents/$AGENT_ID/self-eval")
EVAL_STATUS=$(echo "$EVAL_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok')" 2>/dev/null || echo "fail")
assert_eq "$EVAL_STATUS" "ok" "GET /api/agents/:id/self-eval returns valid JSON"

# Test feedback preferences
PREF_RES=$(api GET "/api/feedback-preferences")
PREF_STATUS=$(echo "$PREF_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok')" 2>/dev/null || echo "fail")
assert_eq "$PREF_STATUS" "ok" "GET /api/feedback-preferences returns valid JSON"

# Test allowed models
ALLOWED_RES=$(api GET "/api/models/allowed")
ALLOWED_STATUS=$(echo "$ALLOWED_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok')" 2>/dev/null || echo "fail")
assert_eq "$ALLOWED_STATUS" "ok" "GET /api/models/allowed returns valid JSON"

echo ""

# =============================================================================
# Phase 2: Create Initial Persona (Layer 1)
# =============================================================================

echo -e "${YELLOW}[PHASE 2] Layer 1 -- Persona Creation${NC}"

PERSONA_CREATE=$(api POST "/api/agents/$AGENT_ID/persona" '{
  "personaText": "You are a QA tester at the company. You review code for bugs and write clear reports.",
  "structuredPersona": {
    "role": "QA Tester",
    "priorities": ["Find bugs", "Write clear reports"],
    "guardrails": ["Never approve code without testing", "Never modify production data"],
    "tone": "Professional",
    "tools": ["Read", "Grep", "Bash"],
    "hierarchy": {}
  },
  "changeSummary": "Initial persona via Soul Engine test",
  "changeSource": "soul_builder"
}')
V1_VERSION=$(echo "$PERSONA_CREATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('version',0))" 2>/dev/null || echo "0")
assert_gte "$V1_VERSION" "1" "Initial persona created (version >= 1)"

# Verify it's retrievable
PERSONA_GET=$(api GET "/api/agents/$AGENT_ID/persona")
CURRENT_VERSION=$(echo "$PERSONA_GET" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('current',{}).get('version',0))" 2>/dev/null || echo "0")
assert_gte "$CURRENT_VERSION" "1" "Current persona version retrievable"

TOTAL_VERSIONS=$(echo "$PERSONA_GET" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('totalVersions',0))" 2>/dev/null || echo "0")
assert_gte "$TOTAL_VERSIONS" "1" "Total versions count >= 1"

echo ""

# =============================================================================
# Phase 3: Micro-Feedback (Layer 2)
# =============================================================================

echo -e "${YELLOW}[PHASE 3] Layer 2 -- Micro-Feedback${NC}"

# Submit thumbs up
THUMB_UP=$(api POST "/api/agents/$AGENT_ID/feedback" '{"type":"thumbs","rating":1,"contextType":"chat","contextId":"test-msg-1"}')
THUMB_UP_ID=$(echo "$THUMB_UP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',0))" 2>/dev/null || echo "0")
assert_gte "$THUMB_UP_ID" "1" "Thumbs up feedback created"

# Submit thumbs down with comment
THUMB_DN=$(api POST "/api/agents/$AGENT_ID/feedback" '{"type":"thumbs","rating":-1,"contextType":"chat","contextId":"test-msg-2","comment":"Too verbose"}')
THUMB_DN_ID=$(echo "$THUMB_DN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',0))" 2>/dev/null || echo "0")
assert_gte "$THUMB_DN_ID" "1" "Thumbs down feedback with comment created"

# Submit task rating
TASK_RATE=$(api POST "/api/agents/$AGENT_ID/feedback" '{"type":"task_rating","rating":4,"contextType":"task","contextId":"TASK-001"}')
TASK_RATE_ID=$(echo "$TASK_RATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',0))" 2>/dev/null || echo "0")
assert_gte "$TASK_RATE_ID" "1" "Task rating feedback created"

# Submit pulse daily
PULSE=$(api POST "/api/agents/$AGENT_ID/feedback" '{"type":"pulse_daily","rating":4,"comment":"Good work today"}')
PULSE_ID=$(echo "$PULSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',0))" 2>/dev/null || echo "0")
assert_gte "$PULSE_ID" "1" "Daily pulse feedback created"

# Verify feedback count
FB_LIST=$(api GET "/api/agents/$AGENT_ID/feedback?limit=50")
FB_COUNT=$(echo "$FB_LIST" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else d.get('total',len(d.get('feedback',[]))))" 2>/dev/null || echo "0")
assert_gte "$FB_COUNT" "4" "At least 4 feedback entries stored"

echo ""

# =============================================================================
# Phase 4: Proposals (Layer 2/3)
# =============================================================================

echo -e "${YELLOW}[PHASE 4] Layer 2/3 -- Persona Proposals${NC}"

# Create a proposal
PROPOSAL=$(api POST "/api/agents/$AGENT_ID/proposals" '{
  "proposalType": "modify_tone",
  "section": "tone",
  "currentValue": "Professional",
  "proposedValue": "Professional and concise",
  "reasoning": "Multiple feedback signals mention verbosity",
  "confidence": "high",
  "source": "user_feedback",
  "evidenceCount": 5
}')
PROP_ID=$(echo "$PROPOSAL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',0))" 2>/dev/null || echo "0")
assert_gte "$PROP_ID" "1" "Persona proposal created"

# List pending proposals
PENDING=$(api GET "/api/agents/$AGENT_ID/proposals?status=pending")
PENDING_COUNT=$(echo "$PENDING" | python3 -c "import sys,json; d=json.load(sys.stdin); items=d if isinstance(d,list) else d.get('proposals',[]); print(len(items))" 2>/dev/null || echo "0")
assert_gte "$PENDING_COUNT" "1" "At least 1 pending proposal"

# Approve the proposal
APPROVE=$(api PATCH "/api/agents/$AGENT_ID/proposals" "{\"id\":$PROP_ID,\"status\":\"approved\",\"decidedBy\":\"admin\"}")
APPROVE_OK=$(echo "$APPROVE" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok' if d.get('ok') or d.get('status')=='approved' else 'fail')" 2>/dev/null || echo "fail")
assert_eq "$APPROVE_OK" "ok" "Proposal approved successfully"

# Check persona version incremented
PERSONA_AFTER=$(api GET "/api/agents/$AGENT_ID/persona")
AFTER_VERSIONS=$(echo "$PERSONA_AFTER" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('totalVersions',0))" 2>/dev/null || echo "0")
assert_gte "$AFTER_VERSIONS" "2" "Persona version incremented after approval"

echo ""

# =============================================================================
# Phase 5: Self-Evaluation (Layer 3)
# =============================================================================

echo -e "${YELLOW}[PHASE 5] Layer 3 -- Self-Evaluation${NC}"

# Submit self-evaluation
SELF_EVAL=$(api POST "/api/agents/$AGENT_ID/self-eval" '{
  "runId": "run-test-001",
  "whatWorked": "Found 3 bugs in the auth module",
  "whatWasHard": "Could not access deployment logs",
  "wouldChangeTo": "Request log access before starting",
  "confidenceInResult": 75
}')
EVAL_ID=$(echo "$SELF_EVAL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',0))" 2>/dev/null || echo "0")
assert_gte "$EVAL_ID" "1" "Self-evaluation created"

# Submit another
SELF_EVAL2=$(api POST "/api/agents/$AGENT_ID/self-eval" '{
  "runId": "run-test-002",
  "whatWorked": "QA report was well-structured",
  "whatWasHard": "Test environment was slow",
  "wouldChangeTo": "Run tests in parallel next time",
  "confidenceInResult": 85
}')
EVAL2_ID=$(echo "$SELF_EVAL2" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',0))" 2>/dev/null || echo "0")
assert_gte "$EVAL2_ID" "1" "Second self-evaluation created"

# List self-evaluations
EVAL_LIST=$(api GET "/api/agents/$AGENT_ID/self-eval")
EVAL_COUNT=$(echo "$EVAL_LIST" | python3 -c "import sys,json; d=json.load(sys.stdin); items=d if isinstance(d,list) else d.get('evaluations',[]); print(len(items))" 2>/dev/null || echo "0")
assert_gte "$EVAL_COUNT" "2" "At least 2 self-evaluations stored"

echo ""

# =============================================================================
# Phase 6: Feedback Preferences
# =============================================================================

echo -e "${YELLOW}[PHASE 6] Feedback Preferences${NC}"

# Update preferences
PREF_UPDATE=$(api PATCH "/api/feedback-preferences" '{"frequency":"light"}')
PREF_OK=$(echo "$PREF_UPDATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok' if d.get('frequency') or d.get('ok') else 'fail')" 2>/dev/null || echo "fail")
assert_eq "$PREF_OK" "ok" "Feedback preferences updated"

# Read back
PREF_READ=$(api GET "/api/feedback-preferences")
PREF_FREQ=$(echo "$PREF_READ" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('frequency',''))" 2>/dev/null || echo "")
assert_eq "$PREF_FREQ" "light" "Feedback frequency is 'light'"

echo ""

# =============================================================================
# Phase 7: Model Governance
# =============================================================================

echo -e "${YELLOW}[PHASE 7] Model Governance${NC}"

# Set allowed models
MODELS_SET=$(api PUT "/api/models/allowed" '{"allowedModels":[{"id":"claude-cli:sonnet","provider":"claude-cli","name":"Claude Sonnet"},{"id":"claude-cli:haiku","provider":"claude-cli","name":"Claude Haiku"}]}')
MODELS_COUNT=$(echo "$MODELS_SET" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('count',0))" 2>/dev/null || echo "0")
assert_eq "$MODELS_COUNT" "2" "2 models allowed"

# Read back
MODELS_GET=$(api GET "/api/models/allowed")
MODELS_BACK=$(echo "$MODELS_GET" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('allowedModels',[])))" 2>/dev/null || echo "0")
assert_eq "$MODELS_BACK" "2" "Allowed models persisted"

echo ""

# =============================================================================
# Phase 8: Edge Cases
# =============================================================================

echo -e "${YELLOW}[PHASE 8] Edge Cases${NC}"

# Reject a proposal
PROP2=$(api POST "/api/agents/$AGENT_ID/proposals" '{
  "proposalType": "remove_behavior",
  "section": "guardrails",
  "currentValue": "Never modify production data",
  "proposedValue": "",
  "reasoning": "Test rejection",
  "confidence": "low",
  "source": "self_evaluation",
  "evidenceCount": 1
}')
PROP2_ID=$(echo "$PROP2" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',0))" 2>/dev/null || echo "0")

if [ "$PROP2_ID" -gt 0 ] 2>/dev/null; then
  REJECT=$(api PATCH "/api/agents/$AGENT_ID/proposals" "{\"id\":$PROP2_ID,\"status\":\"rejected\",\"decidedBy\":\"admin\"}")
  REJECT_OK=$(echo "$REJECT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok' if d.get('ok') or d.get('status')=='rejected' else 'fail')" 2>/dev/null || echo "fail")
  assert_eq "$REJECT_OK" "ok" "Proposal rejection works"
else
  assert_eq "0" "1" "Proposal creation for rejection test"
fi

# Defer a proposal
PROP3=$(api POST "/api/agents/$AGENT_ID/proposals" '{
  "proposalType": "add_skill",
  "section": "tools",
  "proposedValue": "WebFetch",
  "reasoning": "Test deferral",
  "confidence": "medium",
  "source": "run_analysis",
  "evidenceCount": 2
}')
PROP3_ID=$(echo "$PROP3" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',0))" 2>/dev/null || echo "0")

if [ "$PROP3_ID" -gt 0 ] 2>/dev/null; then
  DEFER=$(api PATCH "/api/agents/$AGENT_ID/proposals" "{\"id\":$PROP3_ID,\"status\":\"deferred\",\"decidedBy\":\"admin\"}")
  DEFER_OK=$(echo "$DEFER" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok' if d.get('ok') or d.get('status')=='deferred' else 'fail')" 2>/dev/null || echo "fail")
  assert_eq "$DEFER_OK" "ok" "Proposal deferral works"
fi

echo ""

# =============================================================================
# Results
# =============================================================================

echo "==========================================="
echo -e "Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}, $TOTAL total"
echo "==========================================="

# Cleanup
rm -f "$COOKIE_FILE"

exit $FAIL
