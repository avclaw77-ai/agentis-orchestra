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

/**
 * POST /api/setup/test-provider
 *
 * Tests a provider connection:
 * - claude-cli: checks if the CLI binary exists
 * - openrouter: hits the models endpoint
 * - perplexity: makes a minimal completions call
 * - openai: lists models
 */
export async function POST(req: NextRequest) {
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
  const cliPath = process.env.CLAUDE_CLI_PATH || "claude"

  try {
    const { execFile } = await import("child_process")
    const { promisify } = await import("util")
    const execFileAsync = promisify(execFile)

    const { stdout } = await execFileAsync(cliPath, ["--version"], {
      timeout: 10_000,
    })

    return {
      provider: "claude-cli",
      valid: true,
      models: ["claude-cli:opus", "claude-cli:sonnet", "claude-cli:haiku"],
    }
  } catch (err) {
    // Also check if ANTHROPIC_API_KEY is set as fallback
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
      error: `Claude CLI not found at "${cliPath}". Install it or set CLAUDE_CLI_PATH.`,
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
    // Filter to notable models
    const notable = ["gpt-4o", "gpt-4o-mini", "o3", "o3-mini", "o4-mini"]
    const modelIds = Array.isArray(data?.data)
      ? data.data
          .map((m: { id: string }) => m.id)
          .filter((id: string) => notable.some((n) => id.includes(n)))
          .slice(0, 10)
      : []

    return {
      provider: "openai",
      valid: true,
      models: modelIds.length > 0 ? modelIds : ["gpt-4o", "gpt-4o-mini"],
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
