import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"

// POST /api/agents/[id]/analyze -- AI-generate persona + config from NL description
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const { id } = await params
  const { description } = await req.json()

  if (!description) {
    return NextResponse.json({ error: "description required" }, { status: 400 })
  }

  const systemPrompt = `You are an AI agent architect for AgentisOrchestra, a multi-agent orchestration platform.

Given a natural language description of what an agent should do, generate its configuration.

Output ONLY valid JSON matching this schema:
{
  "persona": "2-3 paragraph markdown persona describing the agent's expertise, communication style, priorities, and domain knowledge",
  "guardrails": ["rule 1", "rule 2", "rule 3"],
  "model": "model-id",
  "heartbeatSchedule": "cron expression or null",
  "heartbeatLabel": "human-readable schedule label or null",
  "skills": ["skill-key-1", "skill-key-2"]
}

Available models (pick the best fit):
- "claude-cli:opus" -- Most capable, complex reasoning (free via Pro)
- "claude-cli:sonnet" -- Good balance of speed and quality (free via Pro)
- "claude-cli:haiku" -- Fast, simple tasks (free via Pro)
- "perplexity:sonar-pro" -- Best for research and web search tasks
- "openai:gpt-5.4" -- Strong general purpose
- "openai:gpt-5.4-mini" -- Fast, cost-effective

Rules:
- Persona should be specific to the described role, not generic
- Include 3-5 guardrails relevant to the domain
- Pick the most cost-effective model that fits the task complexity
- Use "claude-cli:sonnet" as default unless there's a clear reason for another
- Suggest a heartbeat schedule if the agent should run autonomously (e.g., monitoring, reporting)
- Suggest relevant skill keys (kebab-case, descriptive)
- Write persona in a professional but direct tone`

  const userPrompt = `Agent ID: ${id}
Description: ${description}

Generate the configuration for this agent.`

  // Try OpenRouter first, then OpenAI
  const openrouterKey = process.env.OPENROUTER_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY

  let llmResponse = ""

  if (openrouterKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://agentislab.ai",
          "X-Title": "AgentisOrchestra",
        },
        body: JSON.stringify({
          model: "openai/gpt-5.4-mini",
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
      // Fall through
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
          model: "gpt-5.4-mini",
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
      // Fall through
    }
  }

  if (!llmResponse) {
    return NextResponse.json(
      { error: "No AI provider available. Configure OpenRouter or OpenAI API key." },
      { status: 503 }
    )
  }

  try {
    const parsed = JSON.parse(llmResponse)
    return NextResponse.json({
      persona: parsed.persona || "",
      guardrails: Array.isArray(parsed.guardrails) ? parsed.guardrails : [],
      model: parsed.model || "claude-cli:sonnet",
      heartbeatSchedule: parsed.heartbeatSchedule || null,
      heartbeatLabel: parsed.heartbeatLabel || null,
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
    })
  } catch {
    return NextResponse.json(
      { error: "Failed to parse AI response" },
      { status: 500 }
    )
  }
}
