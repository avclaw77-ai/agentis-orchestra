# Product Hunt Launch Brief

## Product Name
AgentisOrchestra

## Tagline (60 chars max)
AI agents that get better the more they work.

## Description

AgentisOrchestra is an open-source platform for running AI agent teams inside your company. Structure agents by department -- Engineering, Sales, Research, Operations -- and a CEO agent orchestrates across all of them.

**What makes it different:**

**Soul Engine** -- the only platform where agents evolve their personas through real work. A 7-step guided builder creates agent identities without prompt engineering. Embedded user feedback (thumbs, pulse checks) feeds an automated refinement engine that proposes persona improvements. Agents self-evaluate after each run. Every change is versioned and approved.

**No vendor lock-in** -- 17 models across Claude, OpenAI, Perplexity, and OpenRouter. Smart router picks the best model per task. Admin governance controls which models are available.

**One install = one company** -- Docker-first. `docker compose up` on any VPS or Mac Mini. Setup wizard takes 2 minutes.

## Topics
- Artificial Intelligence
- Open Source
- Developer Tools
- Productivity
- SaaS

## Links
- Website: https://orchestra.agentislab.ai
- GitHub: https://github.com/AgentisLab/AgentisOrchestra

## Maker Comment

We've been running AI agent teams internally for 6 months. The biggest problem wasn't building agents -- it was that they never improved after deployment.

So we built the Soul Engine: infrastructure for agent personas to evolve through actual work, user feedback, and self-evaluation. No prompt engineering required.

71% of enterprises want self-improving agents (Gartner). Nobody else ships it. We do -- open source, tested on a live VPS, 69 automated tests passing.

Built in Quebec City. English and Quebec French natively.

## First Comment (for launch day)

Hey Product Hunt! I'm Alex, founder of AgentisLab.

We built AgentisOrchestra because every agent platform we tried had the same problem: agents are exactly as good the day you deploy them as they are 6 months later. Nobody builds the feedback loop.

**The Soul Engine changes that:**
- Layer 1: Guided interviews build agent personas (no prompts)
- Layer 2: Thumbs up/down on responses feed an automated refinement engine
- Layer 3: Agents self-evaluate after each run

The result: agents that start generic and become specialists -- without anyone writing a system prompt.

We're open source (Apache 2.0), self-hosted (Docker), and multi-model (not locked to any provider).

Would love your feedback. What features would you want in an agent orchestration platform?

## Screenshots to Prepare
1. Dashboard with agent team + Soul Topology background
2. Soul Builder 7-step interview
3. Chat with feedback thumbs
4. Persona proposals with approve/reject
5. Model governance panel
6. Kanban board with drag-and-drop
