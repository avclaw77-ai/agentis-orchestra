import http from "node:http"
import express from "express"
import cors from "cors"
import { SessionManager } from "./session-manager.js"
import { MODEL_REGISTRY, type Provider } from "./models.js"
import * as db from "./db.js"
// cost-tracker now shares db.ts pool -- no separate init needed
import { heartbeatEngine } from "./heartbeat.js"
import { routineEngine } from "./routine-engine.js"
import { scheduler } from "./scheduler.js"
import { createWebhookRouter } from "./webhook-handler.js"
import { MCPServer } from "./mcp/server.js"
import { getAllTools as getMCPTools } from "./mcp/tools.js"
import { pluginLoader } from "./plugins/loader.js"

const PORT = parseInt(process.env.PORT || "3847", 10)
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN || ""
const KEEPALIVE_MS = 15_000

// =============================================================================
// Initialize persistence + heartbeat
// =============================================================================

db.initDb()
db.resetAllAgentsIdle()
heartbeatEngine.start(10_000) // 10-second tick interval
scheduler.start() // Routine cron scheduler

// =============================================================================
// Initialize MCP server + plugin system
// =============================================================================

const mcpServer = new MCPServer()

async function initMCPAndPlugins() {
  // Register core tools
  mcpServer.registerTools(getMCPTools())

  // Discover and load plugins
  await pluginLoader.loadAll()

  // Register plugin tools with MCP server
  const pluginTools = pluginLoader.getAllTools()
  mcpServer.registerTools(pluginTools)

  // Start MCP server
  await mcpServer.start()
  console.log(`[bridge] MCP server: ${mcpServer.getToolCount()} tools registered`)
}

initMCPAndPlugins().catch((err) => {
  console.error("[bridge] MCP/plugin init error:", err)
})

// =============================================================================
// Express setup (JSON routes)
// =============================================================================

const app = express()
app.use(cors({ origin: process.env.APP_URL || "http://localhost:3000" }))
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
    heartbeat: heartbeatEngine.isRunning(),
    scheduler: scheduler.isRunning(),
    mcp: mcpServer.isRunning(),
    mcpTools: mcpServer.getToolCount(),
    plugins: pluginLoader.getLoadedPlugins().length,
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
app.get("/models", async (_req, res) => {
  const providerStatus: { provider: Provider; name: string; configured: boolean; mode: string; description: string; color: string }[] = [
    {
      provider: "claude-cli",
      name: "Claude (CLI)",
      configured: true,
      mode: "cli",
      description: "Pro subscription -- flat monthly cost, included in sub",
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
      description: "GPT-5.4 family, o-series -- reasoning and structured output",
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

  // For OpenAI: also fetch live model list from API to show all available models
  let liveOpenAIModels: string[] = []
  if (process.env.OPENAI_API_KEY) {
    try {
      const apiRes = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        signal: AbortSignal.timeout(5_000),
      })
      if (apiRes.ok) {
        const data = await apiRes.json()
        const exclude = ["embedding", "tts", "whisper", "dall-e", "moderation", "babbage", "davinci", "text-"]
        liveOpenAIModels = (data?.data || [])
          .map((m: { id: string }) => m.id)
          .filter((id: string) => !exclude.some((p) => id.includes(p)))
          .sort()
      }
    } catch {
      // Live fetch failed, use registry only
    }
  }

  res.json({
    providers: providerStatus,
    models: availableModels,
    liveOpenAIModels,
    heartbeatStatus: heartbeatEngine.isRunning(),
  })
})

// =============================================================================
// Heartbeat API routes
// =============================================================================

// List heartbeat runs for an agent
app.get("/agents/:id/runs", async (req, res) => {
  const runs = await db.getRunsByAgent(req.params.id)
  res.json({ runs })
})

// Manual trigger for an agent
app.post("/agents/:id/trigger", async (req, res) => {
  const { prompt, departmentId } = req.body
  if (!prompt) {
    res.status(400).json({ error: "prompt required" })
    return
  }
  const wakeupId = await heartbeatEngine.triggerManual(
    req.params.id,
    prompt,
    departmentId
  )
  res.json({ wakeupId, status: "queued" })
})

// Get a single run's details
app.get("/runs/:id", async (req, res) => {
  const run = await db.getRunById(req.params.id)
  if (!run) {
    res.status(404).json({ error: "Run not found" })
    return
  }
  res.json({ run })
})

