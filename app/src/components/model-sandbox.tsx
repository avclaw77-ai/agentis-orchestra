"use client"

import { useState, useRef } from "react"
import { Send, Loader2, Cpu, Zap, DollarSign, Clock } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

interface ModelOption {
  id: string
  name: string
  provider: string
  costTier: string
  mode: string
}

interface SandboxResult {
  model: string
  response: string
  durationMs: number
  tokens?: { input: number; output: number }
}

const MODELS: ModelOption[] = [
  { id: "claude-cli:opus", name: "Claude Opus 4.6 (CLI)", provider: "Claude CLI", costTier: "subscription", mode: "cli" },
  { id: "claude-cli:sonnet", name: "Claude Sonnet 4.6 (CLI)", provider: "Claude CLI", costTier: "subscription", mode: "cli" },
  { id: "claude-cli:haiku", name: "Claude Haiku 4.5 (CLI)", provider: "Claude CLI", costTier: "subscription", mode: "cli" },
  { id: "anthropic:opus", name: "Claude Opus 4.6 (API)", provider: "Anthropic", costTier: "premium", mode: "api" },
  { id: "anthropic:sonnet", name: "Claude Sonnet 4.6 (API)", provider: "Anthropic", costTier: "standard", mode: "api" },
  { id: "anthropic:haiku", name: "Claude Haiku 4.5 (API)", provider: "Anthropic", costTier: "cheap", mode: "api" },
  { id: "perplexity:sonar-pro", name: "Sonar Pro", provider: "Perplexity", costTier: "standard", mode: "api" },
  { id: "perplexity:sonar", name: "Sonar", provider: "Perplexity", costTier: "cheap", mode: "api" },
  { id: "openai:gpt-5.4", name: "GPT-5.4", provider: "OpenAI", costTier: "standard", mode: "api" },
  { id: "openai:gpt-5.4-pro", name: "GPT-5.4 Pro", provider: "OpenAI", costTier: "premium", mode: "api" },
  { id: "openai:gpt-5.4-mini", name: "GPT-5.4 Mini", provider: "OpenAI", costTier: "cheap", mode: "api" },
  { id: "openai:o4-mini", name: "o4-mini", provider: "OpenAI", costTier: "standard", mode: "api" },
  { id: "openai:o3", name: "o3", provider: "OpenAI", costTier: "premium", mode: "api" },
  { id: "openrouter:deepseek-v3", name: "DeepSeek V3", provider: "OpenRouter", costTier: "cheap", mode: "api" },
  { id: "openrouter:gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "OpenRouter", costTier: "standard", mode: "api" },
  { id: "openrouter:llama-4-maverick", name: "Llama 4 Maverick", provider: "OpenRouter", costTier: "cheap", mode: "api" },
  { id: "openrouter:qwen-3-235b", name: "Qwen 3 235B", provider: "OpenRouter", costTier: "cheap", mode: "api" },
]

const COST_BADGE: Record<string, string> = {
  subscription: "bg-violet-50 text-violet-600",
  cheap: "bg-sky-50 text-sky-600",
  standard: "bg-amber-50 text-amber-600",
  premium: "bg-red-50 text-red-500",
}

const COST_LABELS: Record<string, string> = {
  subscription: "SUB",
  cheap: "$",
  standard: "$$",
  premium: "$$$",
}

const PRESETS = [
  { label: "Summarize", prompt: "Summarize the key points of the following text in 3 bullet points:\n\n[paste text here]" },
  { label: "Code Review", prompt: "Review this code for bugs, security issues, and improvements:\n\n```\n[paste code here]\n```" },
  { label: "Translate FR", prompt: "Translate the following to Quebec French (natural, not Parisian):\n\n[text here]" },
  { label: "Research", prompt: "Give me a brief overview of [topic], including recent developments and key players." },
]

export function ModelSandbox() {
  const [selectedModel, setSelectedModel] = useState(MODELS[1].id) // default sonnet
  const [prompt, setPrompt] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [results, setResults] = useState<SandboxResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showSystem, setShowSystem] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  async function handleSend() {
    if (!prompt.trim() || loading) return

    const model = MODELS.find((m) => m.id === selectedModel)
    if (!model) return

    setLoading(true)
    const startTime = Date.now()

    try {
      abortRef.current = new AbortController()

      // For CLI models, use the chat endpoint via a temporary agent channel
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "sandbox",
          message: prompt.trim(),
          departmentId: null,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      // Read the SSE stream
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let fullResult = ""
      let currentEvent = ""

      if (reader) {
        let buffer = ""
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
                if (currentEvent === "token" || (!currentEvent && data.token)) {
                  fullResult += data.token || ""
                }
                if (currentEvent === "done" && data.result) {
                  fullResult = data.result
                }
              } catch { /* skip */ }
              currentEvent = ""
            }
          }
        }
      }

      const durationMs = Date.now() - startTime

      setResults((prev) => [{
        model: model.name,
        response: fullResult || "(empty response)",
        durationMs,
      }, ...prev])
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setResults((prev) => [{
          model: model?.name || "Unknown",
          response: `Error: ${err instanceof Error ? err.message : "Request failed"}`,
          durationMs: Date.now() - startTime,
        }, ...prev])
      }
    } finally {
      setLoading(false)
    }
  }

  function handleStop() {
    abortRef.current?.abort()
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Models Sandbox</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Test any configured model. Compare responses, speed, and cost.</p>
      </div>

      {/* Model selector */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <label className="text-xs font-medium text-muted-foreground block mb-2">Select Model</label>
        <div className="flex flex-wrap gap-2">
          {MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedModel(m.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border",
                selectedModel === m.id
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30"
              )}
            >
              <Cpu size={12} />
              <span>{m.name}</span>
              <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", COST_BADGE[m.costTier])}>
                {m.costTier === "free" ? "FREE" : m.costTier === "cheap" ? "$" : "$$"}
              </span>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Provider: {MODELS.find((m) => m.id === selectedModel)?.provider} | Mode: {MODELS.find((m) => m.id === selectedModel)?.mode}
        </p>
      </div>

      {/* Prompt presets */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="text-xs text-muted-foreground self-center">Quick:</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => setPrompt(p.prompt)}
            className="px-2.5 py-1 rounded-lg bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* System prompt (collapsible) */}
      <button
        onClick={() => setShowSystem(!showSystem)}
        className="text-xs text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1"
      >
        {showSystem ? "Hide" : "Show"} system prompt
      </button>
      {showSystem && (
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="Optional system prompt..."
          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none resize-y mb-3 font-mono"
          rows={3}
        />
      )}

      {/* Prompt input */}
      <div className="flex gap-2 mb-6">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !loading) { e.preventDefault(); handleSend() } }}
          placeholder="Type a prompt to test..."
          className="flex-1 bg-card border border-border rounded-lg px-4 py-3 text-sm outline-none resize-none min-h-[60px] max-h-[200px] focus:border-primary"
          rows={2}
          disabled={loading}
        />
        <div className="flex flex-col gap-1">
          {loading ? (
            <button onClick={handleStop} className="px-4 py-3 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors">
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!prompt.trim()}
              className={cn(
                "px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                prompt.trim()
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Send size={14} />
              Run
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Results ({results.length})</h3>
            <button onClick={() => setResults([])} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
          </div>
          {results.map((r, i) => (
            <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/30">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <Cpu size={12} className="text-primary" />
                  {r.model}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock size={10} />
                  {(r.durationMs / 1000).toFixed(1)}s
                </div>
                {r.tokens && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Zap size={10} />
                    {r.tokens.input}in/{r.tokens.output}out
                  </div>
                )}
              </div>
              <div className="p-4 prose prose-sm prose-slate max-w-none text-sm [&_pre]:bg-slate-50 [&_pre]:border [&_pre]:rounded-lg [&_pre]:text-xs [&_code]:text-xs [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:rounded [&_code]:before:content-none [&_code]:after:content-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{r.response}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      )}

      {results.length === 0 && !loading && (
        <div className="text-center py-12 text-muted-foreground">
          <Cpu size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a model, type a prompt, and hit Run</p>
          <p className="text-xs mt-1 opacity-60">Compare outputs across different models and providers</p>
        </div>
      )}
    </div>
  )
}
