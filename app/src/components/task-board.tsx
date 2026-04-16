"use client"

import { cn } from "@/lib/utils"
import { TASK_COLUMNS } from "@/lib/constants"

// Placeholder -- will be wired to DB in next iteration
export function TaskBoard() {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Task Board</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {TASK_COLUMNS.map((col) => (
          <div
            key={col.key}
            className="bg-card rounded-xl border border-border p-4 min-h-[300px]"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground">{col.label}</h3>
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                0
              </span>
            </div>
            <div className="space-y-2">
              <div className={cn(
                "border border-dashed border-border rounded-lg p-6",
                "flex items-center justify-center text-xs text-muted-foreground"
              )}>
                No tasks
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
