/**
 * Plugin Worker Wrapper -- runs inside a Worker thread.
 *
 * Loads the plugin module and bridges JSON-RPC 2.0 calls between
 * the host (PluginLoader) and the plugin's tool handlers.
 */

import { parentPort, workerData } from "node:worker_threads"

// =============================================================================
// Types (duplicated here to avoid import issues in Worker context)
// =============================================================================

interface WorkerRequest {
  jsonrpc: "2.0"
  id: string | number
  method: "initialize" | "call_tool" | "shutdown"
  params?: Record<string, unknown>
}

interface WorkerResponse {
  jsonrpc: "2.0"
  id: string | number
  result?: unknown
  error?: { code: number; message: string }
}

// =============================================================================
// Plugin state
// =============================================================================

const { pluginPath, pluginName } = workerData as {
  pluginPath: string
  pluginName: string
  manifest: Record<string, unknown>
}

let plugin: Record<string, unknown> | null = null
let toolHandlers = new Map<string, (params: Record<string, unknown>) => Promise<unknown>>()

// =============================================================================
// Logger (sends events to host)
// =============================================================================

const logger = {
  info: (...args: unknown[]) => sendEvent("log", { level: "info", message: args.join(" ") }),
  warn: (...args: unknown[]) => sendEvent("log", { level: "warn", message: args.join(" ") }),
  error: (...args: unknown[]) => sendEvent("log", { level: "error", message: args.join(" ") }),
}

function sendEvent(method: string, params: Record<string, unknown>): void {
  parentPort?.postMessage({ jsonrpc: "2.0", method, params })
}

function sendResponse(id: string | number, result?: unknown, error?: { code: number; message: string }): void {
  const msg: WorkerResponse = { jsonrpc: "2.0", id }
  if (error) {
    msg.error = error
  } else {
    msg.result = result
  }
  parentPort?.postMessage(msg)
}

// =============================================================================
// Message handler
// =============================================================================

parentPort?.on("message", async (msg: WorkerRequest) => {
  if (!msg.jsonrpc || msg.jsonrpc !== "2.0") return

  try {
    switch (msg.method) {
      case "initialize":
        await handleInitialize(msg.id, msg.params || {})
        break

      case "call_tool":
        await handleCallTool(msg.id, msg.params || {})
        break

      case "shutdown":
        handleShutdown(msg.id)
        break

      default:
        sendResponse(msg.id, undefined, {
          code: -32601,
          message: `Unknown method: ${msg.method}`,
        })
    }
  } catch (err) {
    sendResponse(msg.id, undefined, {
      code: -32603,
      message: err instanceof Error ? err.message : "Internal error",
    })
  }
})

// =============================================================================
// Method handlers
// =============================================================================

async function handleInitialize(
  id: string | number,
  params: Record<string, unknown>
): Promise<void> {
  try {
    // Dynamic import of the plugin module
    plugin = await import(pluginPath)

    // If the plugin exports an init function, call it
    if (typeof (plugin as any).initialize === "function") {
      await (plugin as any).initialize({
        logger,
        config: params.config || {},
      })
    }

    // Register tool handlers if the plugin exports them
    if (typeof (plugin as any).tools === "object") {
      const tools = (plugin as any).tools as Record<
        string,
        (params: Record<string, unknown>) => Promise<unknown>
      >
      for (const [name, handler] of Object.entries(tools)) {
        if (typeof handler === "function") {
          toolHandlers.set(name, handler)
        }
      }
    }

    // Also check for a getTools() function
    if (typeof (plugin as any).getTools === "function") {
      const tools = (plugin as any).getTools() as Array<{
        name: string
        handler: (params: Record<string, unknown>) => Promise<unknown>
      }>
      for (const tool of tools) {
        toolHandlers.set(tool.name, tool.handler)
      }
    }

    logger.info(`Initialized with ${toolHandlers.size} tool handler(s)`)
    sendResponse(id, { initialized: true, tools: Array.from(toolHandlers.keys()) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Init failed"
    logger.error(`Init error: ${msg}`)
    sendResponse(id, undefined, { code: -32603, message: msg })
  }
}

async function handleCallTool(
  id: string | number,
  params: Record<string, unknown>
): Promise<void> {
  const toolName = params.name as string
  const toolArgs = (params.arguments || {}) as Record<string, unknown>

  if (!toolName) {
    sendResponse(id, undefined, { code: -32602, message: "Missing tool name" })
    return
  }

  const handler = toolHandlers.get(toolName)
  if (!handler) {
    sendResponse(id, undefined, {
      code: -32601,
      message: `Unknown tool: ${toolName}`,
    })
    return
  }

  try {
    const result = await handler(toolArgs)
    sendResponse(id, result)
  } catch (err) {
    sendResponse(id, undefined, {
      code: -32603,
      message: err instanceof Error ? err.message : "Tool execution failed",
    })
  }
}

function handleShutdown(id: string | number): void {
  logger.info("Shutting down")

  // Call plugin cleanup if available
  if (plugin && typeof (plugin as any).shutdown === "function") {
    try {
      ;(plugin as any).shutdown()
    } catch {
      // Ignore cleanup errors
    }
  }

  sendResponse(id, { shutdown: true })

  // Give time for the response to be sent
  setTimeout(() => process.exit(0), 100)
}
