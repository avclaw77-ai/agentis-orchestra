import type { ConnectorDefinition } from "../types"

export const incomingWebhookConnector: ConnectorDefinition = {
  id: "webhook-incoming",
  name: "Incoming Webhook",
  category: "webhook",
  icon: "Webhook",
  description: "Receive events from any external system via HTTP webhooks.",
  longDescription: "Creates a webhook endpoint that external systems can POST to. When an event arrives, it triggers the assigned agent or routine. Universal integration point -- if a system can send webhooks, it can talk to Orchestra.",
  model: "claude-cli:haiku",
  persona: `You are a webhook receiver connector agent.

Your capabilities:
- Receive HTTP POST requests from external systems
- Parse JSON, form-data, and raw payloads
- Validate webhook signatures (HMAC-SHA256) when configured
- Route events to the appropriate agent or routine based on event type
- Log all received events for audit

Rules:
- Validate the webhook secret on every request if configured
- Parse the payload and extract key fields before forwarding
- For unknown event types, log and skip (don't fail)
- Include the source system and timestamp in forwarded events
- Rate limit: accept max 100 events per minute per endpoint`,

  connectionFields: [
    { key: "path", label: "Webhook Path", type: "text", required: true, placeholder: "/hooks/my-system", helpText: "URL path for this webhook endpoint" },
    { key: "secret", label: "Webhook Secret", type: "password", required: false, helpText: "HMAC-SHA256 secret for payload validation" },
    { key: "eventTypeField", label: "Event Type Field", type: "text", required: false, placeholder: "event_type", helpText: "JSON field that contains the event type" },
  ],
  capabilities: ["subscribe"],
  tags: ["webhook", "events", "integration", "universal", "triggers"],
}
