/**
 * Session Manager -- handles agent execution sessions.
 *
 * Uses the model router to pick the best model, then dispatches
 * to the appropriate provider adapter.
 *
 * Each channel (agent) gets one session at a time. New messages queue.
 */

import { routeModel, type RouteRequest } from "./router.js"
import { executeWithProvider, type StreamCallbacks } from "./providers.js"
import type { TaskType } from "./models.js"

const TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

export interface ExecuteOptions {
  channel: string
  message: string
  workspaceId: string
  // Model routing
  agentModel?: string          // pinned model ID from agent config
  taskType?: TaskType          // hint for router (default: "conversation")
  needsSearch?: boolean        // triggers Perplexity
  needsVision?: boolean
  systemPrompt?: string        // agent persona
  // Streaming callbacks
  onToken: (token: string) => void
  onToolUse: (tool: string, input: unknown) => void
  onComplete: (result: string) => void
  onError: (error: string) => void
  onModelSelected?: (modelId: string, reason: string) => void
}

interface Session {
  channel: string
  abortController: AbortController
  startedAt: number
}

export class SessionManager {
  private sessions = new Map<string, Session>()

  activeSessions(): string[] {
    return Array.from(this.sessions.keys())
  }

  cancel(channel: string): void {
    const session = this.sessions.get(channel)
    if (session) {
      session.abortController.abort()
      this.sessions.delete(channel)
    }
  }

  async execute(opts: ExecuteOptions): Promise<void> {
    // Cancel existing session on this channel
    if (this.sessions.has(opts.channel)) {
      this.cancel(opts.channel)
    }

    const abortController = new AbortController()
    const session: Session = {
      channel: opts.channel,
      abortController,
      startedAt: Date.now(),
    }
    this.sessions.set(opts.channel, session)

    // Timeout protection
    const timeout = setTimeout(() => {
      opts.onError("Session timed out after 10 minutes")
      this.cancel(opts.channel)
    }, TIMEOUT_MS)

    try {
      // --- Route to best model ---
      const routeReq: RouteRequest = {
        taskType: opts.taskType || "conversation",
        agentModel: opts.agentModel,
        needsVision: opts.needsVision,
        needsSearch: opts.needsSearch,
        needsTools: true,
        preferCLI: true, // CLI-first economics
      }

      const route = routeModel(routeReq)

      console.log(
        `[session] ${opts.channel} -> ${route.model.name} (${route.reason})`
      )

      // Notify client which model was selected
      opts.onModelSelected?.(route.model.id, route.reason)

      // --- Execute via provider ---
      const callbacks: StreamCallbacks = {
        onToken: opts.onToken,
        onToolUse: opts.onToolUse,
        onComplete: opts.onComplete,
        onError: opts.onError,
      }

      await executeWithProvider(
        route.model.provider,
        {
          model: route.model.model,
          message: opts.message,
          systemPrompt: opts.systemPrompt,
          signal: abortController.signal,
        },
        callbacks
      )
    } finally {
      clearTimeout(timeout)
      this.sessions.delete(opts.channel)
    }
  }
}