// =============================================================================
// Live run SSE stream -- poll run status until complete
// =============================================================================

app.get("/runs/:id/stream", async (req, res) => {
  const runId = req.params.id
  const run = await db.getRunById(runId)
  if (!run) {
    res.status(404).json({ error: "Run not found" })
    return
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  })

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  let closed = false
  res.on("close", () => { closed = true })

  // Poll run status every 2 seconds until terminal
  const terminal = ["succeeded", "failed", "cancelled", "timed_out"]
  send("status", { run })

  let errorCount = 0
  const poll = setInterval(async () => {
    if (closed) { clearInterval(poll); return }
    try {
      const latest = await db.getRunById(runId)
      if (!latest) { clearInterval(poll); res.end(); return }
      errorCount = 0
      send("status", { run: latest })
      if (terminal.includes(latest.status as string)) {
        clearInterval(poll)
        send("done", { status: latest.status })
        res.end()
      }
    } catch {
      errorCount++
      if (errorCount > 10) {
        clearInterval(poll)
        send("error", { message: "Too many DB errors, stopping stream" })
        res.end()
      }
    }
  }, 2000)

  // Safety timeout: 5 minutes max
  setTimeout(() => {
    if (!closed) {
      clearInterval(poll)
      send("timeout", { message: "Stream timed out" })
      res.end()
    }
  }, 300_000)
})

// =============================================================================
// System logs -- return recent bridge activity
// =============================================================================

const logBuffer: Array<{ timestamp: string; level: string; message: string; source: string }> = []
const MAX_LOG_BUFFER = 500

// Override console to capture logs
const origLog = console.log
const origError = console.error
const origWarn = console.warn

function captureLog(level: string, args: unknown[]) {
  const message = args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" ")
  const source = message.startsWith("[") ? message.match(/\[([^\]]+)\]/)?.[1] || "system" : "system"
  logBuffer.push({ timestamp: new Date().toISOString(), level, message, source })
  if (logBuffer.length > MAX_LOG_BUFFER) logBuffer.shift()
}

console.log = (...args: unknown[]) => { captureLog("info", args); origLog.apply(console, args) }
console.error = (...args: unknown[]) => { captureLog("error", args); origError.apply(console, args) }
console.warn = (...args: unknown[]) => { captureLog("warn", args); origWarn.apply(console, args) }

app.get("/logs", (req, res) => {
  const parsed = parseInt(req.query.limit as string || "100", 10)
  const limit = Math.min(Number.isNaN(parsed) ? 100 : parsed, 500)
  const level = req.query.level as string || undefined
  const source = req.query.source as string || undefined

  let filtered = logBuffer
  if (level) filtered = filtered.filter((l) => l.level === level)
  if (source) filtered = filtered.filter((l) => l.source === source)

  res.json({ logs: filtered.slice(-limit), total: filtered.length })
})

// =============================================================================
// Plugin API routes
// =============================================================================

// List loaded plugins
app.get("/plugins", (_req, res) => {
  res.json({ plugins: pluginLoader.getLoadedPlugins() })
})

// Restart a crashed plugin
app.post("/plugins/:name/restart", async (req, res) => {
  const success = await pluginLoader.restartPlugin(req.params.name)
  if (success) {
    // Re-register plugin tools with MCP
    const pluginTools = pluginLoader.getAllTools()
    mcpServer.registerTools(pluginTools)
    res.json({ restarted: true })
  } else {
    res.status(404).json({ error: "Plugin not found or restart failed" })
  }
})

// =============================================================================
// Webhook handler (catch-all for /hooks/*)
// =============================================================================

app.use(createWebhookRouter())

// =============================================================================
// Routine API routes
// =============================================================================

// Manual trigger for a routine
app.post("/routines/:id/trigger", async (req, res) => {
  const { payload } = req.body || {}
  try {
    const runId = await routineEngine.executeRun(req.params.id, "manual", payload || {})
    if (!runId) {
      res.status(409).json({ error: "Skipped due to concurrency policy" })
      return
    }
    // Reload scheduler in case status changed
    scheduler.reload()
    res.json({ runId, status: "queued" })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    res.status(500).json({ error: msg })
  }
})

// List runs for a routine
app.get("/routines/:id/runs", async (req, res) => {
  const limit = parseInt(req.query.limit as string || "50", 10)
  const offset = parseInt(req.query.offset as string || "0", 10)
  const runs = await db.getRoutineRunsByRoutine(req.params.id, limit, offset)
  res.json({ runs })
})

