"use client"

import { useState } from "react"
import { Eye, EyeOff, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

interface AdminData {
  email: string
  password: string
  name: string
}

interface AdminStepProps {
  data: AdminData
  onChange: (d: AdminData) => void
}

export function AdminStep({ data, onChange }: AdminStepProps) {
  const [showPassword, setShowPassword] = useState(false)

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
  const passwordValid = data.password.length >= 8

  function update(field: keyof AdminData, value: string) {
    onChange({ ...data, [field]: value })
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold text-muted-foreground tracking-wide mb-1.5">
          Step 2 of 7
        </p>
        <h2 className="text-2xl font-bold tracking-tight mb-1.5">
          Create your admin account
        </h2>
        <p className="text-[15px] text-muted-foreground leading-relaxed">
          This is your admin account. You'll use it to manage the platform.
        </p>
      </div>

      {/* Name */}
      <div className="mb-5">
        <label className="block text-[13px] font-semibold text-foreground mb-1.5">
          Name
        </label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="Alex Veilleux"
          className="w-full px-3.5 py-2.5 border-[1.5px] border-border rounded-lg font-sans text-sm text-foreground bg-white outline-none transition-all focus:border-primary focus:ring-[3px] focus:ring-primary/10 placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Email */}
      <div className="mb-5">
        <label className="block text-[13px] font-semibold text-foreground mb-1.5">
          Email
        </label>
        <input
          type="email"
          value={data.email}
          onChange={(e) => update("email", e.target.value)}
          placeholder="alex@company.com"
          className={cn(
            "w-full px-3.5 py-2.5 border-[1.5px] rounded-lg font-sans text-sm text-foreground bg-white outline-none transition-all focus:ring-[3px] placeholder:text-muted-foreground/50",
            data.email && !emailValid
              ? "border-destructive focus:border-destructive focus:ring-destructive/10"
              : "border-border focus:border-primary focus:ring-primary/10"
          )}
        />
        {data.email && !emailValid && (
          <p className="text-xs text-destructive mt-1">
            Please enter a valid email address.
          </p>
        )}
      </div>

      {/* Password */}
      <div className="mb-5">
        <label className="block text-[13px] font-semibold text-foreground mb-1.5">
          Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={data.password}
            onChange={(e) => update("password", e.target.value)}
            placeholder="Minimum 8 characters"
            className={cn(
              "w-full px-3.5 py-2.5 pr-10 border-[1.5px] rounded-lg font-sans text-sm text-foreground bg-white outline-none transition-all focus:ring-[3px] placeholder:text-muted-foreground/50",
              data.password && !passwordValid
                ? "border-destructive focus:border-destructive focus:ring-destructive/10"
                : "border-border focus:border-primary focus:ring-primary/10"
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
        {data.password && !passwordValid && (
          <p className="text-xs text-destructive mt-1">
            Password must be at least 8 characters.
          </p>
        )}
      </div>

      {/* Security note */}
      <div className="flex items-start gap-2.5 px-3.5 py-3 bg-muted rounded-lg text-[13px] text-muted-foreground">
        <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>Credentials are stored locally and never leave your server.</span>
      </div>
    </div>
  )
}
