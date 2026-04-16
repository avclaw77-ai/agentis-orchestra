/**
 * Plugin system type definitions.
 *
 * Plugins extend AgentisOrchestra with custom tools, scheduled jobs,
 * and model adapters. Each plugin runs in an isolated Worker thread.
 */

import type * as dbModule from "../db.js"

// =============================================================================
// Plugin Manifest (manifest.json in plugin directory)
// =============================================================================

export interface PluginManifest {
  /** Unique plugin name, e.g. "agentis-plugin-slack" */
  name: string
  /** Semver version, e.g. "1.0.0" */
  version: string
  /** Plugin API version for compatibility checking */
  apiVersion: number
  /** Human-readable description */
  description: string
  /** Plugin author (optional) */
  author?: string
  /** What this plugin provides */
  capabilities: PluginCapability[]
  /** Tool definitions (if capability includes 'tools') */
  tools?: PluginToolDef[]
  /** Scheduled job definitions (if capability includes 'jobs') */
  jobs?: PluginJobDef[]
  /** Entry point file relative to plugin directory (default: "index.js") */
  main?: string
}

export type PluginCapability = "tools" | "jobs" | "adapter"

// =============================================================================
// Plugin Tool Definition
// =============================================================================

export interface PluginToolDef {
  /** Tool name (will be namespaced as "plugin-name:tool-name") */
  name: string
  /** Human-readable description */
  description: string
  /** JSON Schema for input parameters */
  inputSchema: Record<string, unknown>
}

// =============================================================================
// Plugin Job Definition
// =============================================================================

export interface PluginJobDef {
  /** Unique job key within this plugin */
  key: string
  /** Cron expression (e.g. "0 9 * * *") */
  schedule: string
  /** Human-readable description */
  description: string
}

// =============================================================================
// Plugin Context (provided to plugins at initialization)
// =============================================================================

export interface PluginContext {
  /** Database access layer */
  db: typeof dbModule
  /** Structured logger */
  logger: PluginLogger
  /** Plugin-specific configuration */
  config: Record<string, unknown>
}

export interface PluginLogger {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

// =============================================================================
// Plugin Adapter (for custom model providers)
// =============================================================================

export interface PluginAdapter {
  execute(
    req: {
      model: string
      message: string
      systemPrompt?: string
      signal: AbortSignal
    },
    cb: {
      onToken: (token: string) => void
      onComplete: (result: string) => void
      onError: (error: string) => void
    }
  ): Promise<void>
}

// =============================================================================
// Loaded Plugin (internal state)
// =============================================================================

export interface LoadedPlugin {
  manifest: PluginManifest
  worker: import("node:worker_threads").Worker
  status: "loading" | "ready" | "error" | "stopped"
  crashCount: number
  lastCrash?: Date
  error?: string
}

// =============================================================================
// Worker Messages (JSON-RPC 2.0 over postMessage)
// =============================================================================

export interface WorkerRequest {
  jsonrpc: "2.0"
  id: string | number
  method: "initialize" | "call_tool" | "shutdown"
  params?: Record<string, unknown>
}

export interface WorkerResponse {
  jsonrpc: "2.0"
  id: string | number
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

export interface WorkerEvent {
  jsonrpc: "2.0"
  method: "log" | "status"
  params: Record<string, unknown>
}
