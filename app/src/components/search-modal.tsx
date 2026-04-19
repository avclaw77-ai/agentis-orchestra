"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { cn } from "@/lib/utils"
import {
  Search,
  X,
  Bot,
  CheckSquare,
  Target,
  Repeat,
  FolderOpen,
  ShieldCheck,
  MessageSquare,
  LayoutDashboard,
  BarChart3,
  Cpu,
  Settings,
  Command,
} from "lucide-react"
import type { View } from "@/components/shell"
import type { Agent, Task, Department, Goal, Routine } from "@/types"

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

type ResultCategory = "navigation" | "agent" | "task" | "goal" | "routine"

interface SearchResult {
  id: string
  category: ResultCategory
  title: string
  subtitle?: string
  icon: React.ReactNode
  action: () => void
}

// ---------------------------------------------------------------------------
// Navigation items for quick access
// ---------------------------------------------------------------------------
const NAV_ITEMS: {
  view: View
  label: string
  icon: React.ReactNode
  keywords: string[]
}[] = [
  { view: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} />, keywords: ["home", "overview"] },
  { view: "chat", label: "Chat", icon: <MessageSquare size={16} />, keywords: ["message", "talk", "conversation"] },
  { view: "tasks", label: "Tasks", icon: <CheckSquare size={16} />, keywords: ["kanban", "board", "todo"] },
  { view: "files", label: "Files", icon: <FolderOpen size={16} />, keywords: ["documents", "upload", "browse"] },
  { view: "goals", label: "Goals", icon: <Target size={16} />, keywords: ["objectives", "okr"] },
  { view: "routines", label: "Routines", icon: <Repeat size={16} />, keywords: ["schedule", "automation", "cron"] },
  { view: "approvals", label: "Approvals", icon: <ShieldCheck size={16} />, keywords: ["review", "approve", "reject"] },
  { view: "costs", label: "Costs", icon: <BarChart3 size={16} />, keywords: ["tokens", "usage", "spending"] },
  { view: "models", label: "Models", icon: <Cpu size={16} />, keywords: ["sandbox", "api", "keys", "providers"] },
  { view: "settings", label: "Settings", icon: <Settings size={16} />, keywords: ["config", "company", "team", "export"] },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SearchModalProps {
  open: boolean
  onClose: () => void
  onNavigate: (view: View) => void
  onSelectAgent: (agentId: string) => void
  onSelectTask: (taskId: string) => void
  agents: Agent[]
  tasks: Task[]
  departments: Department[]
  goals: Goal[]
  routines: Routine[]
}

