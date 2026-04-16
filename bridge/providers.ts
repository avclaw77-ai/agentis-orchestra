/**
 * Provider adapters -- each provider has its own execution logic.
 *
 * All providers implement the same streaming interface so the bridge
 * doesn't care which provider is handling the request.
 */

import type { Provider } from "./models.js"

// =============================================================================
// Common streaming interface
// =============================================================================

export interface StreamCallbacks {
  onToken: (token: string) => void
  onToolUse: (tool: string, input: unknown) => void
  onComplete: (result: string) => void
  onError: (error: string) => void
}

export interface ProviderRequest {
  model: string            // provider-specific model ID
  message: string
  systemPrompt?: string
  history?: { role: string; content: string }[]
  signal: AbortSignal
}

// =============================================================================
// Claude CLI Provider (Pro subscription -- flat cost)
// =============================================================================

export async function executeCLI(
  req: ProviderRequest,
  cb: StreamCallbacks
): Promise<void> {
  const cliPath = process.env.CLAUDE_CLI_PATH || "/usr/local/bin/claude"

  // Spawn: /usr/bin/env -i <cli> --output-format stream-json -p "message"
  const { spawn } = await import("node:child_process")

  const args = [
    "--output-format", "stream-json",
    "--model", req.model,
    "-p", req.message,
  ]

  if (req.systemPrompt) {
    args.push("--system-prompt", req.systemPrompt)
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(cliPath, args, {
      env: { PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin" },
      stdio: ["ignore", "pipe", "pipe"],
    })

    let fullResult = ""

    req.signal.addEventListener("abort", () => {
      proc.kill("SIGTERM")
    })

    proc.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString()
      // Parse stream-json lines
      for (const line of text.split("\n").filter(Boolean)) {
        try {
          const event = JSON.parse(line)
          if (event.type === "assistant" && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === "text") {
                cb.onToken(block.text)
                fullResult += block.text
              }
              if (block.type === "tool_use") {
                cb.onToolUse(block.name, block.input)
              }
            }
          }
          // stream-json "result" events
          if (event.type === "result" && event.result) {
            fullResult = event.result
          }
        } catch {
          // Not JSON -- might be a partial line, raw token output
          cb.onToken(line)
          fullResult += line
        }
      }
    })

    proc.stderr.on("data", (chunk: Buffer) => {
      const err = chunk.toString().trim()
      if (err) console.error(`[cli:stderr] ${err}`)
    })

    proc.on("close", (code) => {
      if (code === 0 || fullResult) {
        cb.onComplete(fullResult)
        resolve()
      } else {
        cb.onError(`CLI exited with code ${code}`)
        reject(new Error(`CLI exited with code ${code}`))
      }
    })

    proc.on("error", (err) => {
      cb.onError(err.message)
      reject(err)
    })
  })
}

// =============================================================================
// OpenRouter Provider (100+ models via single API)
// =============================================================================

export async function executeOpenRouter(
  req: ProviderRequest,
  cb: StreamCallbacks
): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set")

  const messages: { role: string; content: string }[] = []
  if (req.systemPrompt) {
    messages.push({ role: "system", content: req.systemPrompt })
  }
  if (req.history) {
    messages.push(...req.history)
  }
  messages.push({ role: "user", content: req.message })

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://agentislab.ai",
      "X-Title": "AgentisOrchestra",
    },
    body: JSON.stringify({
      model: req.model,
      messages,
      stream: true,
    }),
    signal: req.signal,
  })

  if (!res.ok || !res.body) {
    throw new Error(`OpenRouter ${res.status}: ${await res.text()}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let fullResult = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const data = line.slice(6).trim()
      if (data === "[DONE]") continue

      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta?.content
        if (delta) {
          cb.onToken(delta)
          fullResult += delta
        }
      } catch {
        // skip
      }
    }
  }

  cb.onComplete(fullResult)
}

// =============================================================================
// Perplexity Provider (Research with citations)
// =============================================================================

export async function executePerplexity(
  req: ProviderRequest,
  cb: StreamCallbacks
): Promise<void> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY not set")

  const messages: { role: string; content: string }[] = []
  if (req.systemPrompt) {
    messages.push({ role: "system", content: req.systemPrompt })
  }
  messages.push({ role: "user", content: req.message })

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: req.model,
      messages,
      stream: true,
    }),
    signal: req.signal,
  })

  if (!res.ok || !res.body) {
    throw new Error(`Perplexity ${res.status}: ${await res.text()}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let fullResult = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const data = line.slice(6).trim()
      if (data === "[DONE]") continue

      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta?.content
        if (delta) {
          cb.onToken(delta)
          fullResult += delta
        }
        // Perplexity citations in final message
        if (parsed.citations) {
          const citationBlock = "\n\n---\nSources:\n" +
            parsed.citations.map((c: string, i: number) => `[${i + 1}] ${c}`).join("\n")
          fullResult += citationBlock
        }
      } catch {
        // skip
      }
    }
  }

  cb.onComplete(fullResult)
}

// =============================================================================
// OpenAI Provider (Direct API)
// =============================================================================

export async function executeOpenAI(
  req: ProviderRequest,
  cb: StreamCallbacks
): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY not set")

  const messages: { role: string; content: string }[] = []
  if (req.systemPrompt) {
    messages.push({ role: "system", content: req.systemPrompt })
  }
  if (req.history) {
    messages.push(...req.history)
  }
  messages.push({ role: "user", content: req.message })

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: req.model,
      messages,
      stream: true,
    }),
    signal: req.signal,
  })

  if (!res.ok || !res.body) {
    throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let fullResult = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const data = line.slice(6).trim()
      if (data === "[DONE]") continue

      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta?.content
        if (delta) {
          cb.onToken(delta)
          fullResult += delta
        }
      } catch {
        // skip
      }
    }
  }

  cb.onComplete(fullResult)
}

// =============================================================================
// Dispatcher -- routes to the right provider
// =============================================================================

export async function executeWithProvider(
  provider: Provider,
  req: ProviderRequest,
  cb: StreamCallbacks
): Promise<void> {
  switch (provider) {
    case "claude-cli":
      return executeCLI(req, cb)
    case "openrouter":
      return executeOpenRouter(req, cb)
    case "perplexity":
      return executePerplexity(req, cb)
    case "openai":
      return executeOpenAI(req, cb)
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}
