/**
 * Model Router -- picks the best model for each task.
 *
 * Strategy: CLI-first (free tokens), then cheapest API model that fits.
 *
 * The router considers:
 * 1. Task type (code, research, writing, etc.)
 * 2. Available providers (which API keys are configured?)
 * 3. Cost preference (free > cheap > standard > premium)
 * 4. Agent-level overrides (agent config can pin a model)
 * 5. Department-level defaults
 */

import {
  MODEL_REGISTRY,
  getModelsByStrength,
  getSubscriptionModels,
  type ModelDef,
  type TaskType,
  type Provider,
  type CostTier,
} from "./models.js"

// =============================================================================
// Types
// =============================================================================

export interface RouteRequest {
  taskType: TaskType
  agentModel?: string          // agent config override (model ID)
  needsVision?: boolean
  needsTools?: boolean
  needsSearch?: boolean        // web search = Perplexity
  maxCostTier?: CostTier       // budget cap
  preferCLI?: boolean          // default true -- use Pro sub when possible
  allowedModelIds?: string[]   // org-level governance filter (empty = all allowed)
}

export interface RouteResult {
  model: ModelDef
  reason: string               // why this model was chosen
  alternatives: ModelDef[]     // other options considered
}

// =============================================================================
// Provider availability (checked at runtime)
// =============================================================================

function availableProviders(): Set<Provider> {
  const providers = new Set<Provider>()

  // CLI is available if the binary exists (checked at startup)
  if (process.env.CLAUDE_CLI_PATH || process.env.ADAPTER_MODE === "cli") {
    providers.add("claude-cli")
  }
  // Always available with Pro subscription as default
  providers.add("claude-cli")

  if (process.env.OPENROUTER_API_KEY) providers.add("openrouter")
  if (process.env.PERPLEXITY_API_KEY) providers.add("perplexity")
  if (process.env.OPENAI_API_KEY) providers.add("openai")

  return providers
}

const COST_ORDER: CostTier[] = ["subscription", "cheap", "standard", "premium"]

function costRank(tier: CostTier): number {
  return COST_ORDER.indexOf(tier)
}

// =============================================================================
// Router
// =============================================================================

export function routeModel(req: RouteRequest): RouteResult {
  const providers = availableProviders()
  const preferCLI = req.preferCLI !== false // default true

  // 1. Agent-level override -- if the agent has a model set in config, ALWAYS use it.
  //    The router NEVER overrides a manually configured model.
  //    Router auto-selection only happens when no model is explicitly set.
  if (req.agentModel) {
    const pinned = MODEL_REGISTRY.find((m) => m.id === req.agentModel)
    if (pinned && providers.has(pinned.provider)) {
      return {
        model: pinned,
        reason: `Agent config: ${pinned.name} (manually set)`,
        alternatives: [],
      }
    }
    // Model set but not in registry or provider unavailable -- warn but continue to auto-select
    console.warn(`[router] Agent model "${req.agentModel}" not available, falling back to auto-select`)
  }

  // 2. Research tasks -> always Perplexity if available
  if (req.needsSearch || req.taskType === "research") {
    if (providers.has("perplexity")) {
      const perplexityModels = MODEL_REGISTRY.filter(
        (m) => m.provider === "perplexity"
      )
      const best = req.taskType === "research"
        ? perplexityModels.find((m) => m.model === "sonar-pro") || perplexityModels[0]
        : perplexityModels.find((m) => m.model === "sonar") || perplexityModels[0]

      if (best) {
        return {
          model: best,
          reason: `Research/search task -> Perplexity (web search with citations)`,
          alternatives: perplexityModels.filter((m) => m.id !== best.id),
        }
      }
    }
  }

  // 3. Filter candidates by task type
  let candidates = getModelsByStrength(req.taskType)

  // Filter by available providers
  candidates = candidates.filter((m) => providers.has(m.provider))

  // Filter by org-level model governance (if configured)
  if (req.allowedModelIds && req.allowedModelIds.length > 0) {
    candidates = candidates.filter((m) => req.allowedModelIds!.includes(m.id))
  }

  // Filter by vision/tools requirements
  if (req.needsVision) {
    candidates = candidates.filter((m) => m.supportsVision)
  }
  if (req.needsTools) {
    candidates = candidates.filter((m) => m.supportsTools)
  }

  // Filter by max cost tier
  if (req.maxCostTier) {
    const maxRank = costRank(req.maxCostTier)
    candidates = candidates.filter((m) => costRank(m.costTier) <= maxRank)
  }

  if (candidates.length === 0) {
    // Fallback: any available model
    candidates = MODEL_REGISTRY.filter((m) => providers.has(m.provider))
  }

  // 4. Sort: CLI first (if preferred), then by cost tier
  candidates.sort((a, b) => {
    // Prefer CLI (free) if enabled
    if (preferCLI) {
      if (a.mode === "cli" && b.mode !== "cli") return -1
      if (b.mode === "cli" && a.mode !== "cli") return 1
    }

    // Then by cost
    const costDiff = costRank(a.costTier) - costRank(b.costTier)
    if (costDiff !== 0) return costDiff

    // Then by context window (bigger = better)
    return b.contextWindow - a.contextWindow
  })

  const best = candidates[0]
  const alternatives = candidates.slice(1, 4)

  const reasonParts: string[] = []
  if (best.mode === "cli") reasonParts.push("CLI (Pro sub, no per-token cost)")
  reasonParts.push(`best for ${req.taskType}`)
  reasonParts.push(`cost: ${best.costTier}`)

  return {
    model: best,
    reason: reasonParts.join(" | "),
    alternatives,
  }
}

// =============================================================================
// Quick helpers for common patterns
// =============================================================================

export function routeForCode(agentModel?: string): RouteResult {
  return routeModel({ taskType: "code", needsTools: true, agentModel })
}

export function routeForResearch(): RouteResult {
  return routeModel({ taskType: "research", needsSearch: true })
}

export function routeForQuickTask(agentModel?: string): RouteResult {
  return routeModel({ taskType: "quick", maxCostTier: "cheap", agentModel })
}

export function routeForVision(agentModel?: string): RouteResult {
  return routeModel({ taskType: "vision", needsVision: true, agentModel })
}

export function routeForOrchestration(): RouteResult {
  return routeModel({ taskType: "orchestration", needsTools: true })
}
