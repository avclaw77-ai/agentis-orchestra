// =============================================================================
// Connector types -- shared across all connector definitions
// =============================================================================

export type ConnectorCategory = "api" | "file" | "database" | "webhook" | "communication"

export interface ConnectionField {
  key: string
  label: string
  type: "text" | "password" | "url" | "number" | "select" | "textarea"
  required: boolean
  placeholder?: string
  options?: { value: string; label: string }[] // for select type
  helpText?: string
}

export interface ConnectorDefinition {
  id: string
  name: string
  category: ConnectorCategory
  icon: string // Lucide icon name
  description: string
  longDescription: string
  model: string
  persona: string
  connectionFields: ConnectionField[]
  capabilities: ("read" | "write" | "subscribe" | "parse")[]
  tags: string[] // for search/filter in UI
}
