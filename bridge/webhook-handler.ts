/**
 * Webhook Handler -- Express middleware for webhook-triggered routines.
 *
 * Registers a catch-all route at POST /hooks/:path that:
 * 1. Looks up the routine_trigger by webhook_path
 * 2. Validates HMAC-SHA256 signature if webhook_secret is set
 * 3. Triggers the routine via the routine engine
 * 4. Returns 202 Accepted with the run ID
 */

import { createHmac } from "node:crypto"
import type { Router, Request, Response } from "express"
import { Router as createRouter } from "express"
import { routineEngine } from "./routine-engine.js"
import * as db from "./db.js"

// =============================================================================
// HMAC Validation
// =============================================================================

function validateSignature(
  body: string,
  secret: string,
  signature: string
): boolean {
  const expected = createHmac("sha256", secret).update(body).digest("hex")
  // Constant-time comparison
  if (expected.length !== signature.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return mismatch === 0
}

// =============================================================================
// Webhook Router
// =============================================================================

export function createWebhookRouter(): Router {
  const router = createRouter()

  router.post("/hooks/:path", async (req: Request, res: Response) => {
    const hookPath = `/hooks/${req.params.path}`

    try {
      // Look up trigger by webhook_path
      const trigger = await db.getRoutineTriggerByWebhookPath(hookPath)
      if (!trigger) {
        res.status(404).json({ error: "Webhook not found" })
        return
      }

      // Validate HMAC signature if secret is set
      if (trigger.webhook_secret) {
        const signature = req.headers["x-signature"] as string
        if (!signature) {
          res.status(401).json({ error: "Missing X-Signature header" })
          return
        }

        const rawBody = JSON.stringify(req.body)
        if (!validateSignature(rawBody, trigger.webhook_secret as string, signature)) {
          res.status(401).json({ error: "Invalid signature" })
          return
        }
      }

      // Check that the routine exists and is active
      const routine = await db.getRoutineById(trigger.routine_id as string)
      if (!routine) {
        res.status(404).json({ error: "Routine not found" })
        return
      }
      if (routine.status !== "active") {
        res.status(409).json({ error: `Routine is ${routine.status}, not active` })
        return
      }

      // Trigger the routine
      const runId = await routineEngine.executeRun(
        trigger.routine_id as string,
        "webhook",
        req.body || {}
      )

      if (!runId) {
        res.status(409).json({ error: "Skipped due to concurrency policy" })
        return
      }

      res.status(202).json({ runId, status: "queued" })

    } catch (err) {
      console.error("[webhook] Error handling hook:", err)
      res.status(500).json({ error: "Internal webhook error" })
    }
  })

  return router
}
