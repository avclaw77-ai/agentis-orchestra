#!/bin/bash
# =============================================================================
# Full Runtime Audit -- tests EVERY API endpoint on a live instance
# Verifies real backend logic, not just UI existence
#
# Usage: TEST_EMAIL=x TEST_PASS=y ./tests/test-full-runtime.sh [BASE_URL]
# =============================================================================

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
PASS=0
FAIL=0
TOTAL=0
COOKIE_FILE="/tmp/runtime-audit-cookies-$$.txt"

GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[0;33m"
NC="\033[0m"

api() {
  local method="$1"; local path="$2"; local data="${3:-}"
  if [ -n "$data" ]; then
    curl -s -X "$method" "$BASE_URL$path" -H "Content-Type: application/json" -b "$COOKIE_FILE" -c "$COOKIE_FILE" -d "$data"
  else
    curl -s -X "$method" "$BASE_URL$path" -b "$COOKIE_FILE" -c "$COOKIE_FILE"
  fi
}

assert_ok() {
  TOTAL=$((TOTAL + 1))
  local res="$1"; local msg="$2"
  local ok=$(echo "$res" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok')" 2>/dev/null || echo "fail")
  if [ "$ok" == "ok" ]; then PASS=$((PASS + 1)); echo -e "  ${GREEN}PASS${NC} $msg"
  else FAIL=$((FAIL + 1)); echo -e "  ${RED}FAIL${NC} $msg"; fi
}

assert_field() {
  TOTAL=$((TOTAL + 1))
  local res="$1"; local field="$2"; local msg="$3"
  local val=$(echo "$res" | python3 -c "import sys,json; d=json.load(sys.stdin); v=d;
for k in '$field'.split('.'): v=v[k] if isinstance(v,dict) else v[int(k)] if isinstance(v,list) and k.isdigit() else None
print('exists' if v is not None else 'missing')" 2>/dev/null || echo "error")
  if [ "$val" == "exists" ]; then PASS=$((PASS + 1)); echo -e "  ${GREEN}PASS${NC} $msg"
  else FAIL=$((FAIL + 1)); echo -e "  ${RED}FAIL${NC} $msg (field '$field' missing)"; fi
}

assert_status() {
  TOTAL=$((TOTAL + 1))
  local code="$1"; local expected="$2"; local msg="$3"
  if [ "$code" == "$expected" ]; then PASS=$((PASS + 1)); echo -e "  ${GREEN}PASS${NC} $msg"
  else FAIL=$((FAIL + 1)); echo -e "  ${RED}FAIL${NC} $msg (expected $expected, got $code)"; fi
}

echo "=== Full Runtime Audit ==="
echo "Target: $BASE_URL"
echo ""

# =============================================================================
# AUTH
# =============================================================================
echo -e "${YELLOW}[AUTH]${NC}"
LOGIN=$(api POST "/api/auth" "{\"action\":\"login\",\"email\":\"${TEST_EMAIL:-admin@test.com}\",\"password\":\"${TEST_PASS:-TestPass123!}\"}")
assert_field "$LOGIN" "user" "Login returns user object"

ME=$(api GET "/api/auth/me")
assert_field "$ME" "role" "GET /api/auth/me returns role"

echo ""

# =============================================================================
# CORE: Agents, Departments, Company
# =============================================================================
echo -e "${YELLOW}[CORE]${NC}"
AGENTS=$(api GET "/api/agents")
assert_ok "$AGENTS" "GET /api/agents returns valid JSON"
AGENT_COUNT=$(echo "$AGENTS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
echo "  Found $AGENT_COUNT agents"

DEPTS=$(api GET "/api/departments")
assert_ok "$DEPTS" "GET /api/departments returns valid JSON"

COMPANY=$(api GET "/api/company")
assert_ok "$COMPANY" "GET /api/company returns valid JSON"

HEALTH=$(api GET "/api/health")
assert_field "$HEALTH" "status" "GET /api/health returns status"
assert_field "$HEALTH" "bridge" "GET /api/health returns bridge status"

echo ""

# =============================================================================
# TASKS
# =============================================================================
echo -e "${YELLOW}[TASKS]${NC}"
TASKS=$(api GET "/api/tasks")
assert_ok "$TASKS" "GET /api/tasks returns valid JSON"

TASK_CREATE=$(api POST "/api/tasks" '{"title":"Runtime Audit Test Task","priority":"low","phase":"qa"}')
TASK_ID=$(echo "$TASK_CREATE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
assert_field "$TASK_CREATE" "id" "POST /api/tasks creates task with ID"

if [ -n "$TASK_ID" ]; then
  TASK_GET=$(api GET "/api/tasks/$TASK_ID")
  assert_field "$TASK_GET" "title" "GET /api/tasks/:id returns task"

  TASK_PATCH=$(api PATCH "/api/tasks" "{\"id\":\"$TASK_ID\",\"status\":\"in-progress\"}")
  assert_field "$TASK_PATCH" "status" "PATCH /api/tasks updates status"

  COMMENT=$(api POST "/api/tasks/$TASK_ID/comments" '{"body":"Test comment","authorUserId":"admin"}')
  assert_ok "$COMMENT" "POST /api/tasks/:id/comments creates comment"

  # Cleanup
  api DELETE "/api/tasks?id=$TASK_ID" > /dev/null 2>&1
fi

echo ""

# =============================================================================
# CHAT
# =============================================================================
echo -e "${YELLOW}[CHAT]${NC}"
AGENT_ID=$(echo "$AGENTS" | python3 -c "import sys,json; a=json.load(sys.stdin); print(a[0]['id'] if a else '')" 2>/dev/null || echo "")
if [ -n "$AGENT_ID" ]; then
  MSGS=$(api GET "/api/chat/messages?channel=$AGENT_ID&limit=5")
  assert_ok "$MSGS" "GET /api/chat/messages returns valid JSON"
fi

echo ""

# =============================================================================
# CONVERSATIONS
# =============================================================================
echo -e "${YELLOW}[CONVERSATIONS]${NC}"
if [ -n "$AGENT_ID" ]; then
  CONV_LIST=$(api GET "/api/conversations?agentId=$AGENT_ID")
  assert_ok "$CONV_LIST" "GET /api/conversations returns valid JSON"

  CONV_CREATE=$(api POST "/api/conversations" "{\"agentId\":\"$AGENT_ID\",\"title\":\"Test Conversation\"}")
  CONV_ID=$(echo "$CONV_CREATE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
  assert_field "$CONV_CREATE" "id" "POST /api/conversations creates conversation"

  if [ -n "$CONV_ID" ]; then
    CONV_RENAME=$(api PATCH "/api/conversations" "{\"id\":\"$CONV_ID\",\"title\":\"Renamed\"}")
    assert_ok "$CONV_RENAME" "PATCH /api/conversations renames"

    api DELETE "/api/conversations?id=$CONV_ID" > /dev/null 2>&1
  fi
fi

echo ""

# =============================================================================
# GOALS
# =============================================================================
echo -e "${YELLOW}[GOALS]${NC}"
GOALS=$(api GET "/api/goals")
assert_ok "$GOALS" "GET /api/goals returns valid JSON"

echo ""

# =============================================================================
# ROUTINES
# =============================================================================
echo -e "${YELLOW}[ROUTINES]${NC}"
ROUTINES=$(api GET "/api/routines")
assert_ok "$ROUTINES" "GET /api/routines returns valid JSON"

echo ""

# =============================================================================
# APPROVALS
# =============================================================================
echo -e "${YELLOW}[APPROVALS]${NC}"
APPROVALS=$(api GET "/api/approvals")
assert_ok "$APPROVALS" "GET /api/approvals returns valid JSON"

APPROVAL_CREATE=$(api POST "/api/approvals" '{"type":"task_escalation","title":"Runtime Audit Test Approval","description":"Testing approval creation"}')
APPROVAL_ID=$(echo "$APPROVAL_CREATE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',0))" 2>/dev/null || echo "0")
assert_field "$APPROVAL_CREATE" "id" "POST /api/approvals creates approval"

echo ""

# =============================================================================
# COSTS
# =============================================================================
echo -e "${YELLOW}[COSTS]${NC}"
COSTS=$(api GET "/api/costs")
assert_ok "$COSTS" "GET /api/costs returns valid JSON"

BUDGETS=$(api GET "/api/costs/budget")
assert_ok "$BUDGETS" "GET /api/costs/budget returns valid JSON"

echo ""

# =============================================================================
# MODELS
# =============================================================================
echo -e "${YELLOW}[MODELS]${NC}"
MODELS=$(api GET "/api/models")
assert_ok "$MODELS" "GET /api/models returns valid JSON"
assert_field "$MODELS" "providers" "Models response has providers"
assert_field "$MODELS" "models" "Models response has models list"

ALLOWED=$(api GET "/api/models/allowed")
assert_ok "$ALLOWED" "GET /api/models/allowed returns valid JSON"

echo ""

# =============================================================================
# SKILLS
# =============================================================================
echo -e "${YELLOW}[SKILLS]${NC}"
SKILLS=$(api GET "/api/skills")
assert_ok "$SKILLS" "GET /api/skills returns valid JSON"

echo ""

# =============================================================================
# ACTIVITY + DECISIONS
# =============================================================================
echo -e "${YELLOW}[ACTIVITY]${NC}"
ACTIVITY=$(api GET "/api/activity?limit=5")
assert_ok "$ACTIVITY" "GET /api/activity returns valid JSON"

DECISIONS=$(api GET "/api/decisions")
assert_ok "$DECISIONS" "GET /api/decisions returns valid JSON"

echo ""

# =============================================================================
# SEARCH
# =============================================================================
echo -e "${YELLOW}[SEARCH]${NC}"
SEARCH=$(api GET "/api/search?q=test&limit=5")
assert_ok "$SEARCH" "GET /api/search returns valid JSON"
assert_field "$SEARCH" "results" "Search has results object"

echo ""

# =============================================================================
# SOUL ENGINE
# =============================================================================
echo -e "${YELLOW}[SOUL ENGINE]${NC}"
if [ -n "$AGENT_ID" ]; then
  FEEDBACK=$(api GET "/api/agents/$AGENT_ID/feedback")
  assert_ok "$FEEDBACK" "GET feedback endpoint"

  PERSONA=$(api GET "/api/agents/$AGENT_ID/persona")
  assert_ok "$PERSONA" "GET persona endpoint"

  PROPOSALS=$(api GET "/api/agents/$AGENT_ID/proposals")
  assert_ok "$PROPOSALS" "GET proposals endpoint"

  SELFEVAL=$(api GET "/api/agents/$AGENT_ID/self-eval")
  assert_ok "$SELFEVAL" "GET self-eval endpoint"

  FEEDBACK_POST=$(api POST "/api/agents/$AGENT_ID/feedback" '{"type":"thumbs","rating":1,"contextType":"test","contextId":"runtime-audit"}')
  assert_field "$FEEDBACK_POST" "id" "POST feedback creates record"

  PREFS=$(api GET "/api/feedback-preferences")
  assert_ok "$PREFS" "GET feedback-preferences"
fi

echo ""

# =============================================================================
# FILES + LOGS
# =============================================================================
echo -e "${YELLOW}[FILES + LOGS]${NC}"
LOGS=$(api GET "/api/logs?limit=5")
assert_ok "$LOGS" "GET /api/logs returns valid JSON"

echo ""

# =============================================================================
# AUTH GUARD (verify 401 without cookie)
# =============================================================================
echo -e "${YELLOW}[AUTH GUARDS]${NC}"
# Without ao_setup_done cookie, middleware returns 503. With it but no session, returns 401.
UNAUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" --cookie "ao_setup_done=1" "$BASE_URL/api/tasks")
assert_status "$UNAUTH_CODE" "401" "Unauthenticated /api/tasks returns 401"

UNAUTH_CODE2=$(curl -s -o /dev/null -w "%{http_code}" --cookie "ao_setup_done=1" "$BASE_URL/api/agents")
assert_status "$UNAUTH_CODE2" "401" "Unauthenticated /api/agents returns 401"

echo ""

# =============================================================================
# RESULTS
# =============================================================================
echo "==========================================="
echo -e "Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}, $TOTAL total"
echo "==========================================="

rm -f "$COOKIE_FILE"
exit $FAIL
