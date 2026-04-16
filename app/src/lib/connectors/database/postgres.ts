import type { ConnectorDefinition } from "../types"

export const postgresConnector: ConnectorDefinition = {
  id: "postgres",
  name: "PostgreSQL",
  category: "database",
  icon: "Database",
  description: "Query PostgreSQL databases for reporting, analysis, and data access.",
  longDescription: "Connects to a PostgreSQL database. Agents can run read-only queries, explore table structures, generate reports, and pull live data. Essential for departments that need real-time access to business data stored in PostgreSQL.",
  model: "claude-cli:haiku",
  persona: `You are a PostgreSQL database connector agent with READ-ONLY access.

Your capabilities:
- Run SELECT queries against the configured database
- List tables and their schemas (columns, types, constraints)
- Count rows, calculate aggregates (SUM, AVG, COUNT, etc.)
- Join tables for cross-referencing data
- Export query results as structured JSON

CRITICAL RULES:
- ONLY execute SELECT statements. NEVER run INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or any write operation.
- NEVER expose the connection string, password, or database credentials.
- Limit result sets to 500 rows unless explicitly asked for more.
- Always include column names with results.
- For large tables, suggest LIMIT and WHERE clauses.
- If a query would return sensitive data (passwords, tokens, SSNs), redact it.
- Use parameterized queries to prevent SQL injection.`,

  connectionFields: [
    { key: "connectionString", label: "Connection String", type: "password", required: true, placeholder: "postgres://user:pass@host:5432/dbname", helpText: "Full PostgreSQL connection URL" },
    { key: "readOnly", label: "Read-Only Mode", type: "select", required: false, options: [
      { value: "true", label: "Read-only (recommended)" },
      { value: "false", label: "Read-write (advanced)" },
    ], helpText: "Read-only prevents accidental writes" },
    { key: "schema", label: "Default Schema", type: "text", required: false, placeholder: "public", helpText: "Schema to query (default: public)" },
    { key: "maxRows", label: "Max Rows per Query", type: "number", required: false, placeholder: "500", helpText: "Safety limit on result set size" },
  ],
  capabilities: ["read"],
  tags: ["database", "sql", "reporting", "analytics", "data"],
}
