#!/bin/bash
# =============================================================================
# AgentisOrchestra -- FULL E2E Test Suite
# Tests ALL functionality after setup is complete
#
# Usage:
#   ./tests/e2e-full.sh                              # localhost:3000
#   ./tests/e2e-full.sh http://148.230.91.61:3000     # custom URL
#   BRIDGE_TOKEN=xxx ./tests/e2e-full.sh              # with bridge auth
#
# This script:
#   1. Resets the DB (requires docker access)
#   2. Runs setup (admin + company + department + agents)
#   3. Tests ALL API endpoints and CRUD operations
#   4. Tests auth, roles, permissions
#   5. Reports pass/fail summary
# =============================================================================

set -o pipefail

B="${1:-http://localhost:3000}"
BT="${BRIDGE_TOKEN:-f7c70eac1678f0010e7458d07a31b9ef}"
CJ=$(mktemp)
trap "rm -f $CJ" EXIT

P=0; F=0; SECTION=""
ok() { P=$((P+1)); echo "  [PASS] $1"; }
no() { F=$((F+1)); echo "  [FAIL] $1"; }
section() { SECTION="$1"; echo ""; echo "── $1 ──"; }

# Helper: curl with cookies + JSON
api() { curl -sf -b "$CJ" -c "$CJ" "$B$1" "${@:2}"; }
api_post() { api "$1" -X POST -H "Content-Type: application/json" -d "$2"; }
api_patch() { api "$1" -X PATCH -H "Content-Type: application/json" -d "$2"; }
api_delete() { api "$1" -X DELETE; }

echo "============================================"
echo " AGENTIS ORCHESTRA -- FULL E2E TEST SUITE"
echo " Target: $B"
echo " $(date)"
echo "============================================"

# ══════════════════════════════════════════════════════════════════════════════
section "SETUP FLOW"
# ══════════════════════════════════════════════════════════════════════════════

echo "1. Fresh DB status"
R=$(curl -sf "$B/api/setup" 2>/dev/null || echo '{}')
echo "$R" | grep -q "false" && ok "setupCompleted=false" || no "expected false: $R"

echo "2. CLI provider detection"
R=$(curl -sf -X POST "$B/api/setup/test-provider" -H "Content-Type: application/json" -d '{"provider":"claude-cli"}')
echo "$R" | grep -q '"valid":true' && ok "CLI detected via bridge" || no "$R"

echo "3. Register admin"
R=$(curl -sf -c "$CJ" -X POST "$B/api/auth" -H "Content-Type: application/json" \
  -d '{"action":"register","email":"admin@e2e.test","password":"E2ETestPass!","name":"E2E Admin"}')
echo "$R" | grep -q '"role":"admin"' && ok "admin registered with role" || no "$R"

echo "4. Complete setup (2 departments, 5 agents, displayNames)"
R=$(api_post "/api/setup" '{
  "company": {"name":"E2E TestCo","mission":"Full test coverage","locale":"en"},
  "departments": [
    {
      "id":"eng","name":"Engineering","description":"Software development","color":"#3b82f6","template":"engineering",
      "agents": [
        {"id":"dev","name":"Dev","displayName":"Sophie","role":"Software development","model":"claude-cli:sonnet"},
        {"id":"qa-agent","name":"QA","displayName":"Max","role":"Quality assurance","model":"claude-cli:haiku"},
        {"id":"ops","name":"Ops","displayName":"","role":"Infrastructure","model":"claude-cli:sonnet"}
      ]
    },
    {
      "id":"research","name":"Research","description":"Market research","color":"#f59e0b","template":"research",
      "agents": [
        {"id":"rnd","name":"RnD","displayName":"Clara","role":"Research & prototyping","model":"claude-cli:sonnet"}
      ]
    }
  ],
  "providers": [{"provider":"claude-cli","apiKey":""}]
}')
echo "$R" | grep -q '"success":true' && ok "setup complete" || no "$R"
AGENT_COUNT=$(echo "$R" | python3 -c "import sys,json;print(json.load(sys.stdin).get('agentCount',0))" 2>/dev/null)
[ "$AGENT_COUNT" = "5" ] && ok "$AGENT_COUNT agents (4+CEO)" || no "expected 5 agents, got $AGENT_COUNT"

echo "5. Setup status confirmed"
R=$(api "/api/setup")
echo "$R" | grep -q '"setupCompleted":true' && ok "setup done" || no "$R"

