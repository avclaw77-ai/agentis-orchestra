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
  if (!body.providers || body.providers.length === 0) {
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

      // 4. Store provider keys
      for (const prov of body.providers) {
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

    return NextResponse.json(result, { status: 201 })
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

  return NextResponse.json({
    setupCompleted: rows[0].setupCompletedAt !== null,
    company: rows[0].setupCompletedAt
      ? { name: rows[0].name, locale: rows[0].locale }
      : null,
  })
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
