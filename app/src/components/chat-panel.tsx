"use client"

import { useState, useRef, useEffect } from "react"
import { Send } from "lucide-react"
import { cn } from "@/lib/utils"
import { AGENT_COLORS } from "@/lib/constants"

interface ChatPanelProps {
  channel: string
  agentName: string
  fullHeight?: boolean
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

export function ChatPanel({ channel, agentName, fullHeight }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Reset messages when channel changes
  useEffect(() => {
    setMessages([])
  }, [channel])

  async function handleSend() {
    if (!input.trim() || streaming) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setStreaming(true)

    // Create placeholder for assistant response
    const assistantId = crypto.randomUUID()
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
    ])

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, message: userMessage.content }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        let buffer = ""
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.token) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: m.content + data.token }
                        : m
                    )
                  )
                }
                if (data.result) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: data.result }
                        : m
                    )
                  )
                }
              } catch {
                // skip malformed SSE
              }
            }
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Error: ${err instanceof Error ? err.message : "Connection failed"}` }
            : m
        )
      )
    } finally {
      setStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const accentColor = AGENT_COLORS[channel] || "var(--primary)"

  return (
    <div
      className={cn(
        "flex flex-col bg-card rounded-xl border border-border",
        fullHeight ? "h-full rounded-none border-0" : "h-[500px]"
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: accentColor }}
        />
        <span className="text-sm font-medium">{agentName}</span>
        {streaming && (
          <span className="text-xs text-muted-foreground thinking-pulse ml-auto">
            typing...
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Start a conversation with {agentName}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "max-w-[85%]",
              msg.role === "user" ? "ml-auto" : "mr-auto"
            )}
          >
            <div
              className={cn(
                "px-4 py-2.5 rounded-xl text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-secondary text-foreground rounded-bl-sm"
              )}
            >
              {msg.content || (
                <span className="thinking-pulse text-muted-foreground">...</span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agentName}...`}
            rows={1}
            className="flex-1 resize-none bg-inset rounded-lg px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            className={cn(
              "p-2.5 rounded-lg transition-colors",
              input.trim() && !streaming
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
