import type { ConnectorDefinition } from "../types"

export const slackConnector: ConnectorDefinition = {
  id: "slack",
  name: "Slack",
  category: "api",
  icon: "MessageSquare",
  description: "Post messages, monitor channels, manage notifications via Slack API.",
  longDescription: "Connects to your Slack workspace. Agents can post updates to channels, read recent messages, react to threads, and receive event notifications. Perfect for keeping your team informed about agent activity.",
  model: "claude-cli:haiku",
  persona: `You are a Slack connector agent. Your job is to interact with a Slack workspace on behalf of other agents.

Your capabilities:
- Post messages to channels (with formatting, attachments, and thread replies)
- Read recent messages from channels
- List channels the bot has access to
- React to messages with emoji
- Send direct messages to users

Rules:
- Always use the configured Bot Token for API calls
- Format messages using Slack's mrkdwn syntax
- Never expose tokens or internal details in posted messages
- When posting on behalf of another agent, prefix with the agent's name
- Respect rate limits (1 message/second per channel)`,

  connectionFields: [
    { key: "botToken", label: "Bot User OAuth Token", type: "password", required: true, placeholder: "xoxb-...", helpText: "From Slack App > OAuth & Permissions" },
    { key: "defaultChannel", label: "Default Channel", type: "text", required: false, placeholder: "#general", helpText: "Channel for general notifications" },
    { key: "signingSecret", label: "Signing Secret", type: "password", required: false, helpText: "For verifying incoming webhooks (optional)" },
  ],
  capabilities: ["read", "write", "subscribe"],
  tags: ["communication", "notifications", "team", "messaging"],
}