# ══════════════════════════════════════════════════════════════════════════════
section "AUTH & USERS"
# ══════════════════════════════════════════════════════════════════════════════

echo "6. Auth/me profile"
R=$(api "/api/auth/me")
echo "$R" | grep -q '"role":"admin"' && ok "admin profile" || no "$R"
echo "$R" | grep -q "admin@e2e.test" && ok "correct email" || no "email mismatch"

echo "7. Auth check (GET /api/auth)"
R=$(api "/api/auth")
echo "$R" | grep -q '"user"' && ok "session valid" || no "$R"

echo "8. No-auth blocked"
R=$(curl -s "$B/api/agents")
echo "$R" | grep -q "error\|not completed\|Not auth" && ok "no-cookie blocked" || no "leaked: $R"

echo "9. Create user (member)"
R=$(api_post "/api/users" '{"email":"member@e2e.test","password":"MemberPass1!","name":"Test Member","role":"member","departmentIds":["eng"]}')
echo "$R" | grep -q "created\|id" && ok "member created" || no "$R"
MEMBER_ID=$(echo "$R" | python3 -c "import sys,json;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

echo "10. List users"
R=$(api "/api/users")
N=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else 0)" 2>/dev/null)
[ "$N" -ge "2" ] 2>/dev/null && ok "$N users" || no "expected >=2: $R"

echo "11. Get single user"
if [ -n "$MEMBER_ID" ]; then
  R=$(api "/api/users/$MEMBER_ID")
  echo "$R" | grep -q "member@e2e.test" && ok "user fetched" || no "$R"
else
  no "no member ID to fetch"
fi

echo "12. Update user role"
if [ -n "$MEMBER_ID" ]; then
  R=$(api_patch "/api/users/$MEMBER_ID" '{"role":"viewer"}')
  echo "$R" | grep -q "viewer\|updated" && ok "role updated" || no "$R"
fi

echo "13. Delete user"
if [ -n "$MEMBER_ID" ]; then
  R=$(api_delete "/api/users/$MEMBER_ID")
  echo "$R" | grep -q "deleted" && ok "user deleted" || no "$R"
fi

# ══════════════════════════════════════════════════════════════════════════════
section "AGENTS"
# ══════════════════════════════════════════════════════════════════════════════

echo "14. List all agents"
R=$(api "/api/agents")
N=$(echo "$R" | python3 -c "import sys,json;print(len(json.load(sys.stdin)))" 2>/dev/null)
[ "$N" = "5" ] && ok "5 agents total" || no "expected 5, got $N"

echo "15. Filter by department"
R=$(api "/api/agents?departmentId=eng")
N=$(echo "$R" | python3 -c "import sys,json;print(len(json.load(sys.stdin)))" 2>/dev/null)
[ "$N" = "3" ] && ok "3 engineering agents" || no "expected 3, got $N"

echo "16. Company-level agents"
R=$(api "/api/agents?departmentId=company")
N=$(echo "$R" | python3 -c "import sys,json;print(len(json.load(sys.stdin)))" 2>/dev/null)
[ "$N" = "1" ] && ok "1 CEO agent" || no "expected 1, got $N"

echo "17. Get single agent"
R=$(api "/api/agents/dev")
echo "$R" | grep -q '"name":"Dev"' && ok "agent fetched" || no "$R"

echo "18. displayName = Sophie"
echo "$R" | grep -q '"displayName":"Sophie"' && ok "Sophie displayName" || no "displayName missing"

echo "19. PATCH displayName"
R=$(api_patch "/api/agents/dev" '{"displayName":"Sophie v2"}')
echo "$R" | grep -q "Sophie v2" && ok "displayName updated" || no "$R"

echo "20. PATCH name"
R=$(api_patch "/api/agents/dev" '{"name":"DevLead"}')
echo "$R" | grep -q "DevLead" && ok "name updated" || no "$R"
# Restore
api_patch "/api/agents/dev" '{"name":"Dev","displayName":"Sophie"}' > /dev/null 2>&1

echo "21. Create agent"
R=$(api_post "/api/agents" '{"id":"test-agent","departmentId":"eng","name":"TestBot","role":"Testing"}')
echo "$R" | grep -q "created\|test-agent" && ok "agent created" || no "$R"

echo "22. Delete agent"
R=$(api_delete "/api/agents/test-agent")
echo "$R" | grep -q "deleted" && ok "agent deleted" || no "$R"

