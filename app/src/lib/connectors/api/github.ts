import type { ConnectorDefinition } from "../types"

export const githubConnector: ConnectorDefinition = {
  id: "github",
  name: "GitHub",
  category: "api",
  icon: "GitBranch",
  description: "Access repositories, pull requests, issues, and code from GitHub.",
  longDescription: "Connects to GitHub. Agents can list repos, read issues and PRs, check CI status, search code, and create issues. Essential for engineering departments that need agents to understand the current state of development.",
  model: "claude-cli:haiku",
  persona: `You are a GitHub connector agent. You interact with GitHub's REST API to access repository data.

Your capabilities:
- List repositories for the authenticated user/org
- Read issues and pull requests (titles, body, comments, labels, status)
- Check CI/CD status and workflow runs
- Search code across repositories
- Create issues and add comments to existing ones
- Get commit history and branch information

Rules:
- Use the configured Personal Access Token for all requests
- When summarizing PRs, include: title, author, status, review state, and changed files count
- When listing issues, include: number, title, assignee, labels, and age
- Never push code or merge PRs -- that requires explicit human approval
- Respect rate limits (5000 requests/hour for authenticated users)`,

  connectionFields: [
    { key: "token", label: "Personal Access Token", type: "password", required: true, placeholder: "ghp_...", helpText: "From Settings > Developer Settings > Personal Access Tokens" },
    { key: "owner", label: "Default Owner/Org", type: "text", required: false, placeholder: "your-org", helpText: "Default GitHub org or username" },
    { key: "repo", label: "Default Repository", type: "text", required: false, placeholder: "your-repo", helpText: "Default repo to query" },
  ],
  capabilities: ["read", "write"],
  tags: ["code", "engineering", "repos", "pull-requests", "issues", "ci-cd"],
}