// Get a single routine run with step results
app.get("/routine-runs/:id", async (req, res) => {
  const run = await db.getRoutineRunById(req.params.id)
  if (!run) {
    res.status(404).json({ error: "Run not found" })
    return
  }
  res.json({ run })
})

// Notify scheduler to reload (called by app API after routine create/update)
app.post("/scheduler/reload", async (_req, res) => {
  await scheduler.reload()
  res.json({ reloaded: true, schedules: scheduler.isRunning() })
})

// =============================================================================
// File management -- browse, read, upload agent outputs
// =============================================================================

import { promises as fsPromises } from "node:fs"
import pathModule from "node:path"
import { createWriteStream } from "node:fs"

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || "/opt/agentis-orchestra/workspace"

// Ensure workspace exists
fsPromises.mkdir(WORKSPACE_ROOT, { recursive: true }).catch(() => {})
fsPromises.mkdir(pathModule.join(WORKSPACE_ROOT, "uploads"), { recursive: true }).catch(() => {})
fsPromises.mkdir(pathModule.join(WORKSPACE_ROOT, "outputs"), { recursive: true }).catch(() => {})
fsPromises.mkdir(pathModule.join(WORKSPACE_ROOT, "previews"), { recursive: true }).catch(() => {})

// List files
app.get("/files", requireAuth, async (req, res) => {
  const reqPath = (req.query.path as string) || "/"
  const agent = (req.query.agent as string) || ""

  const basePath = agent
    ? pathModule.join(WORKSPACE_ROOT, "outputs", agent)
    : pathModule.join(WORKSPACE_ROOT, reqPath.startsWith("/") ? reqPath.slice(1) : reqPath)

  const safePath = pathModule.resolve(basePath)
  if (!safePath.startsWith(pathModule.resolve(WORKSPACE_ROOT))) {
    res.status(403).json({ error: "Access denied" })
    return
  }

  try {
    await fsPromises.mkdir(safePath, { recursive: true })
    const entries = await fsPromises.readdir(safePath, { withFileTypes: true })
    const files = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = pathModule.join(safePath, entry.name)
        const stat = await fsPromises.stat(fullPath).catch(() => null)
        return {
          name: entry.name,
          path: pathModule.relative(WORKSPACE_ROOT, fullPath),
          isDirectory: entry.isDirectory(),
          size: stat?.size || 0,
          modified: stat?.mtime?.toISOString() || null,
          extension: entry.isDirectory() ? null : pathModule.extname(entry.name).slice(1).toLowerCase(),
        }
      })
    )
    res.json({ path: pathModule.relative(WORKSPACE_ROOT, safePath), files })
  } catch (err) {
    res.status(500).json({ error: "Failed to list directory" })
  }
})

// Read file content
app.get("/files/read", requireAuth, async (req, res) => {
  const filePath = req.query.path as string
  if (!filePath) { res.status(400).json({ error: "path required" }); return }

  const safePath = pathModule.resolve(WORKSPACE_ROOT, filePath.startsWith("/") ? filePath.slice(1) : filePath)
  if (!safePath.startsWith(pathModule.resolve(WORKSPACE_ROOT))) {
    res.status(403).json({ error: "Access denied" })
    return
  }

  try {
    const stat = await fsPromises.stat(safePath)
    if (!stat.isFile()) { res.status(400).json({ error: "Not a file" }); return }

    const ext = pathModule.extname(safePath).toLowerCase()
    const textExts = [".md", ".txt", ".json", ".yaml", ".yml", ".csv", ".html", ".css", ".js", ".ts", ".tsx", ".jsx", ".py", ".sh", ".sql", ".xml", ".toml", ".env", ".log"]
    const isText = textExts.includes(ext)

    if (isText) {
      const content = await fsPromises.readFile(safePath, "utf-8")
      res.setHeader("Content-Type", ext === ".json" ? "application/json" : ext === ".md" ? "text/markdown" : "text/plain")
      res.send(content)
    } else {
      // Binary -- serve as download
      const mimeMap: Record<string, string> = {
        ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".gif": "image/gif", ".svg": "image/svg+xml", ".zip": "application/zip",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }
      res.setHeader("Content-Type", mimeMap[ext] || "application/octet-stream")
      res.setHeader("Content-Disposition", `inline; filename="${pathModule.basename(safePath)}"`)
      const stream = await fsPromises.readFile(safePath)
      res.send(stream)
    }
  } catch {
    res.status(404).json({ error: "File not found" })
  }
})

