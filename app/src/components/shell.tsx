"use client"

import { useState, useEffect } from "react"
import {
  LayoutDashboard,
  MessageSquare,
  KanbanSquare,
  Target,
  Repeat,
  Cpu,
  DollarSign,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  Menu,
  X,
  User,
  ShieldCheck,
  FolderOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type View = "dashboard" | "chat" | "tasks" | "files" | "goals" | "routines" | "approvals" | "models" | "costs" | "settings"

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
  selectedDepartment: string | null
  onDepartmentChange: (id: string | null) => void
  children: React.ReactNode
  userRole?: "admin" | "member" | "viewer"
  userDepartmentIds?: string[]
  userName?: string
}

interface NavGroup {
  label: string
  items: { key: View; label: string; icon: React.ReactNode }[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Core",
    items: [
      { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
      { key: "chat", label: "Chat", icon: <MessageSquare size={18} /> },
      { key: "tasks", label: "Tasks", icon: <KanbanSquare size={18} /> },
      { key: "files", label: "Files", icon: <FolderOpen size={18} /> },
    ],
  },
  {
    label: "Operate",
    items: [
      { key: "goals", label: "Goals", icon: <Target size={18} /> },
      { key: "routines", label: "Routines", icon: <Repeat size={18} /> },
      { key: "approvals", label: "Approvals", icon: <ShieldCheck size={18} /> },
      { key: "costs", label: "Costs", icon: <DollarSign size={18} /> },
    ],
  },
  {
    label: "System",
    items: [
      { key: "models", label: "Models", icon: <Cpu size={18} /> },
      { key: "settings", label: "Settings", icon: <Settings size={18} /> },
    ],
  },
]

const STORAGE_KEY = "ao-sidebar-collapsed"

export function Shell({
  currentView,
  onViewChange,
  companyName,
  departments,
  selectedDepartment,
  onDepartmentChange,
  children,
  userRole = "admin",
  userDepartmentIds = [],
  userName,
}: ShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [deptOpen, setDeptOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Filter departments based on user role
  const isAdmin = userRole === "admin"
  const visibleDepartments = isAdmin
    ? departments
    : departments.filter((d) => userDepartmentIds.includes(d.id))
  const showCeoView = isAdmin || visibleDepartments.length > 1

  // Restore collapsed state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === "true") setCollapsed(true)
    } catch {
      // localStorage unavailable
    }
  }, [])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      // localStorage unavailable
    }
  }

  const currentDept = selectedDepartment
    ? departments.find((d) => d.id === selectedDepartment)
    : null

  // Close mobile drawer on view change
  function handleViewChange(view: View) {
    onViewChange(view)
    setMobileOpen(false)
  }

  function handleDeptChange(id: string | null) {
    onDepartmentChange(id)
    setDeptOpen(false)
  }

  // -----------------------------------------------------------------------
  // Sidebar content (shared between desktop sidebar and mobile drawer)
  // -----------------------------------------------------------------------
  function renderSidebarContent(isMobile: boolean) {
    const isCollapsed = isMobile ? false : collapsed

    return (
      <div className="flex flex-col h-full">
        {/* Department accent bar */}
        {selectedDepartment && currentDept && (
          <div
            className="h-1 w-full shrink-0"
            style={{ backgroundColor: currentDept.color }}
          />
        )}

        {/* Logo + collapse toggle */}
        <div className={cn(
          "flex items-center shrink-0 h-14 border-b border-border px-3",
          isCollapsed ? "justify-center" : "justify-between"
        )}>
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <img src="/logo-mark.svg" alt="Orchestra" className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-semibold leading-tight truncate">{companyName}</h1>
                <p className="text-[11px] text-muted-foreground leading-tight">Orchestra</p>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <img src="/logo-mark.svg" alt="Orchestra" className="w-5 h-5" />
            </div>
          )}
          {!isMobile && (
            <button
              onClick={toggleCollapsed}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          )}
        </div>

        {/* Department selector */}
        <div className={cn("shrink-0 border-b border-border", isCollapsed ? "px-1.5 py-2" : "px-3 py-2")}>
          <div className="relative">
            <button
              onClick={() => setDeptOpen(!deptOpen)}
              className={cn(
                "flex items-center gap-2 rounded-lg text-sm transition-colors hover:bg-secondary w-full",
                isCollapsed ? "justify-center p-2" : "px-2.5 py-2"
              )}
              title={isCollapsed ? (selectedDepartment === null ? "CEO View" : currentDept?.name) : undefined}
            >
              {selectedDepartment === null ? (
                <>
                  <Crown size={14} className="text-primary shrink-0" />
                  {!isCollapsed && <span className="font-medium truncate">CEO View</span>}
                </>
              ) : (
                <>
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: currentDept?.color || "#3b82f6" }}
                  />
                  {!isCollapsed && <span className="font-medium truncate">{currentDept?.name}</span>}
                </>
              )}
              {!isCollapsed && <ChevronDown size={14} className="text-muted-foreground ml-auto shrink-0" />}
            </button>

            {deptOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDeptOpen(false)} />
                <div className={cn(
                  "absolute top-full mt-1 w-56 bg-card border border-border rounded-xl shadow-lg z-50 py-1",
                  isCollapsed ? "left-full ml-1 -top-2" : "left-0"
                )}>
                  {showCeoView && (
                    <>
                      <button
                        onClick={() => handleDeptChange(null)}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-secondary transition-colors",
                          selectedDepartment === null && "bg-secondary"
                        )}
                      >
                        <Crown size={14} className="text-primary" />
                        {isAdmin ? "CEO View" : "All My Depts"}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {isAdmin ? "All depts" : `${visibleDepartments.length} depts`}
                        </span>
                      </button>
                      <div className="border-t border-border my-1" />
                    </>
                  )}
                  {visibleDepartments.map((dept) => (
                    <button
                      key={dept.id}
                      onClick={() => handleDeptChange(dept.id)}
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
        </div>

        {/* Navigation groups */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label} className={cn(gi > 0 && "mt-4")}>
              {!isCollapsed && (
                <p className="px-2.5 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
              )}
              {isCollapsed && gi > 0 && (
                <div className="border-t border-border mx-1 mb-2" />
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = currentView === item.key
                  return (
                    <button
                      key={item.key}
                      onClick={() => handleViewChange(item.key)}
                      className={cn(
                        "flex items-center gap-2.5 w-full rounded-lg text-sm transition-colors relative",
                        isCollapsed ? "justify-center p-2" : "px-2.5 py-2",
                        isActive
                          ? "bg-secondary text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      )}
                      title={isCollapsed ? item.label : undefined}
                    >
                      {/* Active indicator -- left border */}
                      {isActive && (
                        <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary" />
                      )}
                      <span className="shrink-0">{item.icon}</span>
                      {!isCollapsed && <span>{item.label}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom: user section */}
        <div className={cn(
          "shrink-0 border-t border-border",
          isCollapsed ? "px-1.5 py-2" : "px-3 py-3"
        )}>
          <div className={cn(
            "flex items-center gap-2.5 rounded-lg",
            isCollapsed ? "justify-center p-2" : "px-2.5 py-2"
          )}>
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <User size={14} className="text-muted-foreground" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{userName || "Admin"}</p>
                <p className="text-[11px] text-muted-foreground leading-tight capitalize">{userRole}</p>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <a
              href="https://agentislab.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-[10px] text-muted-foreground/50 hover:text-muted-foreground/70 transition-colors mt-1"
            >
              Powered by AgentisLab
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 bg-card border-r border-border h-screen transition-[width] duration-200 ease-in-out overflow-hidden",
          collapsed ? "w-14" : "w-60"
        )}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-12 bg-card border-b border-border flex items-center px-3 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center shrink-0">
            <img src="/logo-mark.svg" alt="Orchestra" className="w-4 h-4" />
          </div>
          <span className="text-sm font-semibold truncate">{companyName}</span>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border shadow-xl">
            {/* Close button */}
            <div className="absolute top-3 right-3 z-10">
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            {renderSidebarContent(true)}
          </aside>
        </>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-hidden overflow-y-auto md:pt-0 pt-12">
        {children}
      </main>
    </div>
  )
}
