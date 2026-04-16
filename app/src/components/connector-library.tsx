"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  MessageSquare, Users, GitBranch, Table, FileText, Database,
  Webhook, Send, Mail, Plus, Plug, X, Loader2, Lock, Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  CONNECTOR_REGISTRY,
  CONNECTOR_CATEGORIES,
  type ConnectorDefinition,
  type ConnectorCategory,
} from "@/lib/connectors"

interface ConnectorLibraryProps {
  departments: { id: string; name: string; color: string }[]
  onConnectorCreated?: () => void
}

const ICON_MAP: Record<string, React.ReactNode> = {
  MessageSquare: <MessageSquare size={20} />,
  Users: <Users size={20} />,
  GitBranch: <GitBranch size={20} />,
  Table: <Table size={20} />,
  FileText: <FileText size={20} />,
  Database: <Database size={20} />,
  Webhook: <Webhook size={20} />,
  Send: <Send size={20} />,
  Mail: <Mail size={20} />,
  Globe: <Plug size={20} />,
  FolderOpen: <Plug size={20} />,
}

const CATEGORY_COLORS: Record<ConnectorCategory, string> = {
  api: "bg-blue-50 text-blue-600 border-blue-200",
  file: "bg-amber-50 text-amber-600 border-amber-200",
  database: "bg-emerald-50 text-emerald-600 border-emerald-200",
  webhook: "bg-purple-50 text-purple-600 border-purple-200",
  communication: "bg-pink-50 text-pink-600 border-pink-200",
}