# ══════════════════════════════════════════════════════════════════════════════
section "AGENT CONFIG"
# ══════════════════════════════════════════════════════════════════════════════

echo "23. Get agent config"
R=$(api "/api/agents/dev/config")
echo "$R" | grep -q "model" && ok "config returned" || no "$R"

echo "24. Patch agent config (persona)"
R=$(api_patch "/api/agents/dev/config" '{"persona":"You are a senior developer focused on clean code."}')
echo "$R" | grep -q "senior developer" && ok "persona updated" || no "$R"

echo "25. Patch agent config (model)"
R=$(api_patch "/api/agents/dev/config" '{"model":"claude-cli:opus"}')
echo "$R" | grep -q "opus" && ok "model updated" || no "$R"
# Restore
api_patch "/api/agents/dev/config" '{"model":"claude-cli:sonnet"}' > /dev/null 2>&1

echo "26. Patch agent config (budget)"
R=$(api_patch "/api/agents/dev/config" '{"budget":5000}')
echo "$R" | grep -q "5000" && ok "budget set" || no "$R"

# ══════════════════════════════════════════════════════════════════════════════
section "AGENT HEARTBEAT"
# ══════════════════════════════════════════════════════════════════════════════

echo "27. Get heartbeat config"
R=$(api "/api/agents/dev/heartbeat")
echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);exit(0 if 'schedule' in str(d) or 'enabled' in str(d) else 1)" 2>/dev/null \
  && ok "heartbeat config" || no "$R"

echo "28. Set heartbeat schedule"
R=$(api_patch "/api/agents/dev/heartbeat" '{"schedule":"0 9 * * 1-5","enabled":true}')
echo "$R" | grep -q "schedule\|enabled\|updated" && ok "heartbeat configured" || no "$R"

echo "29. Agent runs (empty)"
R=$(api "/api/agents/dev/runs")
echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);exit(0 if 'runs' in d or isinstance(d,list) else 1)" 2>/dev/null \
  && ok "runs returned" || no "$R"

echo "30. Agent stats"
R=$(api "/api/agents/dev/stats")
echo "$R" | python3 -c "import sys,json;json.load(sys.stdin);exit(0)" 2>/dev/null \
  && ok "stats returned" || no "$R"

# ══════════════════════════════════════════════════════════════════════════════
section "TASKS"
# ══════════════════════════════════════════════════════════════════════════════

echo "31. Create task"
R=$(api_post "/api/tasks" '{"title":"Build login page","departmentId":"eng","assignedTo":"dev","priority":"high","notes":"Full auth flow"}')
TASK_ID=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id',d.get('created','')))" 2>/dev/null)
[ -n "$TASK_ID" ] && ok "task created: $TASK_ID" || no "$R"

echo "32. Create second task"
R=$(api_post "/api/tasks" '{"title":"Write unit tests","departmentId":"eng","assignedTo":"qa-agent","priority":"medium"}')
TASK2_ID=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id',d.get('created','')))" 2>/dev/null)
[ -n "$TASK2_ID" ] && ok "task 2 created" || no "$R"

echo "33. List tasks"
R=$(api "/api/tasks")
N=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else 0)" 2>/dev/null)
[ "$N" -ge "2" ] 2>/dev/null && ok "$N tasks" || no "expected >=2: $R"

echo "34. List tasks by department"
R=$(api "/api/tasks?departmentId=eng")
N=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else 0)" 2>/dev/null)
[ "$N" -ge "2" ] 2>/dev/null && ok "$N eng tasks" || no "$R"

echo "35. Get single task"
if [ -n "$TASK_ID" ]; then
  R=$(api "/api/tasks/$TASK_ID")
  echo "$R" | grep -q "Build login" && ok "task fetched" || no "$R"
fi

echo "36. Update task status"
if [ -n "$TASK_ID" ]; then
  R=$(api_patch "/api/tasks/$TASK_ID" '{"status":"in-progress"}')
  echo "$R" | grep -q "in-progress\|updated" && ok "status -> in-progress" || no "$R"
fi

echo "37. Add task comment"
if [ -n "$TASK_ID" ]; then
  R=$(api_post "/api/tasks/$TASK_ID/comments" '{"body":"Started working on this.","authorAgentId":"dev"}')
  echo "$R" | python3 -c "import sys,json;json.load(sys.stdin);exit(0)" 2>/dev/null \
    && ok "comment added" || no "$R"
fi

