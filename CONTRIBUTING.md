# Contributing to AgentisOrchestra

We welcome contributions. Here's how to get started.

## Local Development Setup

### Prerequisites

- Node.js 22+
- pnpm 9+
- Docker and Docker Compose V2

### Getting running

```bash
git clone https://github.com/AgentisLab/agentis-orchestra.git
cd agentis-orchestra

# Start the database
docker compose up db -d

# App (Next.js)
cd app
pnpm install
cp ../.env.example ../.env   # if not already done
pnpm dev                     # http://localhost:3000

# Bridge (in another terminal)
cd bridge
pnpm install
pnpm dev                     # http://localhost:3847
```

Or run everything via Docker:

```bash
make setup
make up
```

## Project Structure

```
agentis-orchestra/
  app/                      # Next.js 15 frontend + API routes
    src/
      app/                  # Next.js App Router pages and API routes
        api/                # REST API endpoints
        setup/              # Setup wizard UI
        login/              # Auth page
      components/           # React components (shadcn/ui based)
      db/                   # Drizzle ORM schema and connection
      lib/                  # Shared utilities, constants, crypto
      types/                # TypeScript type definitions
    Dockerfile
    package.json

  bridge/                   # Agent execution engine
    server.ts               # Express server entry point
    router.ts               # Model router (CLI, SDK, OpenRouter, etc.)
    heartbeat.ts            # Autonomous agent heartbeat engine
    routine-engine.ts       # Scheduled routine execution
    scheduler.ts            # Cron job scheduler
    session-manager.ts      # Agent session lifecycle
    cost-tracker.ts         # Token/cost tracking
    providers.ts            # Model provider definitions
    webhook-handler.ts      # Webhook processing
    models.ts               # Model catalog
    db.ts                   # Database connection
    mcp/                    # MCP server (Model Context Protocol)
    plugins/                # Plugin loader
    Dockerfile
    package.json

  plugins/                  # Plugin directory (Worker-isolated)
  scripts/                  # Ops scripts (setup, backup, healthcheck)
  docs/                     # Documentation
  docker-compose.yml        # Development compose
  docker-compose.prod.yml   # Production compose
  Makefile                  # Common commands
```

## How to Add a New API Route

API routes live in `app/src/app/api/`. Follow the Next.js App Router convention.

### Example: Adding a `/api/notifications` endpoint

1. Create the route file:

```typescript
// app/src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"

export async function GET(req: NextRequest) {
  // Query the database
  const notifications = await db.query.notifications.findMany()
  return NextResponse.json(notifications)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  // Validate and insert
  return NextResponse.json({ ok: true }, { status: 201 })
}
```

2. If you need a new database table, add it to `app/src/db/schema.ts` using Drizzle ORM.

3. Run the migration: `make db-push`

## How to Add a New UI Component

Components use React 19, Tailwind CSS 4, and shadcn/ui.

1. Add your component in `app/src/components/`:

```typescript
// app/src/components/notification-feed.tsx
"use client"

import { useState, useEffect } from "react"

export function NotificationFeed() {
  const [items, setItems] = useState([])

  useEffect(() => {
    fetch("/api/notifications").then(r => r.json()).then(setItems)
  }, [])

  return (
    <div className="space-y-2">
      {items.map(n => (
        <div key={n.id} className="p-3 rounded-lg border">
          {n.message}
        </div>
      ))}
    </div>
  )
}
```

2. Import and use it in a page or the shell component.

3. Use CSS variables for colors (defined in `globals.css`), never hardcoded values.

## How to Create a Plugin

Plugins extend the bridge with custom tools, scheduled jobs, and model adapters.

1. Create a directory under `plugins/`:

```
plugins/my-plugin/
  manifest.json
  index.js
```

2. Define the manifest:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "apiVersion": 1,
  "description": "What this plugin does",
  "capabilities": ["tools"],
  "tools": [
    {
      "name": "my_tool",
      "description": "What the tool does",
      "inputSchema": {
        "type": "object",
        "properties": {
          "input": { "type": "string" }
        },
        "required": ["input"]
      }
    }
  ]
}
```

3. Implement the tool:

```js
export const tools = {
  my_tool: async (params) => {
    return { result: "done" }
  }
}
```

4. Restart the bridge. The plugin loads automatically and tools are available via MCP at `http://localhost:3848/mcp/tools`.

See `plugins/README.md` for the full plugin API.

## Pull Request Process

1. Fork the repo and create a branch from `main`.
2. Make your changes. Follow existing code style and conventions.
3. Ensure linting passes: `cd app && pnpm lint`
4. Ensure type checking passes: `cd app && pnpm exec tsc --noEmit` and `cd bridge && pnpm exec tsc --noEmit`
5. Test your changes with Docker: `docker compose build`
6. Write a clear PR description explaining what changed and why.
7. Submit the PR against `main`.

### Conventions

- **pnpm** as package manager (not npm or yarn)
- **Drizzle ORM** for all database access
- **TypeScript** for all new code
- Design tokens via CSS variables, never hardcoded colors
- Components go in `app/src/components/`
- API routes go in `app/src/app/api/`
- Light theme only for the UI
- Bilingual support: EN/FR (Quebec French)

### What makes a good PR

- Focused scope (one feature or fix per PR)
- Clear description of the "why"
- No unrelated changes
- Passes CI checks
