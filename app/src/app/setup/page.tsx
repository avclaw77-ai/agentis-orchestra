"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { DEPARTMENT_TEMPLATES, getTemplate } from "@/lib/templates"
import { WelcomeStep } from "@/components/setup/welcome-step"
import { AdminStep } from "@/components/setup/admin-step"
import { CompanyStep, type CompanyProposal } from "@/components/setup/company-step"
import { ProvidersStep } from "@/components/setup/providers-step"
import { DepartmentStep } from "@/components/setup/department-step"
import { AgentsStep } from "@/components/setup/agents-step"
import { ReadyStep } from "@/components/setup/ready-step"
import { WorkshopImportStep } from "@/components/setup/workshop-import-step"
import { workshopToSetupPayload } from "@/lib/workshop-import"

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdminData {
  email: string
  password: string
  name: string
}

interface CompanyData {
  name: string
  mission: string
  website: string
  industry: string
  description: string
}

interface ProviderStatus {
  provider: string
  name: string
  description: string
  color: string
  apiKey: string
  isValid: boolean | null
  testing: boolean
}

interface AgentSetup {
  id: string
  name: string
  displayName: string
  role: string
  model: string
}

interface DepartmentSetup {
  id: string
  name: string
  description: string
  color: string
  template: string | null
  agents: AgentSetup[]
}

const MODEL_OPTIONS = [
  { id: "claude-cli:opus", name: "Claude Opus (CLI)", costTier: "free" },
  { id: "claude-cli:sonnet", name: "Claude Sonnet (CLI)", costTier: "free" },
  { id: "claude-cli:haiku", name: "Claude Haiku (CLI)", costTier: "free" },
  { id: "perplexity:sonar-pro", name: "Perplexity Sonar Pro", costTier: "standard" },
  { id: "perplexity:sonar", name: "Perplexity Sonar", costTier: "cheap" },
  { id: "openai:gpt-4.1", name: "GPT-4.1", costTier: "standard" },
  { id: "openai:gpt-4.1-mini", name: "GPT-4.1 Mini", costTier: "cheap" },
  { id: "openrouter:deepseek-v3", name: "DeepSeek V3", costTier: "cheap" },
  { id: "openrouter:gemini-2.5-pro", name: "Gemini 2.5 Pro", costTier: "standard" },
]

const INITIAL_PROVIDERS: ProviderStatus[] = [
  { provider: "claude-cli", name: "Claude CLI", description: "Pro subscription -- flat monthly, no per-token cost", color: "#d97706", apiKey: "", isValid: null, testing: false },
  { provider: "openrouter", name: "OpenRouter", description: "100+ models -- GPT, Gemini, Llama, DeepSeek, Qwen", color: "#6366f1", apiKey: "", isValid: null, testing: false },
  { provider: "perplexity", name: "Perplexity", description: "Web search with citations -- research & fact-checking", color: "#0ea5e9", apiKey: "", isValid: null, testing: false },
  { provider: "openai", name: "OpenAI", description: "GPT-4o, o3 -- structured output and reasoning", color: "#10b981", apiKey: "", isValid: null, testing: false },
]

const STEPS = ["Welcome", "Admin", "Company", "Workshop", "Providers", "Department", "Agents", "Ready"]

// ─── Component ───────────────────────────────────────────────────────────────

