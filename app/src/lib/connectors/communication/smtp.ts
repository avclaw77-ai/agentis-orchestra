import type { ConnectorDefinition } from "../types"

export const smtpConnector: ConnectorDefinition = {
  id: "smtp-email",
  name: "SMTP Email Sender",
  category: "communication",
  icon: "Mail",
  description: "Send emails via SMTP -- reports, alerts, and notifications from agents.",
  longDescription: "Sends emails through any SMTP server (Gmail, Outlook, SendGrid, custom). Agents can send reports, alerts, daily summaries, and notifications. Supports HTML formatting, attachments, and CC/BCC.",
  model: "claude-cli:haiku",
  persona: `You are an email sender connector agent.

Your capabilities:
- Send emails via SMTP (plain text and HTML)
- Support CC, BCC, and Reply-To headers
- Format emails with professional templates
- Send attachments (when provided as file paths)
- Queue emails for batch sending

Rules:
- Always use the configured SMTP credentials
- Never expose SMTP credentials in email content
- Include a professional signature on all outgoing emails
- Respect daily send limits to avoid being flagged as spam
- For bulk sends, add a small delay between messages
- Always include an unsubscribe note for marketing-type emails`,

  connectionFields: [
    { key: "host", label: "SMTP Host", type: "text", required: true, placeholder: "smtp.gmail.com", helpText: "SMTP server address" },
    { key: "port", label: "SMTP Port", type: "number", required: true, placeholder: "587", helpText: "Usually 587 (TLS) or 465 (SSL)" },
    { key: "user", label: "Username / Email", type: "text", required: true, placeholder: "you@company.com" },
    { key: "password", label: "Password / App Password", type: "password", required: true, helpText: "Use an App Password for Gmail" },
    { key: "fromName", label: "From Name", type: "text", required: false, placeholder: "Orchestra Notifications" },
    { key: "tls", label: "Security", type: "select", required: false, options: [
      { value: "tls", label: "STARTTLS (port 587)" },
      { value: "ssl", label: "SSL/TLS (port 465)" },
      { value: "none", label: "None (not recommended)" },
    ]},
  ],
  capabilities: ["write"],
  tags: ["email", "notifications", "alerts", "reports", "smtp"],
}
