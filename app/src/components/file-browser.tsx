"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Folder, FileText, FileCode, Image as ImageIcon, FileSpreadsheet,
  Download, Eye, ChevronRight, Home, Upload, X, ArrowLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Agent } from "@/types"

interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: string | null
  extension: string | null
}

interface FileBrowserProps {
  agents: Agent[]
}

const ICON_MAP: Record<string, React.ReactNode> = {
  md: <FileText size={16} className="text-blue-500" />,
  txt: <FileText size={16} className="text-gray-500" />,
  json: <FileCode size={16} className="text-amber-500" />,
  ts: <FileCode size={16} className="text-blue-600" />,
  tsx: <FileCode size={16} className="text-blue-600" />,
  js: <FileCode size={16} className="text-yellow-500" />,
  py: <FileCode size={16} className="text-green-600" />,
  html: <FileCode size={16} className="text-orange-500" />,
  css: <FileCode size={16} className="text-purple-500" />,
  csv: <FileSpreadsheet size={16} className="text-green-600" />,
  xlsx: <FileSpreadsheet size={16} className="text-green-700" />,
  png: <ImageIcon size={16} className="text-pink-500" />,
  jpg: <ImageIcon size={16} className="text-pink-500" />,
  pdf: <FileText size={16} className="text-red-500" />,
}

function getIcon(entry: FileEntry) {
  if (entry.isDirectory) return <Folder size={16} className="text-primary" />
  return ICON_MAP[entry.extension || ""] || <FileText size={16} className="text-gray-400" />
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return "just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString()
}

export function FileBrowser({ agents }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState("")
  const [files, setFiles] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [previewFile, setPreviewFile] = useState<{ path: string; content: string; name: string } | null>(null)
  const [filterAgent, setFilterAgent] = useState("")

  const fetchFiles = useCallback(async (path: string, agent?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (path) params.set("path", path)
      if (agent) params.set("agent", agent)
      const res = await fetch(`/api/files?${params}`)
      if (res.ok) {
        const data = await res.json()
        setFiles(data.files || [])
        setCurrentPath(data.path || "")
      }
    } catch {
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFiles(filterAgent ? "" : "/", filterAgent || undefined)
  }, [fetchFiles, filterAgent])

  function navigateTo(path: string) {
    setFilterAgent("")
    fetchFiles(path)
  }

  function goUp() {
    if (filterAgent) {
      setFilterAgent("")
      fetchFiles("/")
      return
    }
    const parts = currentPath.split("/").filter(Boolean)
    parts.pop()
    fetchFiles(parts.length ? parts.join("/") : "/")
  }

  async function openFile(entry: FileEntry) {
    if (entry.isDirectory) {
      fetchFiles(entry.path)
      return
    }

    // Text files: preview inline
    const textExts = ["md", "txt", "json", "yaml", "yml", "csv", "html", "css", "js", "ts", "tsx", "jsx", "py", "sh", "sql", "xml", "toml", "log"]
    if (entry.extension && textExts.includes(entry.extension)) {
      try {
        const res = await fetch(`/api/files/read?path=${encodeURIComponent(entry.path)}`)
        if (res.ok) {
          const data = await res.json()
          setPreviewFile({ path: entry.path, content: data.content, name: entry.name })
        }
      } catch { /* skip */ }
      return
    }

    // Images: open in new tab
    if (entry.extension && ["png", "jpg", "jpeg", "gif", "svg"].includes(entry.extension)) {
      window.open(`/api/files/read?path=${encodeURIComponent(entry.path)}`, "_blank")
      return
    }

    // Binary: download
    window.open(`/api/files/read?path=${encodeURIComponent(entry.path)}`, "_blank")
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async () => {
      const content = reader.result as string
      await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          content,
          path: currentPath || "uploads",
        }),
      })
      fetchFiles(currentPath || "/", filterAgent || undefined)
    }

    // Read as base64 for binary, text for text
    const textTypes = ["text/", "application/json", "application/xml"]
    if (textTypes.some((t) => file.type.startsWith(t))) {
      reader.readAsText(file)
    } else {
      reader.readAsDataURL(file)
    }

    e.target.value = ""
  }

  const breadcrumbs = currentPath ? currentPath.split("/").filter(Boolean) : []

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Files</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Agent outputs, uploads, and workspace files</p>
        </div>
        <label className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors">
          <Upload size={14} />
          Upload
          <input type="file" className="hidden" onChange={handleUpload} />
        </label>
      </div>

      {/* Agent filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => { setFilterAgent(""); fetchFiles("/") }}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
            !filterAgent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          All Files
        </button>
        {agents.filter((a) => !a.isCeo).map((agent) => (
          <button
            key={agent.id}
            onClick={() => setFilterAgent(agent.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              filterAgent === agent.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {agent.displayName || agent.name}
          </button>
        ))}
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 mb-3 text-xs text-muted-foreground">
        <button onClick={() => navigateTo("/")} className="hover:text-foreground transition-colors flex items-center gap-1">
          <Home size={12} /> workspace
        </button>
        {breadcrumbs.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight size={10} />
            <button
              onClick={() => navigateTo(breadcrumbs.slice(0, i + 1).join("/"))}
              className="hover:text-foreground transition-colors"
            >
              {part}
            </button>
          </span>
        ))}
        {(currentPath || filterAgent) && (
          <button onClick={goUp} className="ml-auto flex items-center gap-1 hover:text-foreground">
            <ArrowLeft size={12} /> Back
          </button>
        )}
      </div>

      {/* File list */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading && (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        )}

        {!loading && files.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {filterAgent ? `No outputs from ${filterAgent} yet` : "No files in this directory"}
          </div>
        )}

        {!loading && files.map((entry) => (
          <button
            key={entry.path}
            onClick={() => openFile(entry)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors border-b border-border last:border-b-0"
          >
            {getIcon(entry)}
            <span className="text-sm font-medium flex-1 truncate">{entry.name}</span>
            {!entry.isDirectory && (
              <span className="text-[11px] text-muted-foreground">{formatSize(entry.size)}</span>
            )}
            <span className="text-[11px] text-muted-foreground w-16 text-right">{formatDate(entry.modified)}</span>
            {entry.isDirectory ? (
              <ChevronRight size={14} className="text-muted-foreground" />
            ) : (
              <Download size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100" />
            )}
          </button>
        ))}
      </div>

      {/* Preview modal */}
      {previewFile && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setPreviewFile(null)} />
          <div className="fixed inset-4 md:inset-12 z-50 bg-card rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-primary" />
                <span className="text-sm font-semibold">{previewFile.name}</span>
                <span className="text-xs text-muted-foreground">{previewFile.path}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/files/read?path=${encodeURIComponent(previewFile.path)}`}
                  download
                  className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
                  title="Download"
                >
                  <Download size={14} />
                </a>
                <button onClick={() => setPreviewFile(null)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <pre className="text-sm font-mono leading-relaxed whitespace-pre-wrap text-foreground">
                {previewFile.content}
              </pre>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
