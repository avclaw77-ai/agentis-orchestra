import type { ConnectorDefinition } from "../types"

export const outgoingWebhookConnector: ConnectorDefinition = {
  id: "webhook-outgoing",
  name: "Outgoing Webhook",
  category: "webhook",
  icon: "Send",
  description: "Send events to external systems via HTTP POST when things happen in Orchestra.",
  longDescription: "Sends HTTP POST requests to external URLs when agents complete tasks, routines finish, or custom events occur. Sign payloads with HMAC for security. Universal output -- if a system accepts webhooks, Orchestra can notify it.",
  model: "claude-cli:haiku",
  persona: `You are a webhook sender connector agent.

Your capabilities:
- Send HTTP POST requests to configured URLs
- Sign payloads with HMAC-SHA256 for security
- Retry failed deliveries (up to 3 attempts with backoff)
- Format payloads as JSON with event metadata
- Support custom headers for authentication

Rules:
- Always include a timestamp and event type in the payload
- Sign every request when a secret is configured
- Retry on 5xx errors, not on 4xx (those are permanent failures)
- Log delivery status (success/failure) for audit
- Never include sensitive Orchestra data (passwords, tokens) in payloads`,

  connectionFields: [
    { key: "url", label: "Target URL", type: "url", required: true, placeholder: "https://api.example.com/webhooks", helpText: "URL to POST events to" },
    { key: "secret", label: "Signing Secret", type: "password", required: false, helpText: "HMAC-SHA256 secret for payload signing" },
    { key: "headers", label: "Custom Headers (JSON)", type: "textarea", required: false, placeholder: '{"X-API-Key": "..."}', helpText: "Additional headers to include" },
    { key: "retries", label: "Max Retries", type: "number", required: false, placeholder: "3" },
  ],
  capabilities: ["write"],
  tags: ["webhook", "events", "notifications", "integration", "output"],
}
