"use client"

import { Building2 } from "lucide-react"

interface CompanyData {
  name: string
  mission: string
}

interface CompanyStepProps {
  data: CompanyData
  onChange: (d: CompanyData) => void
}

export function CompanyStep({ data, onChange }: CompanyStepProps) {
  function update(field: keyof CompanyData, value: string) {
    onChange({ ...data, [field]: value })
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold text-muted-foreground tracking-wide mb-1.5">
          Step 3 of 7
        </p>
        <h2 className="text-2xl font-bold tracking-tight mb-1.5">
          About your organization
        </h2>
        <p className="text-[15px] text-muted-foreground leading-relaxed">
          This helps agents understand context and align with your goals.
        </p>
      </div>

      {/* Company name */}
      <div className="mb-5">
        <label className="block text-[13px] font-semibold text-foreground mb-1.5">
          Company or team name
        </label>
        <div className="relative">
          <input
            type="text"
            value={data.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="e.g. Acme Corp"
            className="w-full px-3.5 py-2.5 border-[1.5px] border-border rounded-lg font-sans text-sm text-foreground bg-white outline-none transition-all focus:border-primary focus:ring-[3px] focus:ring-primary/10 placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      {/* Mission */}
      <div className="mb-5">
        <label className="block text-[13px] font-semibold text-foreground mb-1.5">
          Mission in one sentence
          <span className="font-normal text-muted-foreground ml-1.5">
            (optional)
          </span>
        </label>
        <textarea
          value={data.mission}
          onChange={(e) => update("mission", e.target.value)}
          rows={2}
          placeholder="What does your company do?"
          className="w-full px-3.5 py-2.5 border-[1.5px] border-border rounded-lg font-sans text-sm text-foreground bg-white outline-none transition-all focus:border-primary focus:ring-[3px] focus:ring-primary/10 placeholder:text-muted-foreground/50 resize-y min-h-[60px]"
        />
      </div>

      {/* Context note */}
      <div className="flex items-start gap-2.5 px-3.5 py-3 bg-muted rounded-lg text-[13px] text-muted-foreground">
        <Building2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>
          Agents use this to personalize responses and align with your
          organization's objectives.
        </span>
      </div>
    </div>
  )
}
