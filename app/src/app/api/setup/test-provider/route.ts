import { NextRequest, NextResponse } from "next/server"

interface TestProviderRequest {
  provider: string
  apiKey?: string
}

interface TestProviderResponse {
  provider: string
  valid: boolean
  error?: string
  models?: string[]
}

// ---------------------------------------------------------------------------
// Rate limiter: 5 requests per minute per IP (in-memory, resets on restart)
// ---------------------------------------------------------------------------
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60_000
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(ip)
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (bucket.count >= RATE_LIMIT) return false
  bucket.count++
  return true
}

// Cleanup stale buckets every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [ip, bucket] of rateBuckets) {
    if (now > bucket.resetAt) rateBuckets.delete(ip)
  }
}, 300_000).unref?.()

/**
 * POST /api/setup/test-provider
 *
 * Tests a provider connection:
 * - claude-cli: checks if the CLI binary exists
 * - openrouter: hits the models endpoint
 * - perplexity: makes a minimal completions call
 * - openai: lists models
 *
 * Rate-limited: 5 requests/minute per IP (pre-auth endpoint)
 */
export async function POST(req: NextRequest) {
  // Rate limit check
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429 }
    )
  }

  let body: TestProviderRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const { provider, apiKey } = body

  if (!provider) {
    return NextResponse.json(
      { error: "provider is required" },
      { status: 400 }
    )
  }

  let result: TestProviderResponse

  switch (provider) {
    case "claude-cli":
      result = await testClaudeCli()
      break
    case "openrouter":
      result = await testOpenRouter(apiKey)
      break
    case "perplexity":
      result = await testPerplexity(apiKey)
      break
    case "openai":
      result = await testOpenAI(apiKey)
      break
    default:
      return NextResponse.json(
        { error: `Unknown provider: ${provider}` },
        { status: 400 }
      )
  }

  return NextResponse.json(result)
}

// =============================================================================
// Provider test implementations
// =============================================================================

async function testClaudeCli(): Promise<TestProviderResponse> {
  // The bridge runs on the host where Claude CLI is installed.
  // Ask the bridge's /health endpoint to confirm it's running.
  const bridgeUrl = process.env.BRIDGE_URL || "http://localhost:3847"
  const bridgeToken = process.env.BRIDGE_TOKEN || ""

  try {
    const res = await fetch(`${bridgeUrl}/health`, {
      headers: bridgeToken ? { Authorization: `Bearer ${bridgeToken}` } : {},
      signal: AbortSignal.timeout(5_000),
    })

    if (res.ok) {
      const data = await res.json()
      // Bridge is running on host with access to CLI
      return {
        provider: "claude-cli",
        valid: true,
        models: ["claude-cli:opus", "claude-cli:sonnet", "claude-cli:haiku"],
      }
    }

    // Bridge unreachable but ANTHROPIC_API_KEY exists as fallback
    if (process.env.ANTHROPIC_API_KEY) {
      return {
        provider: "claude-cli",
        valid: true,
        models: ["claude-cli:opus", "claude-cli:sonnet", "claude-cli:haiku"],
      }
    }

    return {
      provider: "claude-cli",
      valid: false,
      error: "Bridge not reachable. Ensure the bridge service is running.",
    }
  } catch (err) {
    // Fallback: try running claude locally (for non-Docker setups)
    try {
      const cliPath = process.env.CLAUDE_CLI_PATH || "claude"
      const { execFile } = await import("child_process")
      const { promisify } = await import("util")
      const execFileAsync = promisify(execFile)
      await execFileAsync(cliPath, ["--version"], { timeout: 10_000 })

      return {
        provider: "claude-cli",
        valid: true,
        models: ["claude-cli:opus", "claude-cli:sonnet", "claude-cli:haiku"],
      }
    } catch {
      if (process.env.ANTHROPIC_API_KEY) {
        return {
          provider: "claude-cli",
          valid: true,
          models: ["claude-cli:opus", "claude-cli:sonnet", "claude-cli:haiku"],
        }
      }

      return {
        provider: "claude-cli",
        valid: false,
        error: "Claude CLI not found. Install it on the host or set ANTHROPIC_API_KEY.",
      }
    }
  }
}

async function testOpenRouter(
  apiKey: string | undefined
): Promise<TestProviderResponse> {
  if (!apiKey?.trim()) {
    return {
      provider: "openrouter",
      valid: false,
      error: "API key is required",
    }
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return {
        provider: "openrouter",
        valid: false,
        error: `OpenRouter returned ${res.status}: ${text.slice(0, 200)}`,
      }
    }

    const data = await res.json()
    const modelIds = Array.isArray(data?.data)
      ? data.data.slice(0, 10).map((m: { id: string }) => m.id)
      : []

    return {
      provider: "openrouter",
      valid: true,
      models: modelIds,
    }
  } catch (err) {
    return {
      provider: "openrouter",
      valid: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to connect to OpenRouter",
    }
  }
}

async function testPerplexity(
  apiKey: string | undefined
): Promise<TestProviderResponse> {
  if (!apiKey?.trim()) {
    return {
      provider: "perplexity",
      valid: false,
      error: "API key is required",
    }
  }

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      // 401 = invalid key, but other errors might mean the key is valid
      if (res.status === 401 || res.status === 403) {
        return {
          provider: "perplexity",
          valid: false,
          error: "Invalid API key",
        }
      }
      return {
        provider: "perplexity",
        valid: false,
        error: `Perplexity returned ${res.status}: ${text.slice(0, 200)}`,
      }
    }

    return {
      provider: "perplexity",
      valid: true,
      models: ["sonar", "sonar-pro", "sonar-reasoning"],
    }
  } catch (err) {
    return {
      provider: "perplexity",
      valid: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to connect to Perplexity",
    }
  }
}

async function testOpenAI(
  apiKey: string | undefined
): Promise<TestProviderResponse> {
  if (!apiKey?.trim()) {
    return {
      provider: "openai",
      valid: false,
      error: "API key is required",
    }
  }

  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      if (res.status === 401) {
        return {
          provider: "openai",
          valid: false,
          error: "Invalid API key",
        }
      }
      return {
        provider: "openai",
        valid: false,
        error: `OpenAI returned ${res.status}: ${text.slice(0, 200)}`,
      }
    }

    const data = await res.json()
    // Return all chat-capable models the API key has access to
    // Filter out embedding, tts, whisper, dall-e, and moderation models
    const excludePatterns = ["embedding", "tts", "whisper", "dall-e", "moderation", "babbage", "davinci", "text-"]
    const modelIds = Array.isArray(data?.data)
      ? data.data
          .map((m: { id: string }) => m.id)
          .filter((id: string) => !excludePatterns.some((p) => id.includes(p)))
          .sort()
      : []

    return {
      provider: "openai",
      valid: true,
      models: modelIds,
    }
  } catch (err) {
    return {
      provider: "openai",
      valid: false,
      error:
        err instanceof Error ? err.message : "Failed to connect to OpenAI",
    }
  }
}
