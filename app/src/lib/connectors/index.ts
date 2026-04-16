// =============================================================================
// Connector Registry -- all available connector definitions
// =============================================================================

import type { ConnectorDefinition, ConnectorCategory } from "./types"
export type { ConnectorDefinition, ConnectorCategory, ConnectionField } from "./types"

// API connectors
import { slackConnector } from "./api/slack"
import { hubspotConnector } from "./api/hubspot"
import { githubConnector } from "./api/github"

// File connectors
import { csvExcelConnector } from "./file/csv-excel"
import { pdfConnector } from "./file/pdf"

// Database connectors
import { postgresConnector } from "./database/postgres"
import { mysqlConnector } from "./database/mysql"

// Webhook connectors
import { incomingWebhookConnector } from "./webhook/incoming"
import { outgoingWebhookConnector } from "./webhook/outgoing"

// Communication connectors
import { smtpConnector } from "./communication/smtp"

// =============================================================================
// Registry
// =============================================================================

export const CONNECTOR_REGISTRY: ConnectorDefinition[] = [
  // API
  slackConnector,
  hubspotConnector,
  githubConnector,
  // File
  csvExcelConnector,
  pdfConnector,
  // Database
  postgresConnector,
  mysqlConnector,
  // Webhook
  incomingWebhookConnector,
  outgoingWebhookConnector,
  // Communication
  smtpConnector,
]

export const CONNECTOR_CATEGORIES: { key: ConnectorCategory; label: string; description: string }[] = [
  { key: "api", label: "API Integrations", description: "Connect to SaaS tools and web services" },
  { key: "file", label: "File Parsers", description: "Extract data from documents and spreadsheets" },
  { key: "database", label: "Databases", description: "Query external databases for live data" },
  { key: "webhook", label: "Webhooks", description: "Send and receive events between systems" },
  { key: "communication", label: "Communication", description: "Email, messaging, and notifications" },
]

/** Get a connector by ID */
export function getConnector(id: string): ConnectorDefinition | undefined {
  return CONNECTOR_REGISTRY.find((c) => c.id === id)
}

/** Get all connectors in a category */
export function getConnectorsByCategory(category: ConnectorCategory): ConnectorDefinition[] {
  return CONNECTOR_REGISTRY.filter((c) => c.category === category)
}

/** Search connectors by tag or name */
export function searchConnectors(query: string): ConnectorDefinition[] {
  const q = query.toLowerCase()
  return CONNECTOR_REGISTRY.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.tags.some((t) => t.includes(q))
  )
}
