# AgentisOrchestra Plugins

Plugins extend AgentisOrchestra with custom tools, scheduled jobs, and model adapters. Each plugin runs in an isolated Worker thread for safety.

## Plugin Structure

```
plugins/
  my-plugin/
    manifest.json    # Required: plugin metadata and tool/job definitions
    index.js         # Required: plugin entry point (or set "main" in manifest)
    package.json     # Optional: if the plugin has npm dependencies
```

## manifest.json

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "apiVersion": 1,
  "description": "What this plugin does",
  "author": "Your Name",
  "capabilities": ["tools"],
  "tools": [
    {
      "name": "my_tool",
      "description": "What the tool does",
      "inputSchema": {
        "type": "object",
        "properties": {
          "input": { "type": "string", "description": "Tool input" }
        },
        "required": ["input"]
      }
    }
  ],
  "jobs": [
    {
      "key": "daily_check",
      "schedule": "0 9 * * *",
      "description": "Runs every day at 9 AM"
    }
  ]
}
```

## Capabilities

| Capability | Description |
|------------|-------------|
| `tools`    | Exposes tools via MCP (JSON-RPC 2.0). Tools are namespaced as `plugin-name:tool-name`. |
| `jobs`     | Scheduled tasks that run on cron expressions. |
| `adapter`  | Custom model provider adapter for the model router. |

## Entry Point (index.js)

Your plugin module can export:

```js
// Optional: called when the plugin is loaded
export async function initialize(ctx) {
  // ctx.logger -- structured logger (info, warn, error)
  // ctx.config -- plugin-specific configuration
}

// Option A: export a tools object with handler functions
export const tools = {
  my_tool: async (params) => {
    // params matches the inputSchema
    return { result: "done" }
  }
}

// Option B: export a getTools function
export function getTools() {
  return [
    {
      name: "my_tool",
      handler: async (params) => ({ result: "done" })
    }
  ]
}

// Optional: called on graceful shutdown
export function shutdown() {
  // cleanup resources
}
```

## How to Install

1. Create a directory under `plugins/` with a `manifest.json` and entry point
2. Restart the bridge (or it will be picked up on next boot)
3. Plugin tools appear in the MCP server at `http://localhost:3848/mcp/tools`
4. Tools are namespaced: `my-plugin:my_tool`

## Worker Isolation

Each plugin runs in a Node.js Worker thread. This means:

- Plugins cannot crash the main bridge process
- Plugins have their own memory space
- Communication uses JSON-RPC 2.0 over postMessage

If a plugin crashes, the bridge will restart it with exponential backoff (1s, 2s, 4s, 8s... up to 5 minutes). After 10 consecutive crashes, the plugin is marked as errored and stops retrying.

## Environment

Plugins run in the same Node.js version as the bridge. They can import npm packages if installed in their own directory.
