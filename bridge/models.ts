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
export type CostTier = "subscription" | "cheap" | "standard" | "premium"
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
  | "monitoring"

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
  // --- Claude CLI (Pro subscription -- flat monthly, included in sub) ---
  {
    id: "claude-cli:opus",
    provider: "claude-cli",
    model: "claude-opus-4-6",
    name: "Claude Opus 4.6 (CLI)",
    strengths: ["code", "orchestration", "analysis", "writing", "vision"],
    costTier: "subscription",
    mode: "cli",
    contextWindow: 200_000,
    supportsVision: true,
    supportsTools: true,
    notes: "Most capable. Included in Pro subscription.",
  },
  {
    id: "claude-cli:sonnet",
    provider: "claude-cli",
    model: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6 (CLI)",
    strengths: ["code", "code-review", "analysis", "conversation"],
    costTier: "subscription",
    mode: "cli",
    contextWindow: 200_000,
    supportsVision: true,
    supportsTools: true,
    notes: "Great balance. Included in Pro subscription.",
  },
  {
    id: "claude-cli:haiku",
    provider: "claude-cli",
    model: "claude-haiku-4-5",
    name: "Claude Haiku 4.5 (CLI)",
    strengths: ["quick", "conversation", "code-review", "monitoring"],
    costTier: "subscription",
    mode: "cli",
    contextWindow: 200_000,
    supportsVision: true,
    supportsTools: true,
    notes: "Fastest. Included in Pro subscription.",
  },

  // --- Claude API (per-token, via Anthropic API key) ---
  {
    id: "anthropic:opus",
    provider: "claude-cli",
    model: "claude-opus-4-6",
    name: "Claude Opus 4.6 (API)",
    strengths: ["code", "orchestration", "analysis", "writing", "vision"],
    costTier: "premium",
    mode: "api",
    contextWindow: 200_000,
    supportsVision: true,
    supportsTools: true,
    notes: "Most capable. Per-token via Anthropic API.",
  },
  {
    id: "anthropic:sonnet",
    provider: "claude-cli",
    model: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6 (API)",
    strengths: ["code", "code-review", "analysis", "conversation"],
    costTier: "standard",
    mode: "api",
    contextWindow: 200_000,
    supportsVision: true,
    supportsTools: true,
    notes: "Great balance. Per-token via Anthropic API.",
  },
  {
    id: "anthropic:haiku",
    provider: "claude-cli",
    model: "claude-haiku-4-5",
    name: "Claude Haiku 4.5 (API)",
    strengths: ["quick", "conversation", "code-review", "monitoring"],
    costTier: "cheap",
    mode: "api",
    contextWindow: 200_000,
    supportsVision: true,
    supportsTools: true,
    notes: "Fastest and cheapest Claude. Per-token via Anthropic API.",
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
    id: "openai:gpt-4.1",
    provider: "openai",
    model: "gpt-4.1",
    name: "GPT-4.1",
    strengths: ["code", "writing", "analysis", "conversation"],
    costTier: "standard",
    mode: "api",
    contextWindow: 1_000_000,
    supportsVision: true,
    supportsTools: true,
    notes: "Latest flagship. 1M context. Strong all-rounder.",
  },
  {
    id: "openai:gpt-4.1-mini",
    provider: "openai",
    model: "gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    strengths: ["quick", "conversation", "code-review", "writing"],
    costTier: "cheap",
    mode: "api",
    contextWindow: 1_000_000,
    supportsVision: true,
    supportsTools: true,
    notes: "Cheap and fast. 1M context. Great price/performance.",
  },
  {
    id: "openai:gpt-4.1-nano",
    provider: "openai",
    model: "gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    strengths: ["quick", "monitoring", "conversation"],
    costTier: "cheap",
    mode: "api",
    contextWindow: 1_000_000,
    supportsVision: true,
    supportsTools: true,
    notes: "Cheapest OpenAI. Perfect for triage and simple tasks.",
  },
  {
    id: "openai:o4-mini",
    provider: "openai",
    model: "o4-mini",
    name: "OpenAI o4-mini",
    strengths: ["code", "analysis", "orchestration"],
    costTier: "standard",
    mode: "api",
    contextWindow: 200_000,
    supportsVision: true,
    supportsTools: true,
    notes: "Deep reasoning, fast. Best for complex analysis.",
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
    notes: "Maximum reasoning. Use for the hardest problems.",
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

export function getSubscriptionModels(): ModelDef[] {
  return MODEL_REGISTRY.filter((m) => m.costTier === "subscription")
}

export function getCheapModels(): ModelDef[] {
  return MODEL_REGISTRY.filter((m) => m.costTier === "subscription" || m.costTier === "cheap")
}