// Upload file
app.post("/files/upload", requireAuth, async (req, res) => {
  // Simple multipart handling -- for production, use multer
  const chunks: Buffer[] = []
  req.on("data", (chunk: Buffer) => chunks.push(chunk))
  req.on("end", async () => {
    try {
      const body = Buffer.concat(chunks)
      const contentType = req.headers["content-type"] || ""

      if (!contentType.includes("multipart/form-data")) {
        // JSON body with base64 content
        const data = JSON.parse(body.toString())
        const { filename, content, path: targetDir, agentId } = data

        if (!filename || !content) {
          res.status(400).json({ error: "filename and content required" })
          return
        }

        const dir = agentId
          ? pathModule.join(WORKSPACE_ROOT, "outputs", agentId)
          : pathModule.join(WORKSPACE_ROOT, targetDir || "uploads")
        await fsPromises.mkdir(dir, { recursive: true })

        const filePath = pathModule.join(dir, filename)
        const safePath = pathModule.resolve(filePath)
        if (!safePath.startsWith(pathModule.resolve(WORKSPACE_ROOT))) {
          res.status(403).json({ error: "Access denied" })
          return
        }

        // Handle base64 or raw text
        if (content.startsWith("data:")) {
          const base64Data = content.split(",")[1]
          await fsPromises.writeFile(safePath, Buffer.from(base64Data, "base64"))
        } else {
          await fsPromises.writeFile(safePath, content, "utf-8")
        }

        res.json({
          uploaded: true,
          path: pathModule.relative(WORKSPACE_ROOT, safePath),
          size: (await fsPromises.stat(safePath)).size,
        })
      } else {
        // Multipart -- extract filename and content from boundary
        res.status(400).json({ error: "Use JSON upload: { filename, content, agentId? }" })
      }
    } catch (err) {
      res.status(500).json({ error: "Upload failed" })
    }
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
    let parsed: { channel: string; message: string; departmentId?: string }
    try {
      parsed = JSON.parse(body)
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "Invalid JSON" }))
      return
    }

    const { channel, message, departmentId } = parsed

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

    // Client disconnect
    let cancelled = false
    res.on("close", () => {
      cancelled = true
      clearInterval(keepalive)
      sessionManager.cancel(channel)
    })

    try {
      // Route chat through the heartbeat engine
      await heartbeatEngine.triggerChat(
        channel,         // agent ID = channel
        message,
        departmentId || undefined,
        {
          onToken: (token: string) => {
            if (!cancelled) send("token", { token })
          },
          onToolUse: (tool: string, input: unknown) => {
            if (!cancelled) send("tool_use", { tool, input })
          },
          onToolResult: (tool: string, output: unknown) => {
            if (!cancelled) send("tool_result", { tool, output })
          },
          onThinking: (text: string) => {
            if (!cancelled) send("thinking", { text })
          },
          onSystem: (text: string) => {
            if (!cancelled) send("system", { text })
          },
          onComplete: (result: string) => {
            if (!cancelled) send("done", { result })
          },
          onError: (error: string) => {
            if (!cancelled) send("error", { error })
          },
          onModelSelected: (modelId: string, reason: string) => {
            if (!cancelled) send("model", { modelId, reason })
          },
        }
      )
    } catch (err) {
      if (!cancelled) {
        send("error", {
          error: err instanceof Error ? err.message : "Unknown error",
        })
      }
    } finally {
      clearInterval(keepalive)
      res.end()
    }
  })
})

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[bridge] AgentisOrchestra bridge listening on :${PORT}`)
  console.log(`[bridge] Adapter mode: ${process.env.ADAPTER_MODE || "sdk"}`)
  console.log(`[bridge] Heartbeat engine: ${heartbeatEngine.isRunning() ? "running" : "stopped"}`)
  console.log(`[bridge] Routine scheduler: ${scheduler.isRunning() ? "running" : "stopped"}`)
  console.log(`[bridge] MCP server: ${mcpServer.isRunning() ? `running on :${process.env.MCP_PORT || "3848"}` : "starting..."}`)
  console.log(`[bridge] Plugins: ${pluginLoader.getLoadedPlugins().length} loaded`)
})
