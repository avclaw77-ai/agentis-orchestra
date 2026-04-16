"use client"

import {
  Terminal,
  Cpu,
  Search,
  Brain,
  Check,
  X,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface ProviderStatus {
  provider: string
  name: string
  description: string
  color: string
  apiKey: string
  isValid: boolean | null
  testing: boolean
}

interface ProvidersStepProps {
  providers: ProviderStatus[]
  onTestProvider: (provider: string, key: string) => Promise<boolean>
  onKeyChange: (provider: string, key: string) => void
}

const PROVIDER_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "claude-cli": Terminal,
  openrouter: Cpu,
  perplexity: Search,
  openai: Brain,
}

function StatusBadge({ status }: { status: ProviderStatus }) {
  if (status.provider === "claude-cli") {
    if (status.isValid === true) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
          <span className="w-[7px] h-[7px] rounded-full bg-emerald-500" />
          Detected on system
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">
        <span className="w-[7px] h-[7px] rounded-full bg-muted-foreground" />
        Not found
      </span>
    )
  }

  if (status.isValid === true) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
        <span className="w-[7px] h-[7px] rounded-full bg-emerald-500" />
        Connected
      </span>
    )
  }
  if (status.isValid === false) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-50 text-red-500">
        <span className="w-[7px] h-[7px] rounded-full bg-red-500" />
        Invalid key
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground">
      <span className="w-[7px] h-[7px] rounded-full bg-muted-foreground" />
      Not configured
    </span>
  )
}

function ProviderCard({
  status,
  onTest,
  onKeyChange,
}: {
  status: ProviderStatus
  onTest: (provider: string, key: string) => Promise<boolean>
  onKeyChange: (provider: string, key: string) => void
}) {
  const Icon = PROVIDER_ICON_MAP[status.provider] || Terminal
  const isCli = status.provider === "claude-cli"

  return (
    <div
      className={cn(
        "flex items-start gap-3.5 p-4 border-[1.5px] rounded-xl mb-3 transition-colors",
        status.isValid === true
          ? "border-emerald-500 bg-emerald-50/50"
          : status.isValid === false
            ? "border-red-400 bg-red-50/50"
            : "border-border hover:border-slate-300"
      )}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
        style={{ background: status.color }}
      >
        <Icon className="w-[18px] h-[18px] text-white" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold mb-0.5">{status.name}</div>
        <div className="text-xs text-muted-foreground mb-2.5">
          {status.description}
        </div>
        <StatusBadge status={status} />

        {/* CLI: manual detect button */}
        {isCli && (
          <div className="mt-2.5">
            <button
              onClick={() => onTest(status.provider, "")}
              disabled={status.testing}
              className={cn(
                "px-3 py-[7px] border-[1.5px] rounded-md text-xs font-semibold whitespace-nowrap transition-all",
                status.testing
                  ? "border-border text-muted-foreground bg-white cursor-wait"
                  : status.isValid === true
                    ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                    : "border-border text-muted-foreground bg-white hover:border-primary hover:text-primary"
              )}
            >
              {status.testing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : status.isValid === true ? (
                <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Detected</span>
              ) : (
                "Detect CLI"
              )}
            </button>
          </div>
        )}

        {/* API key input (not for CLI) */}
        {!isCli && (
          <div className="flex gap-2 items-center mt-2.5">
            <input
              type="password"
              value={status.apiKey}
              onChange={(e) => onKeyChange(status.provider, e.target.value)}
              placeholder={
                status.provider === "openrouter"
                  ? "sk-or-..."
                  : status.provider === "perplexity"
                    ? "pplx-..."
                    : "sk-..."
              }
              spellCheck={false}
              className="flex-1 px-3 py-[7px] border-[1.5px] border-border rounded-md font-mono text-xs text-foreground bg-white outline-none transition-all focus:border-primary focus:ring-[3px] focus:ring-primary/10"
            />
            <button
              onClick={() => onTest(status.provider, status.apiKey)}
              disabled={status.testing || !status.apiKey}
              className={cn(
                "px-3 py-[7px] border-[1.5px] rounded-md text-xs font-semibold whitespace-nowrap transition-all",
                status.testing
                  ? "border-border text-muted-foreground bg-white cursor-wait"
                  : status.isValid === true
                    ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                    : status.isValid === false
                      ? "border-red-400 text-red-500 bg-red-50"
                      : "border-border text-muted-foreground bg-white hover:border-primary hover:text-primary"
              )}
            >
              {status.testing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : status.isValid === true ? (
                <Check className="w-3.5 h-3.5" />
              ) : status.isValid === false ? (
                <X className="w-3.5 h-3.5" />
              ) : (
                "Test"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function ProvidersStep({
  providers,
  onTestProvider,
  onKeyChange,
}: ProvidersStepProps) {
  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold text-muted-foreground tracking-wide mb-1.5">
          Step 4 of 7
        </p>
        <h2 className="text-2xl font-bold tracking-tight mb-1.5">
          Connect AI providers
        </h2>
        <p className="text-[15px] text-muted-foreground leading-relaxed">
          At least one provider is needed. Claude CLI is free with a Pro
          subscription.
        </p>
      </div>

      {providers.map((p) => (
        <ProviderCard
          key={p.provider}
          status={p}
          onTest={onTestProvider}
          onKeyChange={onKeyChange}
        />
      ))}

      <p className="text-xs text-muted-foreground mt-4 text-center">
        At minimum, Claude CLI or one API key is required.
      </p>
    </div>
  )
}