export function ConnectorLibrary({ departments, onConnectorCreated }: ConnectorLibraryProps) {
  const [selectedConnector, setSelectedConnector] = useState<ConnectorDefinition | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [agentName, setAgentName] = useState("")
  const [departmentId, setDepartmentId] = useState("")
  const [creating, setCreating] = useState(false)
  const [filterCategory, setFilterCategory] = useState<ConnectorCategory | "all">("all")
  const [searchQuery, setSearchQuery] = useState("")

  const filtered = CONNECTOR_REGISTRY.filter((c) => {
    if (filterCategory !== "all" && c.category !== filterCategory) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.tags.some((t) => t.includes(q))
    }
    return true
  })

  function openConnector(connector: ConnectorDefinition) {
    setSelectedConnector(connector)
    setAgentName(connector.name + " Connector")
    setFormData({})
    setDepartmentId(departments[0]?.id || "")
  }

  function closeDialog() {
    setSelectedConnector(null)
    setFormData({})
    setAgentName("")
  }

  async function handleCreate() {
    if (!selectedConnector || !departmentId) return

    const missing = selectedConnector.connectionFields
      .filter((f) => f.required && !formData[f.key]?.trim())
      .map((f) => f.label)

    if (missing.length > 0) {
      toast.error(`Missing: ${missing.join(", ")}`)
      return
    }

    setCreating(true)
    try {
      const agentId = `connector-${selectedConnector.id}-${Date.now()}`

      const agentRes = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: agentId,
          departmentId,
          name: agentName || selectedConnector.name,
          role: selectedConnector.description,
          persona: selectedConnector.persona,
          model: selectedConnector.model,
        }),
      })

      if (!agentRes.ok) throw new Error("Failed to create agent")

      await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSystemAgent: true }),
      })

      await fetch(`/api/agents/${agentId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona: selectedConnector.persona,
          connectionConfig: JSON.stringify({
            connectorType: selectedConnector.id,
            ...formData,
          }),
        }),
      })

      toast.success(`${agentName} connector created`)
      closeDialog()
      onConnectorCreated?.()
    } catch {
      toast.error("Failed to create connector")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold">System Connectors</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connect Orchestra to your existing tools, databases, and services
          </p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-xs">{CONNECTOR_REGISTRY.length} available</span>
          <Plug size={16} />
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search connectors..."
            className="w-full pl-8 pr-3 py-2 bg-inset rounded-lg text-sm outline-none"
          />
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setFilterCategory("all")}
            className={cn(
              "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
              filterCategory === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            All
          </button>
          {CONNECTOR_CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setFilterCategory(cat.key)}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                filterCategory === cat.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Connector cards by category */}
      {filterCategory === "all" ? (
        CONNECTOR_CATEGORIES.map((cat) => {
          const catConnectors = filtered.filter((c) => c.category === cat.key)
          if (catConnectors.length === 0) return null
          return (
            <div key={cat.key} className="mb-6">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat.label}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {catConnectors.map((connector) => (
                  <ConnectorCard key={connector.id} connector={connector} onClick={() => openConnector(connector)} />
                ))}
              </div>
            </div>
          )
        })
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((connector) => (
            <ConnectorCard key={connector.id} connector={connector} onClick={() => openConnector(connector)} />
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No connectors match your search.
        </div>
      )}

      {/* Configuration dialog */}
      {selectedConnector && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={closeDialog} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", CATEGORY_COLORS[selectedConnector.category])}>
                    {ICON_MAP[selectedConnector.icon] || <Plug size={18} />}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{selectedConnector.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {selectedConnector.capabilities.map((cap) => (
                        <span key={cap} className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded capitalize">{cap}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <button onClick={closeDialog} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary">
                  <X size={16} />
                </button>
              </div>

              {/* Description */}
              <div className="px-6 py-3 border-b border-border bg-muted/30">
                <p className="text-xs text-muted-foreground leading-relaxed">{selectedConnector.longDescription}</p>
              </div>

              {/* Form */}
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Connector Name</label>
                  <input
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Department</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none appearance-none"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="border-t border-border pt-4">
                  <div className="flex items-center gap-1.5 mb-3">
                    <Lock size={12} className="text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Connection Details</span>
                    <span className="text-[10px] text-muted-foreground/60 ml-auto">Encrypted at rest (AES-256-GCM)</span>
                  </div>

                  <div className="space-y-3">
                    {selectedConnector.connectionFields.map((field) => (
                      <div key={field.key}>
                        <label className="text-xs font-medium text-muted-foreground">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-0.5">*</span>}
                        </label>
                        {field.type === "select" && field.options ? (
                          <select
                            value={formData[field.key] || ""}
                            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                            className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none appearance-none"
                          >
                            <option value="">Select...</option>
                            {field.options.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : field.type === "textarea" ? (
                          <textarea
                            value={formData[field.key] || ""}
                            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                            placeholder={field.placeholder}
                            rows={3}
                            className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none font-mono resize-y"
                          />
                        ) : (
                          <input
                            type={field.type === "password" ? "password" : field.type === "number" ? "number" : "text"}
                            value={formData[field.key] || ""}
                            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                            placeholder={field.placeholder}
                            className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none font-mono"
                          />
                        )}
                        {field.helpText && (
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">{field.helpText}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
                <button
                  onClick={closeDialog}
                  className="px-4 py-2 text-sm rounded-lg hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                    creating && "opacity-60"
                  )}
                >
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {creating ? "Creating..." : "Create Connector"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// =============================================================================
// Connector Card
// =============================================================================

function ConnectorCard({ connector, onClick }: { connector: ConnectorDefinition; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-2.5 mb-2">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", CATEGORY_COLORS[connector.category])}>
          {ICON_MAP[connector.icon] || <Plug size={16} />}
        </div>
        <div className="min-w-0">
          <span className="text-sm font-medium block truncate">{connector.name}</span>
          <div className="flex gap-1 mt-0.5">
            {connector.capabilities.map((cap) => (
              <span key={cap} className="text-[9px] font-medium bg-muted px-1 py-0.5 rounded capitalize">{cap}</span>
            ))}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
        {connector.description}
      </p>
      <div className="flex items-center gap-1.5 mt-3">
        <Plus size={12} className="text-primary" />
        <span className="text-[11px] text-primary font-medium">Add Connector</span>
      </div>
    </button>
  )
}
