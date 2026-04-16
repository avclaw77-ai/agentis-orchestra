import http from "node:http"
import express from "express"
import cors from "cors"
import { SessionManager } from "./session-manager.js"
import { MODEL_REGISTRY, type Provider } from "./models.js"

const PORT = parseInt(process.env.PORT || "3847", 10)
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN || ""
const KEEPALIVE_MS = 15_000

// =============================================================================
// Express setup (JSON routes)
// =============================================================================

const app = express()
app.use(cors())
app.use(express.json({ limit: "10mb" }))

// Auth middleware
function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (!BRIDGE_TOKEN) return next() // dev mode -- no auth
  const token = req.headers.authorization?.replace("Bearer ", "")
  if (token !== BRIDGE_TOKEN) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }
  next()
}

app.use(requireAuth)

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    sessions: sessionManager.activeSessions(),
  })
})

// List active sessions
app.get("/sessions", (_req, res) => {
  res.json({ sessions: sessionManager.activeSessions() })
})

// Cancel a session
app.post("/chat/cancel", (req, res) => {
  const { channel } = req.body
  if (!channel) {
    res.status(400).json({ error: "channel required" })
    return
  }
  sessionManager.cancel(channel)
  res.json({ cancelled: true })
})

// Model registry + provider status
app.get("/models", (_req, res) => {
  const providerStatus: { provider: Provider; name: string; configured: boolean; mode: string; description: string; color: string }[] = [
    {
      provider: "claude-cli",
      name: "Claude (CLI)",
      configured: true, // always available with Pro sub
      mode: "cli",
      description: "Pro subscription -- flat monthly cost, no per-token billing",
      color: "#d97706",
    },
    {
      provider: "openrouter",
      name: "OpenRouter",
      configured: !!process.env.OPENROUTER_API_KEY,
      mode: "api",
      description: "100+ models -- GPT, Gemini, Llama, DeepSeek, Qwen, and more",
      color: "#6366f1",
    },
    {
      provider: "perplexity",
      name: "Perplexity",
      configured: !!process.env.PERPLEXITY_API_KEY,
      mode: "api",
      description: "Web search with citations -- research and fact-checking",
      color: "#0ea5e9",
    },
    {
      provider: "openai",
      name: "OpenAI",
      configured: !!process.env.OPENAI_API_KEY,
      mode: "api",
      description: "GPT-4o, o3 -- structured output and reasoning",
      color: "#10b981",
    },
  ]

  // Only return models whose provider is configured
  const configuredProviders = new Set(
    providerStatus.filter((p) => p.configured).map((p) => p.provider)
  )
  const availableModels = MODEL_REGISTRY.filter((m) =>
    configuredProviders.has(m.provider)
  )

  res.json({
    providers: providerStatus,
    models: availableModels,
  })
})

// =============================================================================
// Raw HTTP server for unbuffered SSE streaming
// =============================================================================

const sessionManager = new SessionManager()

const server = http.createServer((req, res) => {
  // Let Express handle non-chat routes
  if (req.url !== "/chat" || req.method !== "POST") {
    app(req, res)
    return
  }

  // Auth check
  if (BRIDGE_TOKEN) {
    const token = req.headers.authorization?.replace("Bearer ", "")
    if (token !== BRIDGE_TOKEN) {
      res.writeHead(401, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Unauthorized" }))
      return
    }
  }

  // Parse body
  let body = ""
  req.on("data", (chunk) => (body += chunk))
  req.on("end", async () => {
    let parsed: { channel: string; message: string; workspaceId?: string }
    try {
      parsed = JSON.parse(body)
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Invalid JSON" }))
      return
    }

    const { channel, message, workspaceId } = parsed

    if (!channel || !message) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "channel and message required" }))
      return
    }

    // SSE headers -- no buffering
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
    })

    // Keepalive to prevent timeout
    const keepalive = setInterval(() => {
      res.write(": keepalive\n\n")
    }, KEEPALIVE_MS)

    // Stream handler
    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    try {
      await sessionManager.execute({
        channel,
        message,
        workspaceId: workspaceId || "default",
        onToken: (token: string) => send("token", { token }),
        onToolUse: (tool: string, input: unknown) =>
          send("tool_use", { tool, input }),
        onComplete: (result: string) => send("done", { result }),
        onError: (error: string) => send("error", { error }),
      })
    } catch (err) {
      send("error", {
        error: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      clearInterval(keepalive)
      res.end()
    }

    // Client disconnect
    res.on("close", () => {
      clearInterval(keepalive)
      sessionManager.cancel(channel)
    })
  })
})

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[bridge] AgentisOrchestra bridge listening on :${PORT}`)
  console.log(`[bridge] Adapter mode: ${process.env.ADAPTER_MODE || "sdk"}`)
})
