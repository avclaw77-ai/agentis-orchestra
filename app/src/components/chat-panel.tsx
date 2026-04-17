"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Bot, User, Wrench, Brain, Cpu, Loader2, Paperclip, Square, Copy, Check, Pencil, RotateCcw, Coins } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"
import { AGENT_COLORS } from "@/lib/constants"

interface ChatPanelProps {
  channel: string
  agentName: string
  agentDisplayName?: string
  departmentId?: string | null
  conversationId?: string | null
  fullHeight?: boolean
}

type MessageBlockType = "text" | "thinking" | "tool_use" | "tool_result" | "system" | "model"

interface MessageBlock {
  type: MessageBlockType
  content: string
  tool?: string
  input?: unknown
  output?: unknown
  modelId?: string
  reason?: string
}

interface TokenUsage {
  inputTokens?: number
  outputTokens?: number
  cost?: number
}

interface Message {
  id: string
  role: "user" | "assistant"
  blocks: MessageBlock[]
  timestamp: Date
  streaming?: boolean
  usage?: TokenUsage
}

export function ChatPanel({ channel, agentName, agentDisplayName, departmentId, conversationId, fullHeight }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Load chat history when channel or conversation changes
  useEffect(() => {
    setMessages([])
    if (!channel) return
    const params = new URLSearchParams({ channel, limit: "50" })
    if (conversationId) params.set("conversationId", conversationId)
    fetch(`/api/chat/messages?${params}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return
        const msgs = (data.messages || data || []) as Array<{ id: number; role: string; content: string; createdAt: string }>
        setMessages(
          msgs.map((m) => ({
            id: String(m.id),
            role: m.role as "user" | "assistant",
            blocks: [{ type: "text" as const, content: m.content }],
            timestamp: new Date(m.createdAt),
          }))
        )
      })
      .catch(() => {})
  }, [channel, conversationId])

  function addBlock(messageId: string, block: MessageBlock) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, blocks: [...m.blocks, block] } : m
      )
    )
  }

  function appendToLastTextBlock(messageId: string, text: string) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m
        const blocks = [...m.blocks]
        const lastIdx = blocks.length - 1
        if (lastIdx >= 0 && blocks[lastIdx].type === "text") {
          blocks[lastIdx] = { ...blocks[lastIdx], content: blocks[lastIdx].content + text }
        } else {
          blocks.push({ type: "text", content: text })
        }
        return { ...m, blocks }
      })
    )
  }

  async function handleSend() {
    if ((!input.trim() && !attachedFile) || streaming) return

    // Build message content -- include file content if attached
    let messageText = input.trim()
    if (attachedFile) {
      try {
        const isText = attachedFile.type.startsWith("text/") || ["application/json", "application/xml"].includes(attachedFile.type)
        const isImage = attachedFile.type.startsWith("image/")

        if (isText) {
          const fileContent = await attachedFile.text()
          const fileInfo = `[Attached file: ${attachedFile.name} (${(attachedFile.size / 1024).toFixed(1)} KB)]\n\n\`\`\`\n${fileContent}\n\`\`\``
          messageText = messageText ? `${messageText}\n\n${fileInfo}` : fileInfo
          // Save to workspace
          fetch("/api/files", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: attachedFile.name, content: fileContent, path: "uploads", agentId: channel }),
          }).catch(() => {})
        } else if (isImage) {
          // Read as base64 for vision-capable models
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(attachedFile)
          })
          messageText = messageText ? `${messageText}\n\n[Image: ${attachedFile.name}]` : `[Image: ${attachedFile.name}]`
          // Save to workspace
          fetch("/api/files", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: attachedFile.name, content: base64, path: "uploads", agentId: channel }),
          }).catch(() => {})
        } else {
          messageText = messageText || `[Attached file: ${attachedFile.name} (${attachedFile.type})]`
        }
      } catch {
        messageText = messageText || `[Attached file: ${attachedFile.name}]`
      }
      setAttachedFile(null)
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      blocks: [{ type: "text", content: messageText }],
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setStreaming(true)

    const assistantId = crypto.randomUUID()
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", blocks: [], timestamp: new Date(), streaming: true },
    ])

    try {
      abortRef.current = new AbortController()
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, message: userMessage.blocks[0].content, departmentId, conversationId }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        let buffer = ""
        let currentEvent = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim()
              continue
            }

            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6))
                const evt = currentEvent || "token"

                switch (evt) {
                  case "token":
                    appendToLastTextBlock(assistantId, data.token)
                    break
                  case "model":
                    addBlock(assistantId, {
                      type: "model", content: data.reason || "",
                      modelId: data.modelId, reason: data.reason,
                    })
                    break
                  case "thinking":
                    addBlock(assistantId, { type: "thinking", content: data.text || "" })
                    break
                  case "tool_use":
                    addBlock(assistantId, {
                      type: "tool_use", content: `Using ${data.tool}`,
                      tool: data.tool, input: data.input,
                    })
                    break
                  case "tool_result":
                    addBlock(assistantId, {
                      type: "tool_result",
                      content: typeof data.output === "string" ? data.output : JSON.stringify(data.output).slice(0, 200),
                      tool: data.tool, output: data.output,
                    })
                    break
                  case "system":
                    addBlock(assistantId, { type: "system", content: data.text || "" })
                    break
                  case "done": {
                    const usage: TokenUsage | undefined = data.usage ? {
                      inputTokens: data.usage.input_tokens,
                      outputTokens: data.usage.output_tokens,
                      cost: data.usage.cost,
                    } : undefined
                    if (data.result) {
                      setMessages((prev) =>
                        prev.map((m) => {
                          if (m.id !== assistantId) return m
                          const nonTextBlocks = m.blocks.filter((b) => b.type !== "text")
                          return { ...m, blocks: [...nonTextBlocks, { type: "text" as const, content: data.result }], streaming: false, usage }
                        })
                      )
                    } else {
                      setMessages((prev) =>
                        prev.map((m) => m.id === assistantId ? { ...m, streaming: false, usage } : m)
                      )
                    }
                    break
                  }
                  case "error":
                    addBlock(assistantId, { type: "system", content: `Error: ${data.error}` })
                    break
                }

                currentEvent = ""
              } catch {
                // skip malformed
              }
            }
          }
        }
      }
    } catch (err) {
      addBlock(assistantId, {
        type: "system",
        content: `Connection error: ${err instanceof Error ? err.message : "Failed"}`,
      })
    } finally {
      setStreaming(false)
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, streaming: false } : m)
      )
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Clipboard image paste (Ctrl+V / Cmd+V)
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            const ext = item.type.split("/")[1] || "png"
            const named = new File([file], `clipboard-${Date.now()}.${ext}`, { type: file.type })
            setAttachedFile(named)
          }
          break
        }
      }
    }
    window.addEventListener("paste", handlePaste)
    return () => window.removeEventListener("paste", handlePaste)
  }, [])

  const displayName = agentDisplayName || agentName
  const accentColor = AGENT_COLORS[channel] || "var(--primary)"

  return (
    <div className={cn(
      "flex flex-col bg-card rounded-xl border border-border",
      fullHeight ? "h-full rounded-none border-0" : "h-[600px]"
    )}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{ backgroundColor: accentColor }}
        >
          {displayName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">Chat with {displayName}</p>
          {agentDisplayName && <p className="text-[10px] text-muted-foreground">{agentName} agent</p>}
        </div>
        {streaming && (
          <button
            onClick={handleStop}
            className="ml-auto flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Square size={10} className="fill-current" />
            <span>Stop</span>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Bot size={32} className="mb-2 opacity-30" />
            <p className="text-sm">Send a message to start chatting with {displayName}</p>
            <p className="text-xs mt-1 opacity-60">The agent will use its persona and tools to respond</p>
          </div>
        )}

        {messages.map((msg, msgIdx) => (
          <div key={msg.id} className={cn("group/msg flex gap-3", msg.role === "user" && "flex-row-reverse")}>
            <div
              className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                msg.role === "user" ? "bg-secondary" : ""
              )}
              style={msg.role === "assistant" ? { backgroundColor: accentColor } : undefined}
            >
              {msg.role === "user"
                ? <User size={14} className="text-muted-foreground" />
                : <span className="text-[10px] font-bold text-white">{displayName.slice(0, 2).toUpperCase()}</span>
              }
            </div>

            <div className={cn("max-w-[80%] space-y-1.5", msg.role === "user" && "text-right")}>
              {/* Edit mode for user messages */}
              {editingMessageId === msg.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full bg-inset rounded-lg px-3 py-2 text-sm outline-none resize-none border border-border min-w-[250px]"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex gap-1.5 justify-end">
                    <button
                      onClick={() => setEditingMessageId(null)}
                      className="px-2.5 py-1 text-xs rounded-lg hover:bg-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (!editText.trim()) return
                        // Remove this message and all after it, then resend
                        const newMessages = messages.slice(0, msgIdx)
                        setMessages(newMessages)
                        setEditingMessageId(null)
                        setInput(editText.trim())
                        // Auto-send after state update
                        setTimeout(() => {
                          const sendBtn = document.querySelector("[data-send-btn]") as HTMLButtonElement
                          sendBtn?.click()
                        }, 50)
                      }}
                      className="px-2.5 py-1 text-xs rounded-lg bg-primary text-primary-foreground"
                    >
                      Resend
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {msg.blocks.map((block, i) => (
                    <BlockRenderer key={i} block={block} role={msg.role} />
                  ))}
                </>
              )}
              {msg.streaming && msg.blocks.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Thinking...</span>
                </div>
              )}
              {/* Action buttons: edit/retry for user, token count for assistant */}
              {!msg.streaming && !editingMessageId && (
                <div className={cn(
                  "flex items-center gap-1.5 mt-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}>
                  {msg.role === "user" && (
                    <>
                      <button
                        onClick={() => { setEditingMessageId(msg.id); setEditText(msg.blocks[0]?.content || "") }}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        title="Edit message"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => {
                          // Retry: remove this message + its response, resend
                          const newMessages = messages.slice(0, msgIdx)
                          setMessages(newMessages)
                          setInput(msg.blocks[0]?.content || "")
                          setTimeout(() => {
                            const sendBtn = document.querySelector("[data-send-btn]") as HTMLButtonElement
                            sendBtn?.click()
                          }, 50)
                        }}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        title="Retry message"
                      >
                        <RotateCcw size={11} />
                      </button>
                    </>
                  )}
                  {msg.role === "assistant" && msg.usage && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60" title={`Input: ${msg.usage.inputTokens || 0} / Output: ${msg.usage.outputTokens || 0}${msg.usage.cost ? ` / $${msg.usage.cost.toFixed(4)}` : ""}`}>
                      <Coins size={10} />
                      {formatTokenCount((msg.usage.inputTokens || 0) + (msg.usage.outputTokens || 0))}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border">
        {/* Attached file preview */}
        {attachedFile && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-muted rounded-lg text-xs">
            <Paperclip size={12} className="text-muted-foreground" />
            <span className="font-medium truncate flex-1">{attachedFile.name}</span>
            <span className="text-muted-foreground">{(attachedFile.size / 1024).toFixed(1)} KB</span>
            <button onClick={() => setAttachedFile(null)} className="text-muted-foreground hover:text-foreground">
              <span className="sr-only">Remove</span>&times;
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <label className="px-2 flex items-center cursor-pointer text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted">
            <Paperclip size={16} />
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) setAttachedFile(file)
                e.target.value = ""
              }}
              disabled={streaming}
            />
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${displayName}...`}
            className="flex-1 bg-inset rounded-lg px-3 py-2.5 text-sm outline-none resize-none min-h-[40px] max-h-[120px]"
            rows={1}
            disabled={streaming}
          />
          <button
            data-send-btn
            onClick={handleSend}
            disabled={(!input.trim() && !attachedFile) || streaming}
            className={cn(
              "px-3 rounded-lg transition-colors shrink-0",
              (input.trim() || attachedFile) && !streaming
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Block Renderer -- visual treatment for each stream event type
// =============================================================================

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-foreground transition-all"
      title="Copy"
    >
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
    </button>
  )
}

function BlockRenderer({ block, role }: { block: MessageBlock; role: string }) {
  switch (block.type) {
    case "text":
      if (role === "user") {
        return (
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-md px-4 py-2.5 inline-block text-sm leading-relaxed whitespace-pre-wrap">
            {block.content}
          </div>
        )
      }
      return (
        <div className="group relative text-sm leading-relaxed">
          <div className="absolute -right-8 top-0"><CopyButton text={block.content} /></div>
          <div className="prose prose-sm prose-slate max-w-none [&_pre]:bg-slate-50 [&_pre]:border [&_pre]:border-slate-200 [&_pre]:rounded-lg [&_pre]:text-xs [&_code]:text-xs [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:before:content-none [&_code]:after:content-none [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-bold [&_h2]:font-semibold [&_h3]:font-semibold [&_table]:text-xs [&_th]:px-3 [&_th]:py-1.5 [&_td]:px-3 [&_td]:py-1.5 [&_blockquote]:border-l-primary [&_a]:text-primary">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content}</ReactMarkdown>
          </div>
        </div>
      )

    case "model":
      return (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 py-0.5">
          <Cpu size={10} />
          <span className="font-mono">{block.modelId}</span>
        </div>
      )

    case "thinking":
      return (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs">
          <Brain size={12} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-amber-700">Reasoning</span>
            <p className="text-amber-600 mt-0.5 whitespace-pre-wrap">{block.content}</p>
          </div>
        </div>
      )

    case "tool_use":
      return (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs">
          <Wrench size={12} className="text-blue-500 shrink-0 mt-0.5 animate-pulse" />
          <div className="min-w-0">
            <span className="font-medium text-blue-700">Using: {block.tool}</span>
            {block.input != null && (
              <pre className="text-blue-500 mt-1 text-[10px] font-mono overflow-x-auto max-w-full whitespace-pre-wrap">
                {typeof block.input === "string" ? block.input : JSON.stringify(block.input, null, 2).slice(0, 500)}
              </pre>
            )}
          </div>
        </div>
      )

    case "tool_result":
      return (
        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs">
          <Wrench size={12} className="text-emerald-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="font-medium text-emerald-700">Result: {block.tool}</span>
            <pre className="text-emerald-600 mt-0.5 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap max-h-[100px] overflow-y-auto">
              {block.content}
            </pre>
          </div>
        </div>
      )

    case "system":
      return (
        <div className="text-[11px] text-muted-foreground/60 italic py-0.5">
          {block.content}
        </div>
      )

    default:
      return <div className="text-sm">{block.content}</div>
  }
}

function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return count.toString()
}
