"use client"

import { useState, useRef, useEffect } from "react"
import { Crown, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { AGENT_COLORS, STATUS_COLORS } from "@/lib/constants"
import type { Agent, AgentStatus, Department } from "@/types"

// =============================================================================
// Types
// =============================================================================

interface OrgChartProps {
  agents: Agent[]
  departments: Department[]
  onSelectAgent?: (id: string) => void
}

interface NodePosition {
  x: number
  y: number
  width: number
  height: number
}

// =============================================================================
// Agent Node
// =============================================================================

function AgentNode({
  agent,
  onClick,
}: {
  agent: Agent
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-card border border-border hover:border-primary/30 hover:shadow-sm transition-all text-left min-w-[140px]"
    >
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0"
        style={{ backgroundColor: AGENT_COLORS[agent.id] || "#6366f1" }}
      >
        {agent.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium truncate">{agent.name}</span>
          <div
            className={cn(
              "w-2 h-2 rounded-full shrink-0",
              agent.status === "active" && "agent-pulse",
              agent.status === "thinking" && "thinking-pulse"
            )}
            style={{ backgroundColor: STATUS_COLORS[agent.status] }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground truncate">{agent.role}</p>
      </div>
    </button>
  )
}

// =============================================================================
// CEO Node (larger, highlighted)
// =============================================================================

function CeoNode({
  agent,
  onClick,
}: {
  agent: Agent
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border-2 border-primary/20 hover:border-primary/40 hover:shadow-md transition-all text-left min-w-[160px]"
    >
      <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
        <Crown size={16} className="text-primary-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold truncate">{agent.name}</span>
          <div
            className={cn(
              "w-2.5 h-2.5 rounded-full shrink-0",
              agent.status === "active" && "agent-pulse",
              agent.status === "thinking" && "thinking-pulse"
            )}
            style={{ backgroundColor: STATUS_COLORS[agent.status] }}
          />
        </div>
        <p className="text-xs text-muted-foreground truncate">{agent.role}</p>
      </div>
    </button>
  )
}

// =============================================================================
// Department Group
// =============================================================================

function DepartmentGroup({
  department,
  agents,
  onSelectAgent,
}: {
  department: Department
  agents: Agent[]
  onSelectAgent?: (id: string) => void
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Department header */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/70">
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: department.color }}
        />
        <span className="text-xs font-semibold text-foreground">{department.name}</span>
      </div>

      {/* Agent nodes */}
      <div className="flex flex-col items-center gap-1.5">
        {agents.map((agent) => (
          <AgentNode
            key={agent.id}
            agent={agent}
            onClick={() => onSelectAgent?.(agent.id)}
          />
        ))}
        {agents.length === 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-muted-foreground">
            <User size={14} />
            <span className="text-xs">No agents</span>
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// SVG Connector Lines
// =============================================================================

function ConnectorLines({
  containerRef,
  ceoRef,
  deptRefs,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
  ceoRef: React.RefObject<HTMLDivElement | null>
  deptRefs: React.RefObject<Map<string, HTMLDivElement>>
}) {
  const [lines, setLines] = useState<Array<{ x1: number; y1: number; x2: number; y2: number }>>([])
  const [dims, setDims] = useState({ w: 0, h: 0 })

  useEffect(() => {
    function update() {
      const container = containerRef.current
      const ceo = ceoRef.current
      const map = deptRefs.current
      if (!container || !ceo || !map) return

      const cRect = container.getBoundingClientRect()
      const ceoRect = ceo.getBoundingClientRect()

      const ceoBottom = {
        x: ceoRect.left + ceoRect.width / 2 - cRect.left,
        y: ceoRect.bottom - cRect.top,
      }

      const newLines: typeof lines = []
      map.forEach((el) => {
        const r = el.getBoundingClientRect()
        const deptTop = {
          x: r.left + r.width / 2 - cRect.left,
          y: r.top - cRect.top,
        }
        newLines.push({ x1: ceoBottom.x, y1: ceoBottom.y, x2: deptTop.x, y2: deptTop.y })
      })

      setLines(newLines)
      setDims({ w: cRect.width, h: cRect.height })
    }

    update()
    const obs = new ResizeObserver(update)
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [containerRef, ceoRef, deptRefs])

  if (lines.length === 0) return null

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={dims.w}
      height={dims.h}
      style={{ overflow: "visible" }}
    >
      {lines.map((line, i) => {
        const midY = (line.y1 + line.y2) / 2
        return (
          <path
            key={i}
            d={`M ${line.x1} ${line.y1} C ${line.x1} ${midY}, ${line.x2} ${midY}, ${line.x2} ${line.y2}`}
            fill="none"
            stroke="var(--border)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        )
      })}
    </svg>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export function OrgChart({ agents, departments, onSelectAgent }: OrgChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const ceoRef = useRef<HTMLDivElement>(null)
  const deptRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const ceoAgent = agents.find((a) => a.isCeo)

  // Group agents by department
  const agentsByDept = new Map<string, Agent[]>()
  for (const dept of departments) {
    agentsByDept.set(
      dept.id,
      agents.filter((a) => a.departmentId === dept.id)
    )
  }

  // Orphan agents (no department, not CEO)
  const orphans = agents.filter((a) => !a.departmentId && !a.isCeo)

  return (
    <div ref={containerRef} className="relative w-full">
      <ConnectorLines
        containerRef={containerRef}
        ceoRef={ceoRef}
        deptRefs={deptRefs}
      />

      {/* CEO node */}
      {ceoAgent && (
        <div className="flex justify-center mb-8" ref={ceoRef}>
          <CeoNode
            agent={ceoAgent}
            onClick={() => onSelectAgent?.(ceoAgent.id)}
          />
        </div>
      )}

      {/* Departments row */}
      <div className="flex flex-wrap justify-center gap-6 md:gap-10">
        {departments.map((dept) => (
          <div
            key={dept.id}
            ref={(el) => {
              if (el) deptRefs.current.set(dept.id, el)
              else deptRefs.current.delete(dept.id)
            }}
          >
            <DepartmentGroup
              department={dept}
              agents={agentsByDept.get(dept.id) || []}
              onSelectAgent={onSelectAgent}
            />
          </div>
        ))}
      </div>

      {/* Orphan agents (if any) */}
      {orphans.length > 0 && (
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <p className="text-xs text-muted-foreground w-full text-center mb-2">Unassigned Agents</p>
          {orphans.map((agent) => (
            <AgentNode
              key={agent.id}
              agent={agent}
              onClick={() => onSelectAgent?.(agent.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
