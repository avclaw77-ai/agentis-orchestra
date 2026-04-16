/**
 * Plugin Loader -- discovers, loads, and manages plugins.
 *
 * Each plugin runs in an isolated Worker thread for safety.
 * Communication is JSON-RPC 2.0 over postMessage/onmessage.
 * Crash recovery uses exponential backoff.
 */

import { Worker } from "node:worker_threads"
import { readdir, readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import type { MCPTool } from "../mcp/server.js"
import type {
  PluginManifest,
  LoadedPlugin,
  WorkerRequest,
  WorkerResponse,
  WorkerEvent,
} from "./types.js"

// =============================================================================
// Constants
// =============================================================================

const MAX_CRASH_COUNT = 10
const BASE_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 5 * 60 * 1_000 // 5 minutes
const CURRENT_API_VERSION = 1
const WORKER_WRAPPER_PATH = new URL("./worker-wrapper.js", import.meta.url).pathname

// =============================================================================
// Plugin Loader
// =============================================================================

export class PluginLoader {
  private plugins = new Map<string, LoadedPlugin>()
  private pluginsDir: string
  private pendingRequests = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: Error) => void }
  >()
  private requestCounter = 0

  constructor(pluginsDir?: string) {
    this.pluginsDir = pluginsDir ?? resolve(process.cwd(), "plugins")
  }

  // ---------------------------------------------------------------------------
  // Discovery
  // ---------------------------------------------------------------------------

  async discover(): Promise<PluginManifest[]> {
    const manifests: PluginManifest[] = []

    try {
      const entries = await readdir(this.pluginsDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (entry.name.startsWith(".") || entry.name === "node_modules") continue

        const manifestPath = join(this.pluginsDir, entry.name, "manifest.json")
        try {
          const raw = await readFile(manifestPath, "utf-8")
          const manifest: PluginManifest = JSON.parse(raw)

          // Validate required fields
          if (!manifest.name || !manifest.version || !manifest.apiVersion) {
            console.warn(`[plugins] Invalid manifest in ${entry.name}: missing required fields`)
            continue
          }

          if (manifest.apiVersion > CURRENT_API_VERSION) {
            console.warn(
              `[plugins] ${manifest.name} requires API v${manifest.apiVersion}, current is v${CURRENT_API_VERSION}`
            )
            continue
          }

          manifests.push(manifest)
        } catch {
          // No manifest.json or invalid JSON -- skip silently
        }
      }
    } catch {
      // plugins/ directory doesn't exist or can't be read
      console.log("[plugins] No plugins directory found")
    }

    return manifests
  }

  // ---------------------------------------------------------------------------
  // Loading / Unloading
  // ---------------------------------------------------------------------------

  async loadAll(): Promise<void> {
    const manifests = await this.discover()
    console.log(`[plugins] Discovered ${manifests.length} plugin(s)`)

    for (const manifest of manifests) {
      const pluginPath = join(this.pluginsDir, manifest.name)
      try {
        await this.load(pluginPath, manifest)
      } catch (err) {
        console.error(`[plugins] Failed to load ${manifest.name}:`, err)
      }
    }
  }

  async load(pluginPath: string, manifest?: PluginManifest): Promise<void> {
    // Read manifest if not provided
    if (!manifest) {
      const raw = await readFile(join(pluginPath, "manifest.json"), "utf-8")
      manifest = JSON.parse(raw) as PluginManifest
    }

    if (this.plugins.has(manifest.name)) {
      console.warn(`[plugins] ${manifest.name} already loaded, unloading first`)
      await this.unload(manifest.name)
    }

    const entryPoint = join(pluginPath, manifest.main || "index.js")

    const worker = new Worker(WORKER_WRAPPER_PATH, {
      workerData: {
        pluginPath: entryPoint,
        pluginName: manifest.name,
        manifest,
      },
    })

    const loaded: LoadedPlugin = {
      manifest,
      worker,
      status: "loading",
      crashCount: 0,
    }

    this.plugins.set(manifest.name, loaded)

    // Set up worker event handlers
    worker.on("message", (msg: WorkerResponse | WorkerEvent) => {
      if ("id" in msg && msg.id !== undefined) {
        // Response to a request
        const pending = this.pendingRequests.get(String(msg.id))
        if (pending) {
          this.pendingRequests.delete(String(msg.id))
          if ("error" in msg && msg.error) {
            pending.reject(new Error(msg.error.message))
          } else {
            pending.resolve(msg.result)
          }
        }
      } else if ("method" in msg) {
        // Event from worker
        this.handleWorkerEvent(manifest!.name, msg as WorkerEvent)
      }
    })

    worker.on("error", (err) => {
      console.error(`[plugins] ${manifest!.name} worker error:`, err)
      loaded.status = "error"
      loaded.error = err.message
      loaded.lastCrash = new Date()
      loaded.crashCount++
      this.handleCrash(manifest!.name, pluginPath)
    })

    worker.on("exit", (code) => {
      if (code !== 0 && loaded.status !== "stopped") {
        console.error(`[plugins] ${manifest!.name} worker exited with code ${code}`)
        loaded.status = "error"
        loaded.lastCrash = new Date()
        loaded.crashCount++
        this.handleCrash(manifest!.name, pluginPath)
      }
    })

    // Initialize the plugin
    try {
      await this.sendRequest(manifest.name, "initialize", {
        config: {},
      })
      loaded.status = "ready"
      console.log(`[plugins] ${manifest.name} v${manifest.version} loaded (${manifest.capabilities.join(", ")})`)
    } catch (err) {
      loaded.status = "error"
      loaded.error = err instanceof Error ? err.message : "Init failed"
      console.error(`[plugins] ${manifest.name} init failed:`, err)
    }
  }

  async unload(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName)
    if (!plugin) return

    plugin.status = "stopped"

    try {
      // Try graceful shutdown
      await this.sendRequest(pluginName, "shutdown", {}).catch(() => {})
    } catch {
      // Ignore -- we're terminating anyway
    }

    await plugin.worker.terminate()
    this.plugins.delete(pluginName)
    console.log(`[plugins] ${pluginName} unloaded`)
  }

  // ---------------------------------------------------------------------------
  // Tool access
  // ---------------------------------------------------------------------------

  getAllTools(): MCPTool[] {
    const tools: MCPTool[] = []

    for (const [pluginName, plugin] of this.plugins) {
      if (plugin.status !== "ready") continue
      if (!plugin.manifest.tools) continue

      for (const toolDef of plugin.manifest.tools) {
        const namespacedName = `${pluginName}:${toolDef.name}`
        tools.push({
          name: namespacedName,
          description: `[${pluginName}] ${toolDef.description}`,
          inputSchema: toolDef.inputSchema,
          handler: async (params) => this.callTool(namespacedName, params),
        })
      }
    }

    return tools
  }

  async callTool(
    namespacedName: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    const [pluginName, toolName] = namespacedName.split(":", 2)
    const plugin = this.plugins.get(pluginName)

    if (!plugin) throw new Error(`Plugin not found: ${pluginName}`)
    if (plugin.status !== "ready") throw new Error(`Plugin ${pluginName} is ${plugin.status}`)

    return this.sendRequest(pluginName, "call_tool", {
      name: toolName,
      arguments: params,
    })
  }

  // ---------------------------------------------------------------------------
  // Plugin info
  // ---------------------------------------------------------------------------

  getLoadedPlugins(): Array<{
    name: string
    version: string
    status: string
    capabilities: string[]
    toolCount: number
    crashCount: number
    error?: string
  }> {
    return Array.from(this.plugins.values()).map((p) => ({
      name: p.manifest.name,
      version: p.manifest.version,
      status: p.status,
      capabilities: p.manifest.capabilities,
      toolCount: p.manifest.tools?.length ?? 0,
      crashCount: p.crashCount,
      error: p.error,
    }))
  }

  async restartPlugin(pluginName: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginName)
    if (!plugin) return false

    const pluginPath = join(this.pluginsDir, pluginName)
    await this.unload(pluginName)

    try {
      await this.load(pluginPath)
      return true
    } catch {
      return false
    }
  }

  // ---------------------------------------------------------------------------
  // Worker communication (JSON-RPC 2.0)
  // ---------------------------------------------------------------------------

  private sendRequest(
    pluginName: string,
    method: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    const plugin = this.plugins.get(pluginName)
    if (!plugin) return Promise.reject(new Error(`Plugin not found: ${pluginName}`))

    const id = String(++this.requestCounter)

    return new Promise((resolve, reject) => {
      // Timeout after 30 seconds
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Request to ${pluginName} timed out`))
      }, 30_000)

      this.pendingRequests.set(id, {
        resolve: (v) => {
          clearTimeout(timeout)
          resolve(v)
        },
        reject: (e) => {
          clearTimeout(timeout)
          reject(e)
        },
      })

      const msg: WorkerRequest = {
        jsonrpc: "2.0",
        id,
        method: method as WorkerRequest["method"],
        params,
      }

      plugin.worker.postMessage(msg)
    })
  }

  // ---------------------------------------------------------------------------
  // Crash recovery (exponential backoff)
  // ---------------------------------------------------------------------------

  private handleCrash(pluginName: string, pluginPath: string): void {
    const plugin = this.plugins.get(pluginName)
    if (!plugin) return

    if (plugin.crashCount >= MAX_CRASH_COUNT) {
      console.error(
        `[plugins] ${pluginName} crashed ${MAX_CRASH_COUNT} times -- giving up`
      )
      plugin.status = "error"
      plugin.error = `Stopped after ${MAX_CRASH_COUNT} consecutive crashes`
      return
    }

    const backoffMs = Math.min(
      BASE_BACKOFF_MS * Math.pow(2, plugin.crashCount - 1),
      MAX_BACKOFF_MS
    )

    console.log(
      `[plugins] ${pluginName} crash #${plugin.crashCount} -- restarting in ${backoffMs}ms`
    )

    setTimeout(async () => {
      try {
        // Remove the old entry before reloading
        this.plugins.delete(pluginName)
        await this.load(pluginPath)
        // Reset crash count on successful restart
        const reloaded = this.plugins.get(pluginName)
        if (reloaded) reloaded.crashCount = plugin.crashCount // preserve count
      } catch (err) {
        console.error(`[plugins] ${pluginName} restart failed:`, err)
      }
    }, backoffMs)
  }

  // ---------------------------------------------------------------------------
  // Worker event handling
  // ---------------------------------------------------------------------------

  private handleWorkerEvent(pluginName: string, event: WorkerEvent): void {
    if (event.method === "log") {
      const level = (event.params.level as string) || "info"
      const msg = event.params.message as string
      console.log(`[plugin:${pluginName}] [${level}] ${msg}`)
    }
  }
}

// =============================================================================
// Singleton
// =============================================================================

export const pluginLoader = new PluginLoader()
