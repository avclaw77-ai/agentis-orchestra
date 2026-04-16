"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Bot, User, Wrench, Brain, Cpu, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { AGENT_COLORS } from "@/lib/constants"

interface ChatPanelProps {
  channel: string
  agentName: string
  agentDisplayName?: string
  departmentId?: string | null
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

interface Message {
  id: string
  role: "user" | "assistant"
  blocks: MessageBlock[]
  timestamp: Date
  streaming?: boolean
}

export function ChatPanel({ channel, agentName, agentDisplayName, departmentId, fullHeight }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Load chat history when channel changes
  useEffect(() => {
    setMessages([])
    if (!channel) return
    fetch(`/api/chat/messages?channel=${encodeURIComponent(channel)}&limit=50`)
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
  }, [channel])

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
    if (!input.trim() || streaming) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      blocks: [{ type: "text", content: input.trim() }],
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
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, message: userMessage.blocks[0].content, departmentId }),
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
                  case "done":
                    if (data.result) {
                      // Replace text blocks with final result
                      setMessages((prev) =>
                        prev.map((m) => {
                          if (m.id !== assistantId) return m
                          const nonTextBlocks = m.blocks.filter((b) => b.type !== "text")
                          return { ...m, blocks: [...nonTextBlocks, { type: "text" as const, content: data.result }], streaming: false }
                        })
                      )
                    } else {
                      setMessages((prev) =>
                        prev.map((m) => m.id === assistantId ? { ...m, streaming: false } : m)
                      )
                    }
                    break
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
          <div className="ml-auto flex items-center gap-1.5 text-xs text-primary">
            <Loader2 size={12} className="animate-spin" />
            <span>Working...</span>
          </div>
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

        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}>
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
              {msg.blocks.map((block, i) => (
                <BlockRenderer key={i} block={block} role={msg.role} />
              ))}
              {msg.streaming && msg.blocks.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Thinking...</span>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border">
        <div className="flex gap-2">
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
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            className={cn(
              "px-3 rounded-lg transition-colors shrink-0",
              input.trim() && !streaming
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

function BlockRenderer({ block, role }: { block: MessageBlock; role: string }) {
  switch (block.type) {
    case "text":
      return (
        <div className={cn(
          "text-sm leading-relaxed whitespace-pre-wrap",
          role === "user"
            ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-md px-4 py-2.5 inline-block"
            : "text-foreground"
        )}>
          {block.content}
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
            {block.input && (
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
