"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { X, Lock, Play, CheckCircle2, Send, Plus, Link, Paperclip, Upload } from "lucide-react"
import type { Task, TaskComment, TaskAttachment, Agent, TaskStatus } from "@/types"

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "in-progress", label: "In Progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
]

const PHASE_LABELS: Record<string, string> = {
  research: "Research",
  spec: "Spec",
  design: "Design",
  build: "Build",
  qa: "QA",
  deploy: "Deploy",
}

interface TaskDetailProps {
  task: Task
  comments: TaskComment[]
  agents: Agent[]
  onClose: () => void
  onStatusChange: (status: TaskStatus) => void
  onAddComment: (body: string) => void
  onNotesChange?: (notes: string) => void
  onDependenciesChange?: (dependencies: string[]) => void
}

export function TaskDetail({
  task,
  comments,
  agents,
  onClose,
  onStatusChange,
  onAddComment,
  onNotesChange,
  onDependenciesChange,
}: TaskDetailProps) {
  const [commentText, setCommentText] = useState("")
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState(task.notes || "")
  const [depInput, setDepInput] = useState("")
  const [attachments, setAttachments] = useState<TaskAttachment[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const agent = agents.find((a) => a.id === task.assignedTo)

  // Fetch attachments on mount
  useEffect(() => {
    async function loadAttachments() {
      try {
        const res = await fetch(`/api/tasks/${task.id}/attachments`)
        if (res.ok) {
          setAttachments(await res.json())
        }
      } catch {
        // Attachments will load once available
      }
    }
    loadAttachments()
  }, [task.id])

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1]
        const res = await fetch(`/api/tasks/${task.id}/attachments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            content: base64,
            mimeType: file.type,
            size: file.size,
          }),
        })
        if (res.ok) {
          const attachment = await res.json()
          setAttachments((prev) => [...prev, attachment])
        }
        setUploadingFile(false)
      }
      reader.readAsDataURL(file)
    } catch {
      setUploadingFile(false)
    }
    // Reset input so same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function handleSendComment() {
    if (!commentText.trim()) return
    onAddComment(commentText.trim())
    setCommentText("")
  }

  function handleAddDep() {
    const id = depInput.trim().toUpperCase()
    if (!id) return
    const current = task.dependencies || []
    if (current.includes(id)) { setDepInput(""); return }
    const updated = [...current, id]
    onDependenciesChange?.(updated)
    setDepInput("")
  }

  function handleRemoveDep(depId: string) {
    const current = task.dependencies || []
    const updated = current.filter((d) => d !== depId)
    onDependenciesChange?.(updated)
  }

  function handleSaveNotes() {
    setEditingNotes(false)
    onNotesChange?.(notesValue)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-[480px] bg-card border-l border-border z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-mono">{task.id}</p>
            <h2 className="text-base font-semibold leading-tight mt-0.5 truncate">
              {task.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors shrink-0 ml-3"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Status selector */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Status
              </label>
              <select
                value={task.status}
                onChange={(e) => onStatusChange(e.target.value as TaskStatus)}
                className="mt-1 w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Checkout badge */}
            {task.executionLockedAt && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                <Lock size={14} />
                <span>Checked out</span>
                {task.checkoutRunId && (
                  <span className="text-xs font-mono text-amber-600 ml-auto truncate max-w-[180px]">
                    {task.checkoutRunId}
                  </span>
                )}
              </div>
            )}

            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Assigned to</p>
                <p className="font-medium mt-0.5">
                  {agent?.name || task.assignedTo || "Unassigned"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Priority</p>
                <p className="font-medium mt-0.5 capitalize">{task.priority}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phase</p>
                <p className="font-medium mt-0.5">
                  {task.phase ? (PHASE_LABELS[task.phase] || task.phase) : "--"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Department</p>
                <p className="font-medium mt-0.5">
                  {task.departmentId || "Company-wide"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Due Date</p>
                <p className={cn("font-medium mt-0.5", task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done" && "text-red-500")}>
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "--"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="font-medium mt-0.5">
                  {new Date(task.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Updated</p>
                <p className="font-medium mt-0.5">
                  {new Date(task.updatedAt).toLocaleDateString()}
                </p>
              </div>
              {task.estimatedTokens !== null && (
                <div>
                  <p className="text-xs text-muted-foreground">Est. tokens</p>
                  <p className="font-medium mt-0.5">
                    {task.estimatedTokens?.toLocaleString()}
                  </p>
                </div>
              )}
              {task.actualTokens > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Actual tokens</p>
                  <p className="font-medium mt-0.5">
                    {task.actualTokens.toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* Dependencies */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Link size={12} />
                Dependencies
              </label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(!task.dependencies || task.dependencies.length === 0) && (
                  <p className="text-sm text-muted-foreground">No dependencies</p>
                )}
                {task.dependencies?.map((depId) => (
                  <span
                    key={depId}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-xs font-mono font-medium"
                  >
                    <span className="text-muted-foreground">blocked by</span>
                    {depId}
                    <button
                      onClick={() => handleRemoveDep(depId)}
                      className="ml-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={depInput}
                  onChange={(e) => setDepInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddDep()
                    }
                  }}
                  placeholder="TASK-001"
                  className="flex-1 bg-inset rounded-lg px-3 py-1.5 text-sm outline-none border border-border font-mono"
                />
                <button
                  onClick={handleAddDep}
                  disabled={!depInput.trim()}
                  className={cn(
                    "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    depInput.trim()
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-secondary text-muted-foreground cursor-not-allowed"
                  )}
                >
                  <Plus size={14} />
                  Add
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Notes
                </label>
                {!editingNotes && (
                  <button
                    onClick={() => setEditingNotes(true)}
                    className="text-xs text-primary hover:underline"
                  >
                    Edit
                  </button>
                )}
              </div>
              {editingNotes ? (
                <div className="mt-1 space-y-2">
                  <textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    rows={4}
                    className="w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveNotes}
                      className="px-3 py-1 text-xs font-medium rounded-lg bg-primary text-primary-foreground"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingNotes(false)
                        setNotesValue(task.notes || "")
                      }}
                      className="px-3 py-1 text-xs rounded-lg hover:bg-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                  {task.notes || "No notes"}
                </p>
              )}
            </div>

            {/* Attachments */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Paperclip size={12} />
                Attachments
              </label>
              <div className="mt-2 space-y-1.5">
                {attachments.length === 0 && (
                  <p className="text-sm text-muted-foreground">No attachments</p>
                )}
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-inset border border-border text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Paperclip size={14} className="text-muted-foreground shrink-0" />
                      <span className="truncate font-medium">{att.filename}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {att.size >= 1024 * 1024
                          ? `${(att.size / (1024 * 1024)).toFixed(1)} MB`
                          : att.size >= 1024
                            ? `${(att.size / 1024).toFixed(1)} KB`
                            : `${att.size} B`}
                      </span>
                    </div>
                    <a
                      href={`/api/tasks/${task.id}/attachments?file=${encodeURIComponent(att.path)}`}
                      download={att.filename}
                      className="text-xs text-primary hover:underline shrink-0 ml-2"
                    >
                      Download
                    </a>
                  </div>
                ))}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className={cn(
                  "mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  "bg-secondary text-foreground hover:bg-secondary/80",
                  uploadingFile && "opacity-50 cursor-not-allowed"
                )}
              >
                <Upload size={14} />
                {uploadingFile ? "Uploading..." : "Upload File"}
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {task.status !== "in-progress" && task.status !== "done" && (
                <button
                  onClick={() => onStatusChange("in-progress")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium",
                    "bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  )}
                >
                  <Play size={14} />
                  Start
                </button>
              )}
              {task.status !== "done" && (
                <button
                  onClick={() => onStatusChange("done")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium",
                    "bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  )}
                >
                  <CheckCircle2 size={14} />
                  Complete
                </button>
              )}
            </div>

            {/* Comments */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Comments
              </label>
              <div className="mt-2 space-y-3">
                {comments.length === 0 && (
                  <p className="text-sm text-muted-foreground">No comments yet</p>
                )}
                {comments.map((c) => (
                  <div key={c.id} className="border-l-2 border-border pl-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {c.authorAgentId || c.authorUserId || "Unknown"}
                      </span>
                      <span>
                        {new Date(c.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm mt-0.5 whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))}
              </div>

              {/* Add comment */}
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSendComment()
                    }
                  }}
                  placeholder="Add a comment..."
                  className="flex-1 bg-inset rounded-lg px-3 py-2 text-sm outline-none border border-border"
                />
                <button
                  onClick={handleSendComment}
                  disabled={!commentText.trim()}
                  className={cn(
                    "p-3 rounded-lg transition-colors",
                    commentText.trim()
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
