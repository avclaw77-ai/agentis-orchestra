"use client"

import { CheckCircle } from "lucide-react"

interface ReadyStepDepartment {
  name: string
  color: string
  agents: Array<{ name: string; model: string }>
}

interface ReadyStepProps {
  companyName: string
  departments: ReadyStepDepartment[]
  providerCount: number
  locale: string
  onAddDepartment?: () => void
}

export function ReadyStep({
  companyName,
  departments,
  providerCount,
  locale,
  onAddDepartment,
}: ReadyStepProps) {
  const isFr = locale === "fr"
  const totalAgents = departments.reduce(
    (sum, d) => sum + d.agents.length,
    0
  )

  return (
    <div>
      {/* Success hero */}
      <div className="text-center pt-2 pb-1">
        <div className="w-16 h-16 rounded-full bg-emerald-50 inline-flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight mb-1">
          {isFr ? "Tout est pret!" : "You're all set!"}
        </h2>
        <p className="text-[15px] text-muted-foreground mb-7">
          {isFr
            ? "Votre organisation est configuree."
            : "Your organization is configured and ready to go."}
        </p>
      </div>

      {/* Organization summary */}
      <div className="p-4 bg-muted rounded-xl mb-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
          {isFr ? "Organisation" : "Organization"}
        </h4>
        <div className="flex justify-between items-center py-1 text-sm">
          <span className="text-muted-foreground">
            {isFr ? "Nom" : "Name"}
          </span>
          <span className="font-semibold">{companyName || "--"}</span>
        </div>
        <div className="flex justify-between items-center py-1 text-sm">
          <span className="text-muted-foreground">
            {isFr ? "Fournisseurs" : "Providers"}
          </span>
          <span className="font-semibold">
            {providerCount} {isFr ? "connectes" : "connected"}
          </span>
        </div>
        <div className="flex justify-between items-center py-1 text-sm">
          <span className="text-muted-foreground">
            {isFr ? "Departements" : "Departments"}
          </span>
          <span className="font-semibold">{departments.length}</span>
        </div>
        <div className="flex justify-between items-center py-1 text-sm">
          <span className="text-muted-foreground">
            {isFr ? "Agents" : "Agents"}
          </span>
          <span className="font-semibold">{totalAgents}</span>
        </div>
      </div>

      {/* Department breakdown */}
      <div className="p-4 bg-muted rounded-xl mb-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
          {isFr ? "Equipes" : "Teams"}
        </h4>
        {departments.map((dept) => (
          <div key={dept.name} className="mb-3 last:mb-0">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-3 h-3 rounded flex-shrink-0"
                style={{ background: dept.color }}
              />
              <span className="text-sm font-semibold">{dept.name}</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {dept.agents.length} agent
                {dept.agents.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="pl-5">
              {dept.agents.map((agent) => (
                <div
                  key={agent.name}
                  className="text-[13px] text-muted-foreground py-0.5"
                >
                  {agent.name}{" "}
                  <span className="text-muted-foreground/60">
                    -- {agent.model}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-3 pt-3 border-t border-border text-[13px] text-muted-foreground">
          {departments.length} {isFr ? "departement" : "department"}
          {departments.length !== 1 ? "s" : ""}, {totalAgents} agent
          {totalAgents !== 1 ? "s" : ""} total
        </div>
      </div>

      {/* Add another department */}
      {onAddDepartment && (
        <div className="text-center mt-5">
          <button
            onClick={onAddDepartment}
            className="text-sm font-medium text-primary hover:underline"
          >
            {isFr ? "+ Ajouter un autre departement" : "+ Add another department"}
          </button>
        </div>
      )}
    </div>
  )
}
