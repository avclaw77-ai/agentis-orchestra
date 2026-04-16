"use client"

import { Monitor, Users, Layers } from "lucide-react"
import { cn } from "@/lib/utils"

interface WelcomeStepProps {
  locale: string
  onLocaleChange: (l: string) => void
}

const copy = {
  en: {
    tagline: "Your multi-agent team starts here.",
    subtitle:
      "AgentisOrchestra orchestrates AI agents across departments, models, and workflows. This setup takes about 3 minutes.",
    feat1: "Multi-model routing",
    feat2: "Department-based teams",
    feat3: "Workflow automation",
    start: "Get Started",
  },
  fr: {
    tagline: "Votre equipe multi-agents commence ici.",
    subtitle:
      "AgentisOrchestra orchestre des agents IA a travers departements, modeles et flux de travail. La configuration prend environ 3 minutes.",
    feat1: "Routage multi-modeles",
    feat2: "Equipes par departement",
    feat3: "Automatisation des flux",
    start: "Commencer",
  },
} as const

export function WelcomeStep({ locale, onLocaleChange }: WelcomeStepProps) {
  const t = locale === "fr" ? copy.fr : copy.en

  return (
    <div>
      {/* Brand */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center">
          <img src="/logo.svg" alt="AgentisOrchestra" className="w-7 h-7" />
        </div>
        <div>
          <div className="text-xl font-extrabold tracking-tight text-foreground">
            Agentis<span className="text-primary">Orchestra</span>
          </div>
          <div className="text-[11px] text-muted-foreground/60 -mt-0.5">by AgentisLab</div>
        </div>
      </div>

      {/* Language toggle */}
      <div className="inline-flex bg-muted rounded-lg p-0.5 mb-8 mt-6">
        <button
          onClick={() => onLocaleChange("en")}
          className={cn(
            "px-5 py-2 rounded-md text-sm font-semibold transition-all",
            locale === "en"
              ? "bg-white text-foreground shadow-sm"
              : "text-muted-foreground"
          )}
        >
          English
        </button>
        <button
          onClick={() => onLocaleChange("fr")}
          className={cn(
            "px-5 py-2 rounded-md text-sm font-semibold transition-all",
            locale === "fr"
              ? "bg-white text-foreground shadow-sm"
              : "text-muted-foreground"
          )}
        >
          Francais
        </button>
      </div>

      {/* Hero */}
      <h1 className="text-[28px] font-extrabold tracking-tight leading-tight mb-2">
        {t.tagline}
      </h1>
      <p className="text-[15px] text-muted-foreground leading-relaxed mb-8">
        {t.subtitle}
      </p>

      {/* Feature pills */}
      <div className="flex gap-2.5 flex-wrap">
        <div className="flex items-center gap-2 px-3.5 py-2 bg-muted rounded-lg text-[13px] text-muted-foreground">
          <Monitor className="w-4 h-4" />
          <span>{t.feat1}</span>
        </div>
        <div className="flex items-center gap-2 px-3.5 py-2 bg-muted rounded-lg text-[13px] text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>{t.feat2}</span>
        </div>
        <div className="flex items-center gap-2 px-3.5 py-2 bg-muted rounded-lg text-[13px] text-muted-foreground">
          <Layers className="w-4 h-4" />
          <span>{t.feat3}</span>
        </div>
      </div>
    </div>
  )
}
