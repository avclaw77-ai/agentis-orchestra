# Connector Integration Plan

**Date**: 2026-04-16
**Status**: Planning + Phase 1 build

---

## Integration Categories

### 1. API Connectors (REST/GraphQL)

| Connector | Priority | Use Case | Auth Type |
|-----------|----------|----------|-----------|
| **Slack** | HIGH | Notifications, channel monitoring, team comms | OAuth2 / Bot Token |
| **HubSpot** | HIGH | CRM -- contacts, deals, pipeline tracking | API Key |
| **GitHub** | HIGH | Repos, PRs, issues, code search | Personal Access Token |
| **Jira** | MEDIUM | Issue tracking, sprint data, backlog | API Token + Email |
| **Google Workspace** | MEDIUM | Gmail, Calendar, Drive file access | OAuth2 / Service Account |
| **QuickBooks** | MEDIUM | Invoicing, expenses, financial reports | OAuth2 |
| **Salesforce** | LOW | Enterprise CRM (larger clients) | OAuth2 |
| **Linear** | LOW | Issue tracking (tech companies) | API Key |
| **Notion** | LOW | Knowledge base, wiki pages | API Key |

### 2. File Parsing Connectors

| Connector | Priority | Formats | Use Case |
|-----------|----------|---------|----------|
| **CSV/Excel Parser** | HIGH | .csv, .xlsx, .xls | Import spreadsheets, financial data, inventory |
| **PDF Extractor** | HIGH | .pdf | Invoices, contracts, reports, manuals |
| **JSON/XML Parser** | MEDIUM | .json, .xml | Config files, API exports, data feeds |
| **Email Parser (IMAP)** | MEDIUM | .eml, IMAP | Monitor inbox, extract attachments, auto-triage |

### 3. Database Connectors

| Connector | Priority | Type | Use Case |
|-----------|----------|------|----------|
| **PostgreSQL** | HIGH | SQL | Client's existing DB, reporting, dashboards |
| **MySQL/MariaDB** | HIGH | SQL | Legacy systems, WordPress DBs, ERP backends |
| **MongoDB** | MEDIUM | NoSQL | Document stores, product catalogs |
| **MSSQL** | LOW | SQL | Enterprise Windows environments |

### 4. Webhook Connectors (Event-driven)

| Connector | Priority | Direction | Use Case |
|-----------|----------|-----------|----------|
| **Incoming Webhook** | HIGH | External -> Orchestra | Receive events from any system |
| **Outgoing Webhook** | HIGH | Orchestra -> External | Notify external systems on events |
| **Stripe** | MEDIUM | Incoming | Payment events, subscription changes |
| **Shopify** | LOW | Incoming | Order events, inventory changes |

### 5. Communication Connectors

| Connector | Priority | Type | Use Case |
|-----------|----------|------|----------|
| **SMTP Email** | HIGH | Outbound | Send reports, alerts, summaries |
| **IMAP Email** | MEDIUM | Inbound | Monitor inbox, auto-respond |
| **Microsoft Teams** | LOW | Bidirectional | Enterprise comms |

---

## Build Priority (Phase 1 -- NOW)

### Tier A: Build immediately (most clients need these)

1. **Slack Connector** -- every company uses Slack or Teams
2. **CSV/Excel Parser** -- every department has spreadsheets
3. **PostgreSQL Connector** -- most common DB for data access
4. **SMTP Email Sender** -- agents need to send notifications
5. **Incoming Webhook** -- universal event receiver
6. **PDF Extractor** -- contracts, invoices, reports

### Tier B: Build for first client (INOGENI)

7. **HubSpot Connector** -- CRM access
8. **GitHub Connector** -- code repo access
9. **MySQL Connector** -- legacy system access

### Tier C: Build on demand

10. Everything else based on client needs

---

## Connector Architecture

Each connector is a **template** in `app/src/lib/connectors/` with:

```typescript
interface ConnectorDefinition {
  id: string                    // "slack", "csv-parser", "postgres"
  name: string                  // "Slack"
  category: "api" | "file" | "database" | "webhook" | "communication"
  icon: string                  // Lucide icon name
  description: string
  model: string                 // Default model for this connector agent
  persona: string               // System prompt for the connector agent
  connectionFields: ConnectionField[]
  capabilities: string[]        // ["read", "write", "subscribe"]
  
  // Runtime methods (executed by the bridge)
  testConnection: (config: Record<string, string>) => Promise<boolean>
  execute: (action: string, params: Record<string, unknown>, config: Record<string, string>) => Promise<unknown>
}
```

### How It Works

1. Admin creates a connector agent from the Connectors tab
2. Fills in connection details (encrypted in DB)
3. Connector agent gets a specialized persona + skills
4. Other agents delegate to the connector: "Ask the Slack connector to post in #engineering"
5. Heartbeat routines can include connector steps: "Every morning, pull yesterday's HubSpot deals"

### File Parsers -- Special Case

File parsers don't connect to external systems. Instead:
- Agent receives a file upload or path
- Parser extracts structured data
- Returns JSON that other agents can work with
- Useful in routines: "Parse the monthly report PDF and summarize it"

---

## Connector Template Structure

```
app/src/lib/connectors/
  index.ts                    # Registry + exports
  types.ts                    # Shared types
  api/
    slack.ts                  # Slack connector
    hubspot.ts                # HubSpot connector
    github.ts                 # GitHub connector
    jira.ts                   # Jira connector
  file/
    csv-excel.ts              # CSV/Excel parser
    pdf.ts                    # PDF extractor
    json-xml.ts               # JSON/XML parser
  database/
    postgres.ts               # PostgreSQL connector
    mysql.ts                  # MySQL connector
  webhook/
    incoming.ts               # Incoming webhook handler
    outgoing.ts               # Outgoing webhook sender
  communication/
    smtp.ts                   # SMTP email sender
    imap.ts                   # IMAP email monitor
```

Bridge-side execution handlers:
```
bridge/connectors/
  index.ts                    # Connector executor registry
  slack.ts                    # Slack API calls
  database.ts                 # SQL query execution
  file-parser.ts              # File parsing logic
  smtp.ts                     # SMTP send
  webhook.ts                  # Webhook dispatch
```