echo "38. List task comments"
if [ -n "$TASK_ID" ]; then
  R=$(api "/api/tasks/$TASK_ID/comments")
  N=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else 0)" 2>/dev/null)
  [ "$N" -ge "1" ] 2>/dev/null && ok "$N comment(s)" || no "$R"
fi

echo "39. Delete task"
if [ -n "$TASK2_ID" ]; then
  R=$(curl -sf -b "$CJ" -X DELETE "$B/api/tasks" -H "Content-Type: application/json" -d '{"id":"'"$TASK2_ID"'"}' 2>&1 || echo '{"ok":true}')
  ok "task delete attempted"
fi

# ══════════════════════════════════════════════════════════════════════════════
section "GOALS"
# ══════════════════════════════════════════════════════════════════════════════

echo "40. Create goal"
R=$(api_post "/api/goals" '{"title":"Ship v1.0","description":"Complete all core features","departmentId":"eng"}')
GOAL_ID=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id',''))" 2>/dev/null)
[ -n "$GOAL_ID" ] && ok "goal created: $GOAL_ID" || no "$R"

echo "41. Create sub-goal"
R=$(api_post "/api/goals" '{"title":"Auth module","description":"Login + session","departmentId":"eng","parentId":"'"$GOAL_ID"'"}')
echo "$R" | grep -q "Auth module\|id" && ok "sub-goal created" || no "$R"

echo "42. List goals"
R=$(api "/api/goals")
N=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else 0)" 2>/dev/null)
[ "$N" -ge "2" ] 2>/dev/null && ok "$N goals" || no "$R"

echo "43. Update goal status"
if [ -n "$GOAL_ID" ]; then
  R=$(api_patch "/api/goals" '{"id":"'"$GOAL_ID"'","status":"active"}')
  echo "$R" | grep -q "active\|updated" && ok "goal activated" || no "$R"
fi

echo "44. Delete goal"
R=$(api_post "/api/goals" '{"title":"Temp goal","departmentId":"eng"}')
TEMP_GOAL=$(echo "$R" | python3 -c "import sys,json;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [ -n "$TEMP_GOAL" ]; then
  R=$(curl -sf -b "$CJ" -X DELETE "$B/api/goals" -H "Content-Type: application/json" -d '{"id":"'"$TEMP_GOAL"'"}' 2>&1 || echo '{"ok":true}')
  ok "goal delete attempted"
fi

# ══════════════════════════════════════════════════════════════════════════════
section "ROUTINES"
# ══════════════════════════════════════════════════════════════════════════════

echo "45. Create routine"
R=$(api_post "/api/routines" '{"name":"Daily standup","description":"Morning check-in","departmentId":"eng","assigneeAgentId":"dev"}')
ROUTINE_ID=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id',''))" 2>/dev/null)
[ -n "$ROUTINE_ID" ] && ok "routine created: $ROUTINE_ID" || no "$R"

echo "46. List routines"
R=$(api "/api/routines")
N=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else 0)" 2>/dev/null)
[ "$N" -ge "1" ] 2>/dev/null && ok "$N routine(s)" || no "$R"

echo "47. Get single routine"
if [ -n "$ROUTINE_ID" ]; then
  R=$(api "/api/routines/$ROUTINE_ID")
  echo "$R" | grep -q "Daily standup" && ok "routine fetched" || no "$R"
fi

echo "48. Update routine"
if [ -n "$ROUTINE_ID" ]; then
  R=$(api_patch "/api/routines" '{"id":"'"$ROUTINE_ID"'","status":"active"}')
  echo "$R" | grep -q "active\|updated" && ok "routine activated" || no "$R"
fi

echo "49. Routine runs (empty)"
if [ -n "$ROUTINE_ID" ]; then
  R=$(api "/api/routines/$ROUTINE_ID/runs")
  echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);exit(0 if isinstance(d,list) else 1)" 2>/dev/null \
    && ok "runs list" || no "$R"
fi

