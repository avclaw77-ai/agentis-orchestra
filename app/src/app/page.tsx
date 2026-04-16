"use client"

import { useState, useEffect } from "react"
import { Shell, type View } from "@/components/shell"
import { AgentRoster } from "@/components/agent-roster"
import { ChatPanel } from "@/components/chat-panel"
import { TaskBoard } from "@/components/task-board"
import { ModelConfig } from "@/components/model-config"
import type { Agent } from "@/types"

interface Department {
  id: string
  name: string
  color: string
}

interface CompanyInfo {
  name: string
  locale: string
}

export default function DashboardPage() {
  const [view, setView] = useState<View>("dashboard")
  const [selectedAgent, setSelectedAgent] = useState<string>("")
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({ name: "AgentisOrchestra", locale: "en" })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const setupRes = await fetch("/api/setup")
      if (setupRes.ok) {
        const data = await setupRes.json()
        if (data.company) setCompanyInfo(data.company)
      }

      const deptRes = await fetch("/api/departments")
      if (deptRes.ok) {
        const depts = await deptRes.json()
        setDepartments(depts)
      }

      const agentRes = await fetch("/api/agents")
      if (agentRes.ok) {
        const ags = await agentRes.json()
        setAgents(ags)
        const ceo = ags.find((a: Agent) => a.isCeo)
        if (ceo) setSelectedAgent(ceo.id)
        else if (ags.length > 0) setSelectedAgent(ags[0].id)
      }
    } catch {
      // Will work once DB is populated via setup wizard
    }
  }

  const visibleAgents = selectedDepartment
    ? agents.filter((a) => a.departmentId === selectedDepartment)
    : agents

  return (
    <Shell
      currentView={view}
      onViewChange={setView}
      companyName={companyInfo.name}
      departments={departments}
      selectedDepartment={selectedDepartment}
      onDepartmentChange={setSelectedDepartment}
    >
      {view === "dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
          <div className="lg:col-span-1">
            <AgentRoster
              agents={visibleAgents}
              selectedAgent={selectedAgent}
              onSelectAgent={(id) => {
                setSelectedAgent(id)
                setView("chat")
              }}
            />
          </div>
          <div className="lg:col-span-2">
            <ChatPanel
              channel={selectedAgent}
              agentName={agents.find((a) => a.id === selectedAgent)?.name || "Agent"}
            />
          </div>
        </div>
      )}

      {view === "chat" && (
        <div className="flex h-[calc(100vh-64px)]">
          <div className="w-64 border-r border-border p-4 overflow-y-auto">
            <AgentRoster
              agents={visibleAgents}
              selectedAgent={selectedAgent}
              onSelectAgent={setSelectedAgent}
              compact
            />
          </div>
          <div className="flex-1">
            <ChatPanel
              channel={selectedAgent}
              agentName={agents.find((a) => a.id === selectedAgent)?.name || "Agent"}
              fullHeight
            />
          </div>
        </div>
      )}

      {view === "tasks" && (
        <div className="p-6">
          <TaskBoard />
        </div>
      )}

      {view === "models" && (
        <div className="p-6 max-w-5xl">
          <ModelConfig />
        </div>
      )}

      {view === "settings" && (
        <div className="p-6 max-w-2xl">
          <h2 className="text-lg font-semibold mb-4">Settings</h2>
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Company Name</label>
              <input
                type="text"
                defaultValue={companyInfo.name}
                className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Language</label>
              <select
                defaultValue={companyInfo.locale}
                className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none"
              >
                <option value="en">English</option>
                <option value="fr">Francais</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </Shell>
  )
}
