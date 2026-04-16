"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Users, Plus, Trash2, Shield, Eye, UserCheck, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface TeamUser {
  id: string
  email: string
  name: string
  role: "admin" | "member" | "viewer"
  departmentIds: string[]
}

interface Department {
  id: string
  name: string
  color: string
}

interface TeamManagerProps {
  departments: Department[]
}

const ROLE_CONFIG = {
  admin: { label: "Admin", icon: Shield, color: "text-primary", bg: "bg-primary/10", desc: "Full access to all departments" },
  member: { label: "Member", icon: UserCheck, color: "text-green-600", bg: "bg-green-50", desc: "Full access to assigned departments" },
  viewer: { label: "Viewer", icon: Eye, color: "text-muted-foreground", bg: "bg-muted", desc: "Read-only access to assigned departments" },
}

export function TeamManager({ departments }: TeamManagerProps) {
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([])
  const [showInvite, setShowInvite] = useState(false)
  const [editingUser, setEditingUser] = useState<string | null>(null)

  // Invite form
  const [invEmail, setInvEmail] = useState("")
  const [invName, setInvName] = useState("")
  const [invPassword, setInvPassword] = useState("")
  const [invRole, setInvRole] = useState<"member" | "viewer">("member")
  const [invDepts, setInvDepts] = useState<string[]>([])
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      const res = await fetch("/api/users")
      if (res.ok) setTeamUsers(await res.json())
    } catch { /* */ }
  }

  async function handleInvite() {
    if (!invEmail || !invName || !invPassword) return
    setInviting(true)
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: invEmail,
          name: invName,
          password: invPassword,
          role: invRole,
          departmentIds: invDepts,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(`${invName} invited as ${invRole}`)
      setShowInvite(false)
      setInvEmail("")
      setInvName("")
      setInvPassword("")
      setInvRole("member")
      setInvDepts([])
      await fetchUsers()
    } catch {
      toast.error("Failed to create user")
    } finally {
      setInviting(false)
    }
  }

  async function handleUpdateRole(userId: string, role: string) {
    try {
      await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
      toast.success("Role updated")
      await fetchUsers()
    } catch {
      toast.error("Failed to update role")
    }
  }

  async function handleUpdateDepts(userId: string, departmentIds: string[]) {
    try {
      await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentIds }),
      })
      toast.success("Departments updated")
      await fetchUsers()
    } catch {
      toast.error("Failed to update departments")
    }
  }

  async function handleDelete(userId: string, name: string) {
    if (!confirm(`Remove ${name} from the team?`)) return
    try {
      await fetch(`/api/users/${userId}`, { method: "DELETE" })
      toast.success(`${name} removed`)
      await fetchUsers()
    } catch {
      toast.error("Failed to remove user")
    }
  }

  function toggleDept(deptId: string, current: string[]) {
    return current.includes(deptId)
      ? current.filter((d) => d !== deptId)
      : [...current, deptId]
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold">Team Members</h3>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            {teamUsers.length}
          </span>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} />
          Invite User
        </button>
      </div>

      {/* User list */}
      <div className="space-y-2">
        {teamUsers.map((u) => {
          const rc = ROLE_CONFIG[u.role]
          const isEditing = editingUser === u.id
          return (
            <div key={u.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", rc.bg)}>
                    <rc.icon size={16} className={rc.color} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", rc.bg, rc.color)}>
                    {rc.label}
                  </span>
                  <button
                    onClick={() => setEditingUser(isEditing ? null : u.id)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isEditing ? "Done" : "Edit"}
                  </button>
                  {u.role !== "admin" && (
                    <button
                      onClick={() => handleDelete(u.id, u.name)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Department badges */}
              <div className="flex flex-wrap gap-1 mt-2">
                {u.role === "admin" ? (
                  <span className="text-[10px] text-muted-foreground">All departments</span>
                ) : u.departmentIds.length === 0 ? (
                  <span className="text-[10px] text-muted-foreground">No departments assigned</span>
                ) : (
                  u.departmentIds.map((deptId) => {
                    const dept = departments.find((d) => d.id === deptId)
                    return dept ? (
                      <span
                        key={deptId}
                        className="flex items-center gap-1 text-[10px] bg-secondary px-2 py-0.5 rounded-full"
                      >
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dept.color }} />
                        {dept.name}
                      </span>
                    ) : null
                  })
                )}
              </div>

              {/* Edit panel */}
              {isEditing && u.role !== "admin" && (
                <div className="mt-3 pt-3 border-t border-border space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Role</label>
                    <div className="flex gap-2 mt-1">
                      {(["member", "viewer"] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => handleUpdateRole(u.id, r)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                            u.role === r ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
                          )}
                        >
                          {ROLE_CONFIG[r].label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Departments</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {departments.map((dept) => {
                        const assigned = u.departmentIds.includes(dept.id)
                        return (
                          <button
                            key={dept.id}
                            onClick={() => handleUpdateDepts(u.id, toggleDept(dept.id, u.departmentIds))}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                              assigned ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
                            )}
                          >
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dept.color }} />
                            {dept.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Invite dialog */}
      {showInvite && (
        <>
          <div className="fixed inset-0 bg-black/20 z-50" onClick={() => setShowInvite(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Invite Team Member</h3>
                <button onClick={() => setShowInvite(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium">Name</label>
                  <input
                    type="text"
                    value={invName}
                    onChange={(e) => setInvName(e.target.value)}
                    className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none"
                    placeholder="Lucy Martin"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Email</label>
                  <input
                    type="email"
                    value={invEmail}
                    onChange={(e) => setInvEmail(e.target.value)}
                    className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none"
                    placeholder="lucy@company.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Temporary Password</label>
                  <input
                    type="text"
                    value={invPassword}
                    onChange={(e) => setInvPassword(e.target.value)}
                    className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm font-mono outline-none"
                    placeholder="Share this with them"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium">Role</label>
                  <div className="flex gap-2 mt-1">
                    {(["member", "viewer"] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setInvRole(r)}
                        className={cn(
                          "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-center",
                          invRole === r ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
                        )}
                      >
                        {ROLE_CONFIG[r].label}
                        <p className="font-normal text-[10px] mt-0.5 opacity-70">{ROLE_CONFIG[r].desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium">Department Access</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {departments.map((dept) => {
                      const selected = invDepts.includes(dept.id)
                      return (
                        <button
                          key={dept.id}
                          onClick={() => setInvDepts(toggleDept(dept.id, invDepts))}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                            selected ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"
                          )}
                        >
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dept.color }} />
                          {dept.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowInvite(false)}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInvite}
                  disabled={!invEmail || !invName || !invPassword || inviting}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {inviting ? "Creating..." : "Create User"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
