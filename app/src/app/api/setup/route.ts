import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import {
  company,
  departments,
  agents,
  agentConfigs,
  providerKeys,
} from "@/db/schema"
import { eq } from "drizzle-orm"
import { generateId } from "@/lib/utils"
import { encrypt } from "@/lib/crypto"
import type {
  SetupPayload,
  SetupResult,
  SetupDepartmentPayload,
  SetupProviderPayload,
} from "@/types"

/**
 * POST /api/setup
 *
 * Receives the full setup payload and creates everything in a single transaction:
 * - Company row
 * - Departments
 * - Agents + agent configs
 * - Provider keys
 * - CEO agent (company-level, cross-department)
 * - Sets setup_completed_at
 */
export async function POST(req: NextRequest) {
  // Check if setup already completed
  const existing = await db.select().from(company).limit(1)
  if (existing.length > 0 && existing[0].setupCompletedAt) {
    return NextResponse.json(
      { error: "Setup already completed" },
      { status: 409 }
    )
  }

  let body: SetupPayload
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  // Validate required fields
  if (!body.company?.name?.trim()) {
    return NextResponse.json(
      { error: "Company name is required" },
      { status: 400 }
    )
  }

  if (!body.departments || body.departments.length === 0) {
    return NextResponse.json(
      { error: "At least one department is required" },
      { status: 400 }
    )
  }

  for (const dept of body.departments) {
    if (!dept.name?.trim()) {
      return NextResponse.json(
        { error: `Department name is required for department ${dept.id}` },
        { status: 400 }
      )
    }
    if (!dept.agents || dept.agents.length === 0) {
      return NextResponse.json(
        { error: `At least one agent is required for department "${dept.name}"` },
        { status: 400 }
      )
    }
    for (const agent of dept.agents) {
      if (!agent.name?.trim() || !agent.role?.trim()) {
        return NextResponse.json(
          { error: `Agent name and role are required (department "${dept.name}")` },
          { status: 400 }
        )
      }
    }
  }

  // Check that at least one provider is configured
  // Claude CLI counts as a provider even without an API key (uses Pro subscription)
  const hasCliProvider = body.providers?.some((p) => p.provider === "claude-cli")
  const hasApiProvider = body.providers?.some((p) => p.provider !== "claude-cli" && p.apiKey?.trim())
  if (!hasCliProvider && !hasApiProvider) {
    return NextResponse.json(
      { error: "At least one AI provider must be configured" },
      { status: 400 }
    )
  }

  const now = new Date()
  let totalAgents = 0

  try {
    await db.transaction(async (tx) => {
      // 1. Create or update company
      if (existing.length > 0) {
        await tx
          .update(company)
          .set({
            name: body.company.name.trim(),
            mission: body.company.mission?.trim() || null,
            locale: body.company.locale || "en",
            setupCompletedAt: now,
            updatedAt: now,
          })
          .where(eq(company.id, "default"))
      } else {
        await tx.insert(company).values({
          id: "default",
          name: body.company.name.trim(),
          mission: body.company.mission?.trim() || null,
          locale: body.company.locale || "en",
          setupCompletedAt: now,
        })
      }

      // 2. Create departments and their agents
      for (const dept of body.departments) {
        const deptId = dept.id || generateId("dept")

        await tx.insert(departments).values({
          id: deptId,
          name: dept.name.trim(),
          description: dept.description?.trim() || null,
          color: dept.color || "#3b82f6",
          template: dept.template || null,
        })

        for (const agent of dept.agents) {
          const agentId = agent.id || generateId("agent")

          await tx.insert(agents).values({
            id: agentId,
            departmentId: deptId,
            name: agent.name.trim(),
            displayName: agent.displayName || null,
            role: agent.role.trim(),
            status: "idle",
            isCeo: false,
          })

          await tx.insert(agentConfigs).values({
            id: `${agentId}-config`,
            agentId,
            departmentId: deptId,
            model: agent.model || "claude-sonnet-4-6",
            adapterType: resolveAdapterType(agent.model),
          })

          totalAgents++
        }
      }

      // 3. Create CEO agent (company-level, no department)
      await tx.insert(agents).values({
        id: "ceo",
        departmentId: null,
        name: "CEO",
        role: "Cross-department orchestration and oversight",
        status: "idle",
        isCeo: true,
      })

      await tx.insert(agentConfigs).values({
        id: "ceo-config",
        agentId: "ceo",
        departmentId: null,
        model: "claude-cli:opus",
        adapterType: "cli",
      })

      totalAgents++

      // 4. Store provider keys (skip CLI -- it uses Pro subscription, no API key)
      for (const prov of body.providers) {
        if (prov.provider === "claude-cli") continue // CLI has no API key to store
        if (!prov.apiKey?.trim()) continue
        await tx.insert(providerKeys).values({
          provider: prov.provider,
          apiKeyEncrypted: encrypt(prov.apiKey),
          isValid: true,
          testedAt: now,
        })
      }
    })

    const result: SetupResult = {
      success: true,
      company: body.company.name,
      departmentCount: body.departments.length,
      agentCount: totalAgents,
      providerCount: body.providers.length,
    }

    const response = NextResponse.json(result, { status: 201 })
    response.cookies.set("ao_setup_done", "1", {
      path: "/",
      maxAge: 315360000, // 10 years
      httpOnly: false, // middleware needs to read it
    })
    return response
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error during setup"
    console.error("[setup] Transaction failed:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * GET /api/setup
 *
 * Returns setup status: whether setup is completed or not.
 */
export async function GET() {
  const rows = await db.select().from(company).limit(1)

  if (rows.length === 0) {
    return NextResponse.json({ setupCompleted: false })
  }

  const isComplete = rows[0].setupCompletedAt !== null
  const response = NextResponse.json({
    setupCompleted: isComplete,
    company: isComplete
      ? { name: rows[0].name, locale: rows[0].locale }
      : null,
  })

  // Ensure cookie is set if setup is done (handles cleared-cache scenario)
  if (isComplete) {
    response.cookies.set("ao_setup_done", "1", {
      path: "/",
      maxAge: 315360000,
      httpOnly: false,
    })
  }

  return response
}

// =============================================================================
// Helpers
// =============================================================================

function resolveAdapterType(model: string | undefined): string {
  if (!model) return "sdk"
  if (model.startsWith("claude-cli:")) return "cli"
  if (model.startsWith("perplexity:")) return "api"
  if (model.startsWith("openrouter:")) return "api"
  if (model.startsWith("openai:")) return "api"
  return "sdk"
}
