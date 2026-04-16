/**
 * Model Registry -- all available models across all providers.
 *
 * Each model has:
 * - provider: which API/CLI to use
 * - strengths: what it's good at (used by the router)
 * - cost tier: cheap / standard / premium
 * - mode: "cli" (Pro subscription, flat cost) or "api" (per-token)
 */

// =============================================================================
// Types
// =============================================================================

export type Provider = "claude-cli" | "openrouter" | "perplexity" | "openai"
export type CostTier = "free" | "cheap" | "standard" | "premium"
export type TaskType =
  | "code"
  | "code-review"
  | "research"
  | "writing"
  | "analysis"
  | "quick"
  | "vision"
  | "conversation"
  | "orchestration"

export interface ModelDef {
  id: string                    // unique key: "claude-cli:opus", "openrouter:gpt-4o"
  provider: Provider
  model: string                 // provider-specific model ID
  name: string                  // display name
  strengths: TaskType[]         // what it's best at
  costTier: CostTier
  mode: "cli" | "api"           // cli = Pro sub (flat), api = per-token
  contextWindow: number         // tokens
  supportsVision: boolean
  supportsTools: boolean
  notes?: string
}

// =============================================================================
// Registry
// =============================================================================

export const MODEL_REGISTRY: ModelDef[] = [
  // --- Claude CLI (Pro subscription -- flat cost, no per-token billing) ---
  {
    id: "claude-cli:opus",
    provider: "claude-cli",
    model: "claude-opus-4-6",
    name: "Claude Opus 4.6 (CLI)",
    strengths: ["code", "orchestration", "analysis", "writing", "vision"],
    costTier: "free",
    mode: "cli",
    contextWindow: 200_000,
    supportsVision: true,
    supportsTools: true,
    notes: "Most capable. Free via Pro sub. Primary workhorse.",
  },
  {
    id: "claude-cli:sonnet",
    provider: "claude-cli",
    model: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6 (CLI)",
    strengths: ["code", "code-review", "analysis", "conversation"],
    costTier: "free",
    mode: "cli",
    contextWindow: 200_000,
    supportsVision: true,
    supportsTools: true,
    notes: "Great balance. Free via Pro sub. Fast.",
  },
  {
    id: "claude-cli:haiku",
    provider: "claude-cli",
    model: "claude-haiku-4-5",
    name: "Claude Haiku 4.5 (CLI)",
    strengths: ["quick", "conversation", "code-review"],
    costTier: "free",
    mode: "cli",
    contextWindow: 200_000,
    supportsVision: true,
    supportsTools: true,
    notes: "Fastest. Free via Pro sub. Good for triage.",
  },

  // --- Perplexity (Research-focused) ---
  {
    id: "perplexity:sonar-pro",
    provider: "perplexity",
    model: "sonar-pro",
    name: "Perplexity Sonar Pro",
    strengths: ["research"],
    costTier: "standard",
    mode: "api",
    contextWindow: 200_000,
    supportsVision: false,
    supportsTools: false,
    notes: "Deep research with citations. Best for multi-source investigation.",
  },
  {
    id: "perplexity:sonar",
    provider: "perplexity",
    model: "sonar",
    name: "Perplexity Sonar",
    strengths: ["research", "quick"],
    costTier: "cheap",
    mode: "api",
    contextWindow: 128_000,
    supportsVision: false,
    supportsTools: false,
    notes: "Quick web search with citations. Good for fact-checking.",
  },

  // --- OpenAI (Direct API) ---
  {
    id: "openai:gpt-4o",
    provider: "openai",
    model: "gpt-4o",
    name: "GPT-4o",
    strengths: ["writing", "vision", "analysis", "conversation"],
    costTier: "standard",
    mode: "api",
    contextWindow: 128_000,
    supportsVision: true,
    supportsTools: true,
    notes: "Strong all-rounder. Good at structured output.",
  },
  {
    id: "openai:gpt-4o-mini",
    provider: "openai",
    model: "gpt-4o-mini",
    name: "GPT-4o Mini",
    strengths: ["quick", "conversation", "code-review"],
    costTier: "cheap",
    mode: "api",
    contextWindow: 128_000,
    supportsVision: true,
    supportsTools: true,
    notes: "Very cheap and fast. Good for simple tasks.",
  },
  {
    id: "openai:o3",
    provider: "openai",
    model: "o3",
    name: "OpenAI o3",
    strengths: ["code", "analysis", "orchestration"],
    costTier: "premium",
    mode: "api",
    contextWindow: 200_000,
    supportsVision: true,
    supportsTools: true,
    notes: "Deep reasoning. Use for hard problems.",
  },

  // --- OpenRouter (gateway to everything else) ---
  {
    id: "openrouter:deepseek-v3",
    provider: "openrouter",
    model: "deepseek/deepseek-chat-v3-0324",
    name: "DeepSeek V3",
    strengths: ["code", "analysis"],
    costTier: "cheap",
    mode: "api",
    contextWindow: 128_000,
    supportsVision: false,
    supportsTools: true,
    notes: "Very strong coder. Extremely cheap.",
  },
  {
    id: "openrouter:gemini-2.5-pro",
    provider: "openrouter",
    model: "google/gemini-2.5-pro-preview",
    name: "Gemini 2.5 Pro",
    strengths: ["code", "analysis", "vision", "writing"],
    costTier: "standard",
    mode: "api",
    contextWindow: 1_000_000,
    supportsVision: true,
    supportsTools: true,
    notes: "Massive context window. Good at long docs.",
  },
  {
    id: "openrouter:llama-4-maverick",
    provider: "openrouter",
    model: "meta-llama/llama-4-maverick",
    name: "Llama 4 Maverick",
    strengths: ["conversation", "writing", "quick"],
    costTier: "cheap",
    mode: "api",
    contextWindow: 128_000,
    supportsVision: true,
    supportsTools: false,
    notes: "Open-source frontier. Good price/performance.",
  },
  {
    id: "openrouter:qwen-3-235b",
    provider: "openrouter",
    model: "qwen/qwen3-235b-a22b",
    name: "Qwen 3 235B",
    strengths: ["code", "analysis", "writing"],
    costTier: "cheap",
    mode: "api",
    contextWindow: 128_000,
    supportsVision: false,
    supportsTools: true,
    notes: "Strong open-weight model. Very competitive.",
  },
]

// =============================================================================
// Helpers
// =============================================================================

export function getModel(id: string): ModelDef | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id)
}

export function getModelsByProvider(provider: Provider): ModelDef[] {
  return MODEL_REGISTRY.filter((m) => m.provider === provider)
}

export function getModelsByStrength(task: TaskType): ModelDef[] {
  return MODEL_REGISTRY.filter((m) => m.strengths.includes(task))
}

export function getFreeModels(): ModelDef[] {
  return MODEL_REGISTRY.filter((m) => m.costTier === "free")
}

export function getCheapModels(): ModelDef[] {
  return MODEL_REGISTRY.filter((m) => m.costTier === "free" || m.costTier === "cheap")
}