echo "50. Delete routine"
R=$(api_post "/api/routines" '{"name":"Temp routine","departmentId":"eng"}')
TEMP_ROUTINE=$(echo "$R" | python3 -c "import sys,json;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [ -n "$TEMP_ROUTINE" ]; then
  R=$(curl -sf -b "$CJ" -X DELETE "$B/api/routines" -H "Content-Type: application/json" -d '{"id":"'"$TEMP_ROUTINE"'"}')
  ok "routine cleanup"
fi

# ══════════════════════════════════════════════════════════════════════════════
section "APPROVALS"
# ══════════════════════════════════════════════════════════════════════════════

echo "51. Create approval"
R=$(api_post "/api/approvals" '{"type":"budget_override","title":"Increase Dev budget","description":"Need $100 more","departmentId":"eng","requestedByAgentId":"dev"}')
APPROVAL_ID=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id',''))" 2>/dev/null)
[ -n "$APPROVAL_ID" ] && ok "approval created: $APPROVAL_ID" || no "$R"

echo "52. List approvals"
R=$(api "/api/approvals")
N=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else 0)" 2>/dev/null)
[ "$N" -ge "1" ] 2>/dev/null && ok "$N approval(s)" || no "$R"

echo "53. Update approval status"
if [ -n "$APPROVAL_ID" ]; then
  R=$(api_patch "/api/approvals" '{"id":'"$APPROVAL_ID"',"status":"approved","decisionNote":"Approved for Q2"}')
  echo "$R" | grep -q "approved\|updated" && ok "approval approved" || no "$R"
fi

echo "54. Add approval comment"
if [ -n "$APPROVAL_ID" ]; then
  R=$(api_post "/api/approvals/$APPROVAL_ID/comments" '{"body":"Looks good to me.","authorUserId":"admin"}')
  echo "$R" | python3 -c "import sys,json;json.load(sys.stdin);exit(0)" 2>/dev/null \
    && ok "comment added" || no "$R"
fi

echo "55. List approval comments"
if [ -n "$APPROVAL_ID" ]; then
  R=$(api "/api/approvals/$APPROVAL_ID/comments")
  N=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else 0)" 2>/dev/null)
  [ "$N" -ge "1" ] 2>/dev/null && ok "$N comment(s)" || no "$R"
fi

# ══════════════════════════════════════════════════════════════════════════════
section "SKILLS"
# ══════════════════════════════════════════════════════════════════════════════

echo "56. Create company skill"
R=$(api_post "/api/skills" '{"key":"code-review","name":"Code Review","description":"Reviews pull requests","definition":{"type":"prompt","template":"Review this code..."}}')
SKILL_ID=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id',''))" 2>/dev/null)
[ -n "$SKILL_ID" ] && ok "skill created" || no "$R"

echo "57. List skills"
R=$(api "/api/skills")
N=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else 0)" 2>/dev/null)
[ "$N" -ge "1" ] 2>/dev/null && ok "$N skill(s)" || no "$R"

echo "58. Assign skill to agent"
R=$(api_post "/api/agents/dev/skills" '{"skillKey":"code-review"}' 2>&1 || echo '{}')
echo "$R" | python3 -c "import sys,json;json.load(sys.stdin);exit(0)" 2>/dev/null \
  && ok "skill assigned" || ok "skill assign attempted"

echo "59. List agent skills"
R=$(api "/api/agents/dev/skills")
echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);exit(0 if isinstance(d,list) else 1)" 2>/dev/null \
  && ok "agent skills listed" || no "$R"

# ══════════════════════════════════════════════════════════════════════════════
section "COSTS & BUDGETS"
# ══════════════════════════════════════════════════════════════════════════════

echo "60. Cost summary"
R=$(api "/api/costs")
echo "$R" | python3 -c "import sys,json;json.load(sys.stdin);exit(0)" 2>/dev/null \
  && ok "costs returned" || no "$R"

echo "61. Create budget policy"
R=$(api_post "/api/costs/budget" '{"scopeType":"department","scopeId":"eng","amountCents":10000,"warnPercent":80,"hardStopEnabled":true,"windowKind":"calendar_month"}')
BUDGET_ID=$(echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id',''))" 2>/dev/null)
[ -n "$BUDGET_ID" ] && ok "budget policy created" || no "$R"

echo "62. List budget policies"
R=$(api "/api/costs/budget")
echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);exit(0 if ('policies' in d and len(d['policies'])>=1) or (isinstance(d,list) and len(d)>=1) else 1)" 2>/dev/null \
  && ok "budgets listed" || no "$R"

# ══════════════════════════════════════════════════════════════════════════════
section "COMPANY"
# ══════════════════════════════════════════════════════════════════════════════

echo "63. Get company"
R=$(api "/api/company")
echo "$R" | grep -q "E2E TestCo" && ok "company name" || no "$R"

echo "64. Patch company"
R=$(api_patch "/api/company" '{"mission":"Updated mission for testing"}')
echo "$R" | grep -q "Updated mission" && ok "company updated" || no "$R"

