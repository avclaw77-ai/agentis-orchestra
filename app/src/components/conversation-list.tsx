"use client"

import { useState, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Plus, Trash2, MessageSquare, Pencil, Check, X } from "lucide-react"
import type { Conversation } from "@/types"

interface ConversationListProps {
  agentId: string
  activeConversationId: string | null
  onSelect: (conversationId: string | null) => void
  onNew: () => void
}

export function ConversationList({
  agentId,
  activeConversationId,
  onSelect,
  onNew,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")

  const fetchConversations = useCallback(async () => {
    if (!agentId) return
    try {
      const res = await fetch(`/api/conversations?agentId=${encodeURIComponent(agentId)}`)
      if (res.ok) {
        setConversations(await res.json())
      }
    } catch {
      // will load once API is ready
    }
  }, [agentId])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  async function handleRename(id: string) {
    if (!editTitle.trim()) return
    await fetch("/api/conversations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title: editTitle.trim() }),
    })
    setEditingId(null)
    fetchConversations()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/conversations?id=${id}`, { method: "DELETE" })
    if (activeConversationId === id) onSelect(null)
    fetchConversations()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Conversations
        </span>
        <button
          onClick={onNew}
          className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          title="New conversation"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-0.5 px-1">
        {conversations.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No conversations yet
          </div>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={cn(
              "group flex items-center gap-1.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors",
              activeConversationId === conv.id
                ? "bg-primary/10 text-foreground"
                : "hover:bg-secondary text-foreground/80"
            )}
            onClick={() => onSelect(conv.id)}
          >
            <MessageSquare size={13} className="shrink-0 text-muted-foreground" />
            {editingId === conv.id ? (
              <div className="flex-1 flex items-center gap-1 min-w-0">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(conv.id)
                    if (e.key === "Escape") setEditingId(null)
                  }}
                  className="flex-1 text-xs bg-inset rounded px-1.5 py-0.5 outline-none min-w-0"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
                <button onClick={(e) => { e.stopPropagation(); handleRename(conv.id) }} className="text-emerald-500">
                  <Check size={12} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setEditingId(null) }} className="text-muted-foreground">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <>
                <span className="flex-1 text-xs truncate">{conv.title}</span>
                <span className="text-[10px] text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100">
                  {conv.messageCount || 0}
                </span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingId(conv.id)
                      setEditTitle(conv.title)
                    }}
                    className="p-0.5 rounded hover:bg-secondary text-muted-foreground"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(conv.id)
                    }}
                    className="p-0.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
