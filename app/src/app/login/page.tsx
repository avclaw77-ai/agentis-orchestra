"use client"

import { useState } from "react"
import { LogIn } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email, password }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Login failed")
        return
      }

      window.location.href = "/"
    } catch {
      setError("Connection failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <img src="/logo-mark.svg" alt="Orchestra" className="w-7 h-7" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-extrabold tracking-tight">
              Agentis<span className="text-primary">Orchestra</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Sign in to your workspace</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div>
            <label className="text-sm font-medium" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full bg-inset rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="admin@company.com"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full bg-inset rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Enter password"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <LogIn size={16} />
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <a
          href="https://agentislab.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-[11px] text-muted-foreground/50 hover:text-muted-foreground/70 transition-colors mt-6"
        >
          Powered by AgentisLab
        </a>
      </div>
    </div>
  )
}
