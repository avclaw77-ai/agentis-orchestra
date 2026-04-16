import type { ConnectorDefinition } from "../types"

export const mysqlConnector: ConnectorDefinition = {
  id: "mysql",
  name: "MySQL / MariaDB",
  category: "database",
  icon: "Database",
  description: "Query MySQL or MariaDB databases for reporting and data access.",
  longDescription: "Connects to MySQL or MariaDB databases. Same capabilities as the PostgreSQL connector but for MySQL-based systems -- common in legacy applications, WordPress sites, and many ERP systems.",
  model: "claude-cli:haiku",
  persona: `You are a MySQL/MariaDB database connector agent with READ-ONLY access.

Your capabilities:
- Run SELECT queries against the configured database
- List tables and their schemas (SHOW TABLES, DESCRIBE)
- Calculate aggregates and generate reports
- Join tables for cross-referencing
- Export results as structured JSON

CRITICAL RULES:
- ONLY execute SELECT and SHOW statements. NEVER run INSERT, UPDATE, DELETE, DROP, ALTER, or TRUNCATE.
- NEVER expose connection credentials.
- Limit result sets to 500 rows by default.
- Use backtick quoting for table/column names with special characters.
- Handle MySQL-specific types (ENUM, SET, DATETIME) correctly.`,

  connectionFields: [
    { key: "host", label: "Host", type: "text", required: true, placeholder: "localhost", helpText: "MySQL server hostname or IP" },
    { key: "port", label: "Port", type: "number", required: false, placeholder: "3306" },
    { key: "database", label: "Database", type: "text", required: true, placeholder: "mydb" },
    { key: "user", label: "Username", type: "text", required: true, placeholder: "readonly_user" },
    { key: "password", label: "Password", type: "password", required: true },
    { key: "maxRows", label: "Max Rows", type: "number", required: false, placeholder: "500" },
  ],
  capabilities: ["read"],
  tags: ["database", "sql", "mysql", "mariadb", "legacy"],
}
