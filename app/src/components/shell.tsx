"use client"

import { useState } from "react"
import {
  Bot,
  LayoutDashboard,
  MessageSquare,
  KanbanSquare,
  Repeat,
  Cpu,
  DollarSign,
  Settings,
  ChevronDown,
  Crown,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type View = "dashboard" | "chat" | "tasks" | "routines" | "models" | "costs" | "settings"

interface Department {
  id: string
  name: string
  color: string
}

interface ShellProps {
  currentView: View
  onViewChange: (view: View) => void
  companyName: string
  departments: Department[]
  selectedDepartment: string | null // null = CEO view (all departments)
  onDepartmentChange: (id: string | null) => void
  children: React.ReactNode
}

const NAV_ITEMS: { key: View; label: string; icon: React.ReactNode }[] = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { key: "chat", label: "Chat", icon: <MessageSquare size={18} /> },
  { key: "tasks", label: "Tasks", icon: <KanbanSquare size={18} /> },
  { key: "routines", label: "Routines", icon: <Repeat size={18} /> },
  { key: "models", label: "Models", icon: <Cpu size={18} /> },
  { key: "costs", label: "Costs", icon: <DollarSign size={18} /> },
]

export function Shell({
  currentView,
  onViewChange,
  companyName,
  departments,
  selectedDepartment,
  onDepartmentChange,
  children,
}: ShellProps) {
  const [deptOpen, setDeptOpen] = useState(false)

  const currentDept = selectedDepartment
    ? departments.find((d) => d.id === selectedDepartment)
    : null

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar */}
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Bot size={18} className="text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight">{companyName}</h1>
            <p className="text-xs text-muted-foreground">AgentisOrchestra</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => onViewChange(item.key)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                currentView === item.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              {item.icon}
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Right: Department selector + Settings */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setDeptOpen(!deptOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-secondary transition-colors"
            >
              {selectedDepartment === null ? (
                <>
                  <Crown size={14} className="text-primary" />
                  <span className="font-medium">CEO View</span>
                </>
              ) : (
                <>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: currentDept?.color || "#3b82f6" }}
                  />
                  <span className="font-medium">{currentDept?.name}</span>
                </>
              )}
              <ChevronDown size={14} className="text-muted-foreground" />
            </button>

            {deptOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDeptOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-xl shadow-lg z-50 py-1">
                  <button
                    onClick={() => { onDepartmentChange(null); setDeptOpen(false) }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-secondary transition-colors",
                      selectedDepartment === null && "bg-secondary"
                    )}
                  >
                    <Crown size={14} className="text-primary" />
                    CEO View
                    <span className="text-xs text-muted-foreground ml-auto">All depts</span>
                  </button>
                  <div className="border-t border-border my-1" />
                  {departments.map((dept) => (
                    <button
                      key={dept.id}
                      onClick={() => { onDepartmentChange(dept.id); setDeptOpen(false) }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-secondary transition-colors",
                        selectedDepartment === dept.id && "bg-secondary"
                      )}
                    >
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: dept.color }}
                      />
                      {dept.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => onViewChange("settings")}
            className={cn(
              "p-2 rounded-lg transition-colors",
              currentView === "settings"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
