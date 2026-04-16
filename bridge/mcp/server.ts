/**
 * MCP Server -- JSON-RPC 2.0 over HTTP.
 *
 * Lightweight MCP-compatible tool server that exposes AgentisOrchestra
 * capabilities to external agents and clients.
 *
 * Endpoints:
 *   POST /mcp         -- JSON-RPC 2.0 requests
 *   GET  /mcp/tools   -- list available tools
 *   GET  /mcp/health  -- server health
 */

import http from "node:http"

// =============================================================================
// Types
// =============================================================================

export interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  handler: (params: Record<string, unknown>) => Promise<unknown>
}

interface JsonRpcRequest {
  jsonrpc: "2.0"
  id: string | number | null
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcResponse {
  jsonrpc: "2.0"
  id: string | number | null
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

// =============================================================================
// MCP Server
// =============================================================================

export class MCPServer {
  private tools = new Map<string, MCPTool>()
  private server: http.Server | null = null
  private port: number

  constructor(port?: number) {
    this.port = port ?? parseInt(process.env.MCP_PORT || "3848", 10)
  }

  // ---------------------------------------------------------------------------
  // Tool registration
  // ---------------------------------------------------------------------------

  registerTool(name: string, tool: MCPTool): void {
    this.tools.set(name, tool)
  }

  registerTools(tools: MCPTool[]): void {
    for (const tool of tools) {
      this.tools.set(tool.name, tool)
    }
  }

  unregisterTool(name: string): void {
    this.tools.delete(name)
  }

  getToolCount(): number {
    return this.tools.size
  }

  // ---------------------------------------------------------------------------
  // Server lifecycle
  // ---------------------------------------------------------------------------

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        // CORS headers
        res.setHeader("Access-Control-Allow-Origin", "*")
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")

        if (req.method === "OPTIONS") {
          res.writeHead(204)
          res.end()
          return
        }

        if (req.method === "GET" && req.url === "/mcp/tools") {
          this.handleListTools(res)
          return
        }

        if (req.method === "GET" && req.url === "/mcp/health") {
          this.handleHealth(res)
          return
        }

        if (req.method === "POST" && req.url === "/mcp") {
          this.handleJsonRpc(req, res)
          return
        }

        res.writeHead(404, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ error: "Not found" }))
      })

      this.server.listen(this.port, "0.0.0.0", () => {
        console.log(`[mcp] MCP server listening on :${this.port}`)
        console.log(`[mcp] ${this.tools.size} tools registered`)
        resolve()
      })
    })
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve()
        return
      }
      this.server.close(() => {
        console.log("[mcp] MCP server stopped")
        resolve()
      })
    })
  }

  isRunning(): boolean {
    return this.server?.listening ?? false
  }

  // ---------------------------------------------------------------------------
  // Request handlers
  // ---------------------------------------------------------------------------

  private handleListTools(res: http.ServerResponse): void {
    const toolList = Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }))

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ tools: toolList }))
  }

  private handleHealth(res: http.ServerResponse): void {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(
      JSON.stringify({
        status: "ok",
        toolCount: this.tools.size,
        uptime: process.uptime(),
      })
    )
  }

  private handleJsonRpc(req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = ""
    req.on("data", (chunk) => (body += chunk))
    req.on("end", async () => {
      let rpcReq: JsonRpcRequest
      try {
        rpcReq = JSON.parse(body)
      } catch {
        this.sendJsonRpc(res, null, undefined, {
          code: -32700,
          message: "Parse error",
        })
        return
      }

      if (!rpcReq.jsonrpc || rpcReq.jsonrpc !== "2.0" || !rpcReq.method) {
        this.sendJsonRpc(res, rpcReq.id ?? null, undefined, {
          code: -32600,
          message: "Invalid request",
        })
        return
      }

      try {
        const result = await this.handleMethod(rpcReq.method, rpcReq.params || {})
        this.sendJsonRpc(res, rpcReq.id, result)
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Internal error"
        this.sendJsonRpc(res, rpcReq.id, undefined, {
          code: -32603,
          message: msg,
        })
      }
    })
  }

  // ---------------------------------------------------------------------------
  // JSON-RPC method dispatch
  // ---------------------------------------------------------------------------

  private async handleMethod(
    method: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    // MCP standard methods
    if (method === "tools/list") {
      return Array.from(this.tools.values()).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }))
    }

    if (method === "tools/call") {
      const toolName = params.name as string
      const toolParams = (params.arguments || {}) as Record<string, unknown>

      if (!toolName) {
        throw new Error("Missing tool name")
      }

      const tool = this.tools.get(toolName)
      if (!tool) {
        throw new Error(`Unknown tool: ${toolName}`)
      }

      return await tool.handler(toolParams)
    }

    if (method === "initialize") {
      return {
        protocolVersion: "2024-11-05",
        serverInfo: {
          name: "agentis-orchestra",
          version: "1.0.0",
        },
        capabilities: {
          tools: { listChanged: false },
        },
      }
    }

    if (method === "ping") {
      return { pong: true }
    }

    throw new Error(`Unknown method: ${method}`)
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private sendJsonRpc(
    res: http.ServerResponse,
    id: string | number | null,
    result?: unknown,
    error?: { code: number; message: string; data?: unknown }
  ): void {
    const response: JsonRpcResponse = { jsonrpc: "2.0", id }
    if (error) {
      response.error = error
    } else {
      response.result = result
    }
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify(response))
  }
}