export default function SetupPage() {
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  // If setup is already done, redirect to login (handles cleared-cookie scenario)
  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((d) => {
        if (d.setupCompleted) {
          document.cookie = "ao_setup_done=1; path=/; max-age=315360000"
          window.location.href = "/login"
        }
      })
      .catch(() => {})
  }, [])

  // Step data
  const [locale, setLocale] = useState("en")
  const [admin, setAdmin] = useState<AdminData>({ email: "", password: "", name: "" })
  const [companyData, setCompanyData] = useState<CompanyData>({ name: "", mission: "", website: "", industry: "", description: "" })
  const [proposal, setProposal] = useState<CompanyProposal | null>(null)
  const [providers, setProviders] = useState<ProviderStatus[]>(INITIAL_PROVIDERS)
  const [departments, setDepartments] = useState<DepartmentSetup[]>([])
  const [currentDept, setCurrentDept] = useState<DepartmentSetup>({
    id: "", name: "", description: "", color: "#3b82f6", template: null, agents: [],
  })
  const [currentAgents, setCurrentAgents] = useState<AgentSetup[]>([])

  // ─── Navigation ────────────────────────────────────────────────────────────

  function canAdvance(): boolean {
    switch (step) {
      case 0: return true // welcome
      case 1: return !!admin.email && !!admin.password && admin.password.length >= 8 && !!admin.name
      case 2: return !!companyData.name.trim()
      case 3: return true // workshop import (always skippable)
      case 4: return providers.some((p) => p.isValid === true)
      case 5: return !!currentDept.name.trim()
      case 6: return currentAgents.length > 0
      case 7: return true
      default: return false
    }
  }

  // Workshop import handler -- pre-fills departments, goals, routines
  function handleWorkshopImport(payload: ReturnType<typeof workshopToSetupPayload>) {
    // Set company info from workshop
    if (payload.company.name) {
      setCompanyData((prev) => ({
        ...prev,
        name: payload.company.name || prev.name,
        mission: payload.company.mission || prev.mission,
      }))
    }
    // Set departments with agents
    const depts: DepartmentSetup[] = payload.departments.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      color: d.color,
      template: d.template,
      agents: d.agents.map((a) => ({ id: a.id, name: a.name, displayName: "", role: a.role, model: a.model })),
    }))
    setDepartments(depts)
    // Skip to providers step (step 4) -- departments are pre-filled
    setStep(4)
  }

  function handleNext() {
    if (step === 2 && proposal) {
      // AI analysis auto-populates departments
      const proposedDepts: DepartmentSetup[] = proposal.departments.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        color: d.color,
        template: null,
        agents: d.agents.map((a) => ({ id: a.id, name: a.name, displayName: "", role: a.role, model: a.model })),
      }))
      setDepartments(proposedDepts)
    }
    if (step === 5) {
      // When leaving department step, load template agents if applicable
      if (currentDept.template) {
        const tpl = getTemplate(currentDept.template)
        if (tpl && currentAgents.length === 0) {
          setCurrentAgents(
            tpl.agents.map((a) => ({ id: a.id, name: a.name, displayName: "", role: a.role, model: a.model }))
          )
        }
      }
    }
    if (step === 6) {
      // Save current department + agents (avoid duplicates if editing existing)
      const dept: DepartmentSetup = { ...currentDept, agents: currentAgents }
      setDepartments((prev) => {
        const existingIdx = prev.findIndex((d) => d.id === dept.id && dept.id)
        if (existingIdx >= 0) {
          // Replace existing (back-then-forward scenario)
          const updated = [...prev]
          updated[existingIdx] = dept
          return updated
        }
        return [...prev, dept]
      })
      // Reset for potential next department
      setCurrentDept({ id: "", name: "", description: "", color: "#3b82f6", template: null, agents: [] })
      setCurrentAgents([])
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function handleBack() {
    if (step === 7 && departments.length > 0) {
      // Going back from ready -- pop last department back into editing
      const last = departments[departments.length - 1]
      setDepartments((prev) => prev.slice(0, -1))
      setCurrentDept({ id: last.id, name: last.name, description: last.description, color: last.color, template: last.template, agents: [] })
      setCurrentAgents(last.agents)
      setStep(6) // go to agents step
      return
    }
    setStep((s) => Math.max(s - 1, 0))
  }

  function handleAddDepartment() {
    // Go back to department step to add another
    setCurrentDept({ id: "", name: "", description: "", color: "#3b82f6", template: null, agents: [] })
    setCurrentAgents([])
    setStep(5)
  }

  // ─── Provider testing ──────────────────────────────────────────────────────

  // Auto-detect Claude CLI when providers step loads
  const cliCheckedRef = useRef(false)
  useEffect(() => {
    if (step === 4 && !cliCheckedRef.current) {
      cliCheckedRef.current = true
      // Fire CLI detection
      fetch("/api/setup/test-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "claude-cli" }),
      })
        .then((res) => res.json())
        .then((data) => {
          setProviders((prev) =>
            prev.map((p) =>
              p.provider === "claude-cli" ? { ...p, isValid: data.valid === true, testing: false } : p
            )
          )
        })
        .catch(() => {
          setProviders((prev) =>
            prev.map((p) =>
              p.provider === "claude-cli" ? { ...p, isValid: false, testing: false } : p
            )
          )
        })
    }
  }, [step])

  const handleTestProvider = useCallback(async (provider: string, apiKey: string): Promise<boolean> => {
    setProviders((prev) =>
      prev.map((p) => (p.provider === provider ? { ...p, testing: true } : p))
    )
    try {
      const res = await fetch("/api/setup/test-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      })
      const data = await res.json()
      const valid = data.valid === true
      setProviders((prev) =>
        prev.map((p) => (p.provider === provider ? { ...p, isValid: valid, testing: false } : p))
      )
      return valid
    } catch {
      setProviders((prev) =>
        prev.map((p) => (p.provider === provider ? { ...p, isValid: false, testing: false } : p))
      )
      return false
    }
  }, [])

  const handleKeyChange = useCallback((provider: string, apiKey: string) => {
    setProviders((prev) =>
      prev.map((p) => (p.provider === provider ? { ...p, apiKey, isValid: null } : p))
    )
  }, [])

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function handleLaunch() {
    setSubmitting(true)
    setError("")

    try {
      // 1. Register admin user
      const authRes = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", ...admin }),
      })
      if (!authRes.ok) {
        const d = await authRes.json()
        throw new Error(d.error || "Failed to create admin account")
      }

      // 2. Run full setup
      const setupRes = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: { name: companyData.name, mission: companyData.mission, locale },
          departments: departments.map((d) => ({
            id: d.id || d.name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
            name: d.name,
            description: d.description,
            color: d.color,
            template: d.template,
            agents: d.agents.map((a) => ({
              id: a.id || a.name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
              name: a.name,
              displayName: a.displayName || null,
              role: a.role,
              model: a.model,
            })),
          })),
          providers: providers
            .filter((p) => p.isValid && (p.apiKey || p.provider === "claude-cli"))
            .map((p) => ({ provider: p.provider, apiKey: p.apiKey || "" })),
        }),
      })

      if (!setupRes.ok) {
        const d = await setupRes.json()
        throw new Error(d.error || "Setup failed")
      }

      // Mark setup done in cookie for middleware
      document.cookie = "ao_setup_done=1; path=/; max-age=315360000"

      // Redirect to dashboard
      window.location.href = "/"
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed")
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-2xl">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-colors",
              i === step ? "bg-primary" : i < step ? "bg-primary/40" : "bg-border"
            )}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="bg-card border border-border rounded-2xl p-5 md:p-8 shadow-sm">
        {step === 0 && <WelcomeStep locale={locale} onLocaleChange={setLocale} />}
        {step === 1 && <AdminStep data={admin} onChange={setAdmin} />}
        {step === 2 && (
          <CompanyStep
            data={companyData}
            onChange={setCompanyData}
            proposal={proposal}
            onProposalReceived={setProposal}
          />
        )}
        {step === 3 && (
          <WorkshopImportStep
            onImport={handleWorkshopImport}
            onSkip={() => setStep(4)}
          />
        )}
        {step === 4 && (
          <ProvidersStep
            providers={providers}
            onTestProvider={handleTestProvider}
            onKeyChange={handleKeyChange}
          />
        )}
        {step === 5 && (
          <DepartmentStep
            department={currentDept}
            templates={Object.entries(DEPARTMENT_TEMPLATES).map(([key, t]) => ({ key, ...t }))}
            onChange={(d) => setCurrentDept({ ...d, agents: currentDept.agents })}
          />
        )}
        {step === 6 && (
          <AgentsStep
            departmentName={currentDept.name}
            agents={currentAgents}
            modelOptions={MODEL_OPTIONS}
            onAdd={(a) => setCurrentAgents((prev) => [...prev, a])}
            onRemove={(i) => setCurrentAgents((prev) => prev.filter((_, idx) => idx !== i))}
            onChange={(i, a) =>
              setCurrentAgents((prev) => prev.map((existing, idx) => (idx === i ? a : existing)))
            }
          />
        )}
        {step === 7 && (
          <ReadyStep
            companyName={companyData.name}
            departments={departments}
            providerCount={providers.filter((p) => p.isValid).length}
            locale={locale}
            onAddDepartment={handleAddDepartment}
          />
        )}

        {error && (
          <p className="text-sm text-destructive mt-4">{error}</p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={handleBack}
          disabled={step === 0}
          className={cn(
            "flex items-center gap-1 px-4 py-2 rounded-lg text-sm transition-colors",
            step === 0
              ? "text-muted-foreground/30 cursor-not-allowed"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
          )}
        >
          <ChevronLeft size={16} />
          Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={handleNext}
            disabled={!canAdvance()}
            className={cn(
              "flex items-center gap-1 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors",
              canAdvance()
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            Continue
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleLaunch}
            disabled={submitting || departments.length === 0}
            className="bg-primary text-primary-foreground px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting ? "Setting up..." : "Launch Dashboard"}
          </button>
        )}
      </div>
    </div>
  )
}