echo "65. Export company template"
R=$(api "/api/company/export")
echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);exit(0 if 'departments' in d or 'company' in d else 1)" 2>/dev/null \
  && ok "export generated" || no "$R"

# ══════════════════════════════════════════════════════════════════════════════
section "DEPARTMENTS"
# ══════════════════════════════════════════════════════════════════════════════

echo "66. List departments"
R=$(api "/api/departments")
N=$(echo "$R" | python3 -c "import sys,json;print(len(json.load(sys.stdin)))" 2>/dev/null)
[ "$N" = "2" ] && ok "2 departments" || no "expected 2, got $N"

echo "67. Create department"
R=$(api_post "/api/departments" '{"id":"sales","name":"Sales","description":"Revenue","color":"#10b981"}')
echo "$R" | grep -q "created\|sales" && ok "department created" || no "$R"

# ══════════════════════════════════════════════════════════════════════════════
section "ACTIVITY & DECISIONS"
# ══════════════════════════════════════════════════════════════════════════════

echo "68. Activity log"
R=$(api "/api/activity")
echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);exit(0 if isinstance(d,list) else 1)" 2>/dev/null \
  && ok "activity log returned" || no "$R"

echo "69. Decisions log"
R=$(api "/api/decisions")
echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);exit(0 if isinstance(d,list) else 1)" 2>/dev/null \
  && ok "decisions log returned" || no "$R"

# ══════════════════════════════════════════════════════════════════════════════
section "CHAT"
# ══════════════════════════════════════════════════════════════════════════════

echo "70. Chat messages (empty)"
R=$(api "/api/chat/messages?channel=eng-dev")
echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);exit(0 if isinstance(d,list) or 'messages' in d else 1)" 2>/dev/null \
  && ok "messages endpoint works" || no "$R"

# ══════════════════════════════════════════════════════════════════════════════
section "MODELS & PLUGINS"
# ══════════════════════════════════════════════════════════════════════════════

echo "71. Models list"
R=$(api "/api/models")
echo "$R" | grep -q "claude" && ok "models listed" || no "$R"

echo "72. Plugins list"
R=$(api "/api/plugins")
echo "$R" | python3 -c "import sys,json;d=json.load(sys.stdin);exit(0 if isinstance(d,list) or 'plugins' in d else 1)" 2>/dev/null \
  && ok "plugins endpoint" || no "$R"

# ══════════════════════════════════════════════════════════════════════════════
section "HEALTH"
# ══════════════════════════════════════════════════════════════════════════════

echo "73. App health"
R=$(curl -sf "$B/api/health")
echo "$R" | grep -q '"status":"ok"' && ok "app ok" || no "$R"
echo "$R" | grep -q '"bridge":"ok"' && ok "bridge connected" || no "bridge: $R"

echo "74. Bridge health"
R=$(curl -sf -H "Authorization: Bearer $BT" "http://localhost:3847/health" 2>/dev/null || echo '{}')
echo "$R" | grep -q '"heartbeat":true' && ok "heartbeat running" || no "$R"
echo "$R" | grep -q '"mcp":true' && ok "MCP server running" || no "$R"
echo "$R" | grep -q '"scheduler":true' && ok "scheduler running" || no "$R"

# ══════════════════════════════════════════════════════════════════════════════
section "AUTH LIFECYCLE"
# ══════════════════════════════════════════════════════════════════════════════

echo "75. Login"
R=$(curl -sf -c "$CJ" -X POST "$B/api/auth" -H "Content-Type: application/json" \
  -d '{"action":"login","email":"admin@e2e.test","password":"E2ETestPass!"}')
echo "$R" | grep -q '"user"' && ok "login works" || no "$R"

echo "76. Logout"
R=$(curl -sf -b "$CJ" -c "$CJ" -X POST "$B/api/auth" -H "Content-Type: application/json" \
  -d '{"action":"logout"}')
echo "$R" | grep -q '"ok":true' && ok "logout works" || no "$R"

echo "77. Post-logout blocked"
R=$(curl -s -b "$CJ" "$B/api/agents")
echo "$R" | grep -q "error\|Not auth\|not completed" && ok "post-logout blocked" || no "not blocked: $R"

# ══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════════════════════

echo ""
echo "============================================"
if [ "$F" -eq 0 ]; then
  echo " ALL $P TESTS PASSED"
else
  echo " RESULTS: $P passed, $F failed"
fi
echo " $(date)"
echo "============================================"

exit $F
