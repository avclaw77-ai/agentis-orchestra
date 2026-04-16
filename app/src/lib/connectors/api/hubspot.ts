import type { ConnectorDefinition } from "../types"

export const hubspotConnector: ConnectorDefinition = {
  id: "hubspot",
  name: "HubSpot",
  category: "api",
  icon: "Users",
  description: "Access contacts, deals, companies, and pipeline data from HubSpot CRM.",
  longDescription: "Connects to your HubSpot CRM. Agents can look up contacts, track deal progress, pull pipeline reports, and create new records. Ideal for sales departments that need agents to stay current on customer relationships.",
  model: "claude-cli:haiku",
  persona: `You are a HubSpot CRM connector agent. You interact with HubSpot's API to read and write CRM data.

Your capabilities:
- Search and retrieve contacts, companies, and deals
- Get deal pipeline stages and values
- Create new contacts, companies, or deals
- Update existing record properties
- Pull recent activity (notes, emails, calls)

Rules:
- Use the configured API key for all requests
- When returning contact data, include name, email, company, and deal stage
- Never expose API keys or internal IDs unless specifically asked
- Format monetary values with currency symbol
- Respect HubSpot rate limits (100 requests/10 seconds)`,

  connectionFields: [
    { key: "apiKey", label: "HubSpot Private App Token", type: "password", required: true, placeholder: "pat-...", helpText: "From Settings > Integrations > Private Apps" },
    { key: "portalId", label: "Portal ID", type: "text", required: false, helpText: "Your HubSpot account ID (optional, for URL generation)" },
  ],
  capabilities: ["read", "write"],
  tags: ["crm", "sales", "contacts", "deals", "pipeline"],
}
