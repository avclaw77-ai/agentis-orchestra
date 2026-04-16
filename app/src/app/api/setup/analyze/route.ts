import { NextRequest } from "next/server"

/**
 * POST /api/setup/analyze
 *
 * AI-powered company analysis. Takes company info, researches the business,
 * and proposes an initial department/agent configuration.
 *
 * Uses Perplexity (if available) for web research, then an LLM to
 * generate the proposal. Falls back to template-based suggestions
 * if no AI provider is available.
 *
 * Streams the response as SSE for real-time progress feedback.
 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { companyName, website, industry, description, locale } = body

  if (!companyName) {
    return new Response(JSON.stringify({ error: "companyName required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // SSE stream for progress + final result
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        )
      }

      try {
        // --- Step 1: Research the company ---
        send("progress", { step: "research", message: `Researching ${companyName}...` })

        let companyContext = ""

        // Try Perplexity first for web research
        const perplexityKey = process.env.PERPLEXITY_API_KEY
        if (perplexityKey && website) {
          try {
            const researchPrompt = `Analyze this company for an AI agent deployment:
Company: ${companyName}
Website: ${website}
Industry: ${industry || "Unknown"}
Description: ${description || "Not provided"}

Research their website and tell me:
1. What does this company do? (2-3 sentences)
2. What are their main business processes? (list 5-8)
3. What departments would they likely have? (list them)
4. What repetitive tasks could AI agents handle? (list 5-10 specific ones)
5. What industry-specific knowledge would agents need?

Be specific to THIS company, not generic.`

            const perplexityRes = await fetch("https://api.perplexity.ai/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${perplexityKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "sonar-pro",
                messages: [{ role: "user", content: researchPrompt }],
              }),
            })

            if (perplexityRes.ok) {
              const data = await perplexityRes.json()
              companyContext = data.choices?.[0]?.message?.content || ""
              send("progress", { step: "research_done", message: "Company research complete" })
            }
          } catch {
            send("progress", { step: "research_fallback", message: "Using industry templates instead" })
          }
        } else {
          send("progress", { step: "research_skip", message: "Using industry templates (no Perplexity key)" })
        }

        // --- Step 2: Generate proposal ---
        send("progress", { step: "generating", message: "Designing your agent team..." })

        const proposal = await generateProposal({
          companyName,
          website,
          industry,
          description,
          companyContext,
          locale,
        })

        send("progress", { step: "complete", message: "Proposal ready" })
        send("proposal", proposal)
      } catch (err) {
        send("error", {
          error: err instanceof Error ? err.message : "Analysis failed",
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}

// =============================================================================
// Proposal generation
// =============================================================================

interface ProposalDepartment {
  id: string
  name: string
  description: string
  color: string
  agents: Array<{
    id: string
    name: string
    role: string
    persona: string
    model: string
    suggestedSchedule: string | null // cron expression
    suggestedScheduleLabel: string | null
  }>
}

interface Proposal {
  summary: string
  departments: ProposalDepartment[]
  suggestedRoutines: Array<{
    name: string
    description: string
    steps: Array<{ agentId: string; prompt: string }>
    schedule: string | null
  }>
}

const DEPARTMENT_COLORS: Record<string, string> = {
  engineering: "#3b82f6",
  operations: "#ec4899",
  sales: "#10b981",
  marketing: "#f59e0b",
  finance: "#6366f1",
  research: "#f59e0b",
  design: "#8b5cf6",
  support: "#6366f1",
  hr: "#14b8a6",
  logistics: "#f97316",
  quality: "#10b981",
  procurement: "#8b5cf6",
  production: "#ef4444",
}

async function generateProposal(params: {
  companyName: string
  website?: string
  industry?: string
  description?: string
  companyContext: string
  locale?: string
}): Promise<Proposal> {
  const { companyName, industry, description, companyContext } = params

  // Try OpenRouter or OpenAI for the structured proposal
  const openrouterKey = process.env.OPENROUTER_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  const systemPrompt = `You are an AI operations architect. Given information about a company, design their ideal AI agent team.

Output ONLY valid JSON matching this schema:
{
  "summary": "2-3 sentence summary of why this team structure fits the company",
  "departments": [
    {
      "id": "lowercase-kebab",
      "name": "Display Name",
      "description": "What this department handles",
      "agents": [
        {
          "id": "lowercase-kebab",
          "name": "Short Name",
          "role": "One-line role description",
          "persona": "2-3 sentence persona: expertise, communication style, priorities",
          "model": "claude-cli:sonnet",
          "suggestedSchedule": "0 9 * * 1-5",
          "suggestedScheduleLabel": "Every weekday at 9am"
        }
      ]
    }
  ],
  "suggestedRoutines": [
    {
      "name": "Routine Name",
      "description": "What it does",
      "steps": [{"agentId": "agent-id", "prompt": "What to do"}],
      "schedule": "0 8 * * 1-5"
    }
  ]
}

Rules:
- 2-5 departments, 1-3 agents per department
- Use "claude-cli:sonnet" as default model (free via Pro subscription)
- Use "perplexity:sonar-pro" for research-focused agents
- Use "claude-cli:haiku" for simple/fast tasks
- Personas should be specific to the company and industry, not generic
- Suggest 1-3 routines that automate real business processes
- Agent IDs must be unique across all departments
- Be specific to the company's actual business, not generic templates`

  const userPrompt = `Design an AI agent team for:
Company: ${companyName}
Industry: ${industry || "Not specified"}
Description: ${description || "Not provided"}

${companyContext ? `Additional research about this company:\n${companyContext}` : "No additional research available -- use industry knowledge to make specific suggestions."}`

  let llmResponse = ""

  if (openrouterKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://agentislab.ai",
          "X-Title": "AgentisOrchestra Setup",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        llmResponse = data.choices?.[0]?.message?.content || ""
      }
    } catch {
      // Fall through to next provider
    }
  }

  if (!llmResponse && openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        llmResponse = data.choices?.[0]?.message?.content || ""
      }
    } catch {
      // Fall through to template
    }
  }

  // Parse LLM response
  if (llmResponse) {
    try {
      const parsed = JSON.parse(llmResponse) as unknown as Proposal
      // Add colors to departments
      for (const dept of parsed.departments) {
        if (!dept.color) {
          const key = dept.id.replace(/-/g, "").toLowerCase()
          dept.color = DEPARTMENT_COLORS[key] || DEPARTMENT_COLORS[dept.id] || "#3b82f6"
        }
      }
      return parsed
    } catch {
      // Fall through to template
    }
  }

  // --- Fallback: industry-based template ---
  return generateTemplateProposal(companyName, industry)
}

function generateTemplateProposal(companyName: string, industry?: string): Proposal {
  const ind = (industry || "technology").toLowerCase()

  const INDUSTRY_TEMPLATES: Record<string, Proposal> = {
    manufacturing: {
      summary: `For ${companyName}, we recommend an operations-focused agent team covering production monitoring, quality control, and supply chain management.`,
      departments: [
        {
          id: "operations",
          name: "Operations",
          description: "Production planning and monitoring",
          color: "#ec4899",
          agents: [
            { id: "scheduler", name: "Scheduler", role: "Production planning and scheduling", persona: `Production planning specialist for ${companyName}. Optimizes schedules, tracks capacity, flags bottlenecks.`, model: "claude-cli:sonnet", suggestedSchedule: "0 7 * * 1-5", suggestedScheduleLabel: "Every weekday at 7am" },
            { id: "monitor", name: "Monitor", role: "Production monitoring and alerts", persona: `Operations monitor for ${companyName}. Tracks KPIs, detects anomalies, reports status.`, model: "claude-cli:haiku", suggestedSchedule: "*/30 * * * *", suggestedScheduleLabel: "Every 30 minutes" },
          ],
        },
        {
          id: "quality",
          name: "Quality",
          description: "Quality control and compliance",
          color: "#10b981",
          agents: [
            { id: "qa-inspector", name: "Inspector", role: "Quality inspection and compliance", persona: `Quality inspector for ${companyName}. Reviews reports, flags non-conformances, tracks corrective actions.`, model: "claude-cli:sonnet", suggestedSchedule: "0 8 * * 1-5", suggestedScheduleLabel: "Every weekday at 8am" },
          ],
        },
        {
          id: "sales",
          name: "Sales",
          description: "Quoting and customer management",
          color: "#10b981",
          agents: [
            { id: "quoter", name: "Quoter", role: "RFQ response and quote preparation", persona: `Sales quotation specialist for ${companyName}. Drafts quotes, estimates costs, follows up on RFQs.`, model: "claude-cli:sonnet", suggestedSchedule: "0 9 * * 1-5", suggestedScheduleLabel: "Every weekday at 9am" },
          ],
        },
      ],
      suggestedRoutines: [
        { name: "Morning Production Brief", description: "Daily production status and priorities", steps: [{ agentId: "monitor", prompt: "Generate today's production status report" }, { agentId: "scheduler", prompt: "Review status and flag scheduling conflicts for today" }], schedule: "0 7 * * 1-5" },
      ],
    },
    technology: {
      summary: `For ${companyName}, we recommend a development-focused team with research capability and operational support.`,
      departments: [
        {
          id: "engineering",
          name: "Engineering",
          description: "Software development and infrastructure",
          color: "#3b82f6",
          agents: [
            { id: "dev", name: "Dev", role: "Software development", persona: `Full-stack developer for ${companyName}. Writes clean, tested code. Follows team conventions.`, model: "claude-cli:sonnet", suggestedSchedule: "0 * * * *", suggestedScheduleLabel: "Every hour" },
            { id: "qa", name: "QA", role: "Testing and code review", persona: `QA engineer for ${companyName}. Reviews PRs, writes tests, catches bugs before production.`, model: "claude-cli:haiku", suggestedSchedule: null, suggestedScheduleLabel: null },
          ],
        },
        {
          id: "research",
          name: "Research",
          description: "Technology scouting and competitive intelligence",
          color: "#f59e0b",
          agents: [
            { id: "rnd", name: "RnD", role: "Research and prototyping", persona: `Research lead for ${companyName}. Evaluates new technologies, builds quick prototypes, tracks competitors.`, model: "perplexity:sonar-pro", suggestedSchedule: "0 9,17 * * 1-5", suggestedScheduleLabel: "Twice daily (9am, 5pm)" },
          ],
        },
        {
          id: "operations",
          name: "Operations",
          description: "CEO support and daily operations",
          color: "#ec4899",
          agents: [
            { id: "ops-assist", name: "Assistant", role: "Executive assistant and coordination", persona: `Operations assistant for ${companyName}. Manages schedules, drafts communications, tracks action items.`, model: "claude-cli:sonnet", suggestedSchedule: "0 8 * * 1-5", suggestedScheduleLabel: "Every weekday at 8am" },
          ],
        },
      ],
      suggestedRoutines: [
        { name: "Daily Tech Roundup", description: "Morning summary of industry news and competitor updates", steps: [{ agentId: "rnd", prompt: "Search for latest technology news relevant to our industry" }], schedule: "0 8 * * 1-5" },
      ],
    },
  }

  // Match industry or default to technology
  const template = INDUSTRY_TEMPLATES[ind] || INDUSTRY_TEMPLATES["technology"]

  // More industries use the technology template with adjusted names
  if (!INDUSTRY_TEMPLATES[ind]) {
    template.summary = `For ${companyName} in ${industry || "your industry"}, we recommend a balanced agent team covering operations, research, and support.`
  }

  return template
}