export function SearchModal({
  open,
  onClose,
  onNavigate,
  onSelectAgent,
  onSelectTask,
  agents,
  tasks,
  departments,
  goals,
  routines,
}: SearchModalProps) {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [serverResults, setServerResults] = useState<{
    tasks: Array<{ id: string; title: string; status: string; priority: string }>
    goals: Array<{ id: string; title: string; status: string }>
    routines: Array<{ id: string; name: string; status: string }>
  }>({ tasks: [], goals: [], routines: [] })
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery("")
      setSelectedIndex(0)
      setServerResults({ tasks: [], goals: [], routines: [] })
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Debounced server-side search for tasks, goals, routines
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (q.length < 2) {
      setServerResults({ tasks: [], goals: [], routines: [] })
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=10`)
        if (res.ok) {
          const data = await res.json()
          setServerResults({
            tasks: data.results?.tasks || [],
            goals: data.results?.goals || [],
            routines: data.results?.routines || [],
          })
        }
      } catch { /* silent */ }
    }, 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  // Build results: nav + agents client-side (instant), tasks/goals/routines from server
  const results = useMemo<SearchResult[]>(() => {
    const q = query.toLowerCase().trim()
    const out: SearchResult[] = []

    // Navigation (always client-side, instant)
    for (const nav of NAV_ITEMS) {
      const match =
        !q ||
        nav.label.toLowerCase().includes(q) ||
        nav.keywords.some((k) => k.includes(q))
      if (match) {
        out.push({
          id: `nav-${nav.view}`,
          category: "navigation",
          title: nav.label,
          subtitle: "Navigate",
          icon: nav.icon,
          action: () => {
            onNavigate(nav.view)
            onClose()
          },
        })
      }
    }

    // Agents (client-side, instant)
    for (const agent of agents) {
      const name = agent.displayName || agent.name
      if (!q || name.toLowerCase().includes(q) || agent.role?.toLowerCase().includes(q)) {
        out.push({
          id: `agent-${agent.id}`,
          category: "agent",
          title: name,
          subtitle: agent.role || "Agent",
          icon: <Bot size={16} />,
          action: () => {
            onSelectAgent(agent.id)
            onClose()
          },
        })
      }
    }

    // Tasks (server-side full-text search)
    for (const task of serverResults.tasks) {
      out.push({
        id: `task-${task.id}`,
        category: "task",
        title: task.title,
        subtitle: `${task.status} - ${task.priority}`,
        icon: <CheckSquare size={16} />,
        action: () => {
          onNavigate("tasks")
          onSelectTask(task.id)
          onClose()
        },
      })
    }

    // Goals (server-side)
    for (const goal of serverResults.goals) {
      out.push({
        id: `goal-${goal.id}`,
        category: "goal",
        title: goal.title,
        subtitle: goal.status || "Goal",
        icon: <Target size={16} />,
        action: () => {
          onNavigate("goals")
          onClose()
        },
      })
    }

    // Routines (server-side)
    for (const routine of serverResults.routines) {
      out.push({
        id: `routine-${routine.id}`,
        category: "routine",
        title: routine.name,
        subtitle: routine.status || "Routine",
        icon: <Repeat size={16} />,
        action: () => {
          onNavigate("routines")
          onClose()
        },
      })
    }

    return out.slice(0, 25)
  }, [query, agents, serverResults, onNavigate, onSelectAgent, onSelectTask, onClose])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results.length])

  // Keyboard nav
  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault()
        results[selectedIndex].action()
      } else if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, results, selectedIndex, onClose])

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.children[selectedIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: "nearest" })
  }, [selectedIndex])

  // Group results by category and build flat index map
  const grouped = useMemo(() => {
    const map = new Map<ResultCategory, SearchResult[]>()
    for (const r of results) {
      const arr = map.get(r.category) || []
      arr.push(r)
      map.set(r.category, arr)
    }
    return map
  }, [results])

  // Pre-compute a stable id -> flat index map
  const idToIndex = useMemo(() => {
    const map = new Map<string, number>()
    let idx = 0
    for (const [, items] of grouped) {
      for (const item of items) {
        map.set(item.id, idx++)
      }
    }
    return map
  }, [grouped])

  if (!open) return null

  const CATEGORY_LABELS: Record<ResultCategory, string> = {
    navigation: "Navigation",
    agent: "Agents",
    task: "Tasks",
    goal: "Goals",
    routine: "Routines",
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={18} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents, tasks, pages..."
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border font-mono">esc</kbd>
          </div>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No results found
            </div>
          ) : (
            Array.from(grouped.entries()).map(([category, items]) => (
              <div key={category}>
                <div className="px-4 py-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {CATEGORY_LABELS[category]}
                  </span>
                </div>
                {items.map((item) => {
                  const idx = idToIndex.get(item.id) ?? 0
                  return (
                    <button
                      key={item.id}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors",
                        idx === selectedIndex
                          ? "bg-primary/10 text-foreground"
                          : "text-foreground/80 hover:bg-secondary"
                      )}
                    >
                      <span className="shrink-0 text-muted-foreground">
                        {item.icon}
                      </span>
                      <span className="flex-1 truncate">{item.title}</span>
                      {item.subtitle && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {item.subtitle}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-secondary border border-border font-mono">↑</kbd>
            <kbd className="px-1 py-0.5 rounded bg-secondary border border-border font-mono">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-secondary border border-border font-mono">↵</kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <Command size={10} />
            <kbd className="px-1 py-0.5 rounded bg-secondary border border-border font-mono">K</kbd>
            toggle
          </span>
        </div>
      </div>
    </div>
  )
}
