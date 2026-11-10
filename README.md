# The Brain

**A local, visual control room for your AI agents — one agent per project.**

The Brain shows your agents as employees in a 3D office building: every project is a block character at a desk, projects are grouped by department on their own floor, and the shared memory (**The Brain**) lives in the tower on the roof. You type what you need in a single chat bar; a router sends it to the right project agent, the agent breaks it into concrete orders you can watch in a queue, and anything that would touch the outside world (a message, an email, a post, a payment) **waits for your approval** as a draft.

It runs entirely on your machine. Agents are powered by the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk) and can use either **your Claude subscription (Pro/Max)** or **a pay-as-you-go API key**. With neither, everything still works in a **simulated demo mode**.

> The user interface is in Spanish. Agent prompts and config fields can be written in any language.

---

## Contents

- [Features](#features)
- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Connecting Claude](#connecting-claude)
  - [Option A — Your Claude subscription (recommended for local use)](#option-a--your-claude-subscription-recommended-for-local-use)
  - [Option B — An Anthropic API key](#option-b--an-anthropic-api-key)
  - [Demo mode (no credentials)](#demo-mode-no-credentials)
- [Using The Brain](#using-the-brain)
- [Configuring your agents](#configuring-your-agents)
- [Safety model](#safety-model)
- [Privacy: what stays on your machine](#privacy-what-stays-on-your-machine)
- [Costs and usage limits](#costs-and-usage-limits)
- [Project structure](#project-structure)
- [Scripts](#scripts)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)

---

## Features

- **3D office** — a cut-away building drawn in code with Three.js (no downloaded models or textures). Each department gets a floor wing; each project is an employee with a stable look. Employees sit and type with a "…" bubble while they work, stand and wave with an amber "!" when they need your decision, and relax when free. A chief of staff in the atrium turns to whoever the router just handed work to.
- **Decide without leaving the scene** — click an employee to fly to them and open their card: what they're doing, the draft waiting for you with **Approve** / **Reject**, recent activity, the next scheduled run, a box to give them a direct order and a link to their Claude project. Filters (working / waiting for you / free) dim everyone else and step through the matching employees.
- **Approved actions** — a project can declare fixed commands in `config.json` (for example "publish today's video"). They run on the server, never by an agent, and only after you approve them.
- **Project signals** — a project can drop a small `.brain/status.json` (headline, a few numbers, a report and an image) that shows on its card, on the wall screen of its room and in the Automations tab.
- **Automations tab** — The Brain's scheduled tasks grouped by department with their last result, plus a read-only list of Claude Desktop scheduled tasks.
- **One chat bar for everything** — mention a project with `@alias` or just write; a fast model routes the message. If it affects several projects, each agent gets its own part, and they run **in parallel**. If the router isn't sure, it asks you in one line before starting anything.
- **Visible orders** — every agent publishes a plan of 2–6 concrete orders to a queue and marks each one as it progresses: *pending → in progress → done*, or *needs your approval*.
- **Human approval for anything external** — agents never send, publish or pay. They prepare the full draft and pause until you click **Approve** or **Reject**. Approving only marks the draft as ready for *you* to send.
- **Agent side panel** — open **Ver detalle** on an employee's card to see that agent's orders (with drafts), a live log of every tool it uses, its run history with results and cost, and its system prompt.
- **Full audit log** — every message, run, order and tool call is stored in a local SQLite database, including actions that were blocked.
- **A shared, persistent memory** — The Brain is a folder of markdown notes on your disk. Every agent gets the essentials when it starts and saves what it learns with `brain_write` (append or edit, never delete, with a backup of every previous version).
- **Tasks, Calendar and Brain tabs** — all orders with filters, scheduled tasks on a calendar, and a markdown explorer/editor for the shared notes.
- **Add a project by editing one file** — `config.json` defines every agent: name, color, icon, system prompt, folder, tools and model.

## How it works

```
 ┌──────────────── Browser (React + Vite) ────────────────┐
 │  Office · Tasks · Automations · Calendar · Brain        │
 │  Order queue  ·  Approve / Reject  ·  Agent panel       │
 └───────────────▲────────────────────────┬───────────────┘
                 │ WebSocket (live events) │ REST (chat, approvals)
 ┌───────────────┴────────────────────────▼───────────────┐
 │                Server (Node + Fastify)                  │
 │                                                         │
 │  Router ──► Orchestrator ──► one agent run per project  │
 │  (@mention / Claude Haiku / keywords)    (in parallel)  │
 │                                                         │
 │  Agent run = Claude Agent SDK query()                   │
 │    · project system prompt, folder, tools, model        │
 │    · MCP tools: plan_orders · update_order ·            │
 │                 request_approval (pauses for you)       │
 │    · safety guard on every tool call                    │
 │                                                         │
 │  SQLite: messages · runs · orders · logs                │
 └─────────────────────────────────────────────────────────┘
```

What happens when you send a message:

1. **Routing.** A single `@mention` is respected as-is. With several mentions, or none, Claude Haiku decides which project(s) the message belongs to and rewrites each project's part as a self-contained instruction. If it's ambiguous, you get a one-line question with a button per project.
2. **Planning.** Each selected agent starts and calls `plan_orders` to publish its plan to the queue.
3. **Execution.** The agent works through the orders with its allowed tools (read/write files in its folder, web search, etc.), calling `update_order` as it goes. Everything it does streams to the live log.
4. **Approval.** For anything external it calls `request_approval` with the complete draft. The agent pauses; the draft appears in the queue and in the agent panel (and is saved to `workspaces/<project>/borradores/`). You approve or reject, and the agent continues.
5. **Memory.** Anything worth remembering (decisions, stable facts, your preferences) is saved to The Brain with `brain_write`, so every agent knows it next time.
6. **Result.** The run ends with a short summary and its cost. Orders the agent left unfinished are marked as failed, never as done. You can stop a run at any time with **Detener** in the agent panel.

## Requirements

- **Node.js 22.13 or newer** (uses the built-in `node:sqlite`; developed on Node 24).
- Windows, macOS or Linux.
- To use real agents: a **Claude Pro or Max subscription**, *or* an **Anthropic API key**.

You don't need to install Claude Code separately: the Claude Agent SDK ships its own Claude Code binary.

## Quick start

```bash
git clone https://github.com/rnachoc/the-brain.git
cd the-brain
npm install
npm run dev
```

Open **http://localhost:5173**.

- `npm install` creates your personal **`config.json`** from `config.example.json` (five example agents).
- `npm run dev` starts the agent server on `:8787` and the web app on `:5173`.
- Without credentials you're in **demo mode** (badge *"Modo simulado"* in the top bar). Connect Claude below to use real agents.

## Connecting Claude

The Brain reads credentials from a **`.env`** file in the project root. This file is in `.gitignore` and is never committed. Start from the template:

```bash
cp .env.example .env
```

Then choose **one** of the two options. After editing `.env`, restart `npm run dev`. The top bar will show *"Claude conectado"* and the server log will say which mode is active.

### Option A — Your Claude subscription (recommended for local use)

Uses your **Claude Pro or Max plan**. There is no extra bill: usage counts against your plan's normal usage limits, the same as using Claude Code.

1. Run:

   ```bash
   npm run login
   ```

   This runs `claude setup-token` with the Claude Code binary bundled in the SDK. A browser window opens. Sign in with your Claude account and authorize it.
2. The terminal prints a long-lived token (it starts with `sk-ant-oat01-…`). Copy it into `.env`:

   ```env
   CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...
   ```

3. Restart `npm run dev`.

**Whose plan is used?** Always the plan of whoever runs the app. Your token lives only in *your* `.env`. Anyone who clones the repository must run `npm run login` with *their own* Claude account and gets *their own* token, so they use their plan, not yours. Never share your `.env` or your token. If it leaks, revoke it from your Claude account settings.

> **Personal use only.** A subscription token is meant for running the app yourself on your own machine. If you ever want to offer The Brain as a service to other people, use Option B with an API key instead.

### Option B — An Anthropic API key

Pay-as-you-go billing through the Claude Console. This is useful if you don't have a Pro/Max plan, or want separate billing and spending limits.

1. Go to **https://console.anthropic.com** and sign in.
2. Under **Billing**, add a payment method and buy credits (prepaid).
3. Under **API Keys**, click **Create Key**, name it (e.g. `the-brain`) and copy it. It starts with `sk-ant-api03-…` and is shown only once.
4. Put it in `.env`:

   ```env
   ANTHROPIC_API_KEY=sk-ant-api03-...
   ```

5. Restart `npm run dev`.

Tip: set a monthly spending limit in the Console (**Settings → Limits**).

If both variables are set, the subscription token (`CLAUDE_CODE_OAUTH_TOKEN`) takes priority.

### Demo mode (no credentials)

With an empty `.env` (or none at all), The Brain runs fully simulated. The router uses each project's `keywords`, and agents play a realistic demo: they publish orders, stream fake tool calls and ask for approval when your message implies sending something. No model is called. This is handy for trying the UI or developing it.

## Using The Brain

### Office

- The headline shows how many employees you have. Drag to orbit (within limits), scroll to zoom.
- **Click a floor** to fly to that room; its wall screen shows the project signal or the department's order counts. **Esc** or the back arrow returns to the overview.
- **Click an employee** (or their floating label) to fly to them and open their card. **Ver detalle** opens the full agent panel; **Abrir en Claude** opens the project's `claudeUrl`.
- The **por aprobar** counter in the top bar jumps to the next employee waiting for you.
- When the router isn't sure where a request goes, the chief of staff asks at the bottom of the scene with one button per employee.
- Click the **tower** to open the Brain tab.
- Without WebGL the office falls back to a plain list of employees with the same card and actions.

### Chat bar

- Type a request and press **Enter**.
- Type `@` to autocomplete a project alias, e.g. `@linkedin`. Use ↑/↓ and Tab/Enter to pick one.
- Mention several projects to run them in parallel, e.g. `@jobs reply to the recruiter and @social draft a post about it`. Each agent gets only its part.
- With no mention, the router decides. If it can't, a card asks you to pick the project.

### Order queue

- Sits above the chat. It starts folded in the Office to leave room for the scene; click it to expand. Orders needing approval are listed first.
- **Approve / Reject** buttons appear inline. Use **ver borrador** to expand the draft.
- Approving never sends anything: the draft is marked ready, and you can copy it from the agent panel. A copy is also saved in the agent's folder.

### Agent panel

- **Tareas**: orders grouped by request, with notes and drafts.
- **Log en vivo**: every action and tool call as it happens. Hover a line to see the full detail.
- **Historial**: past runs, real (`Claude`) or simulated, with progress, cost and final result.
- **+ Nueva orden** pre-fills the chat with the agent's `@alias`.

### Tabs

- **Tasks**: every order across projects, filterable by project and status.
- **Automatizaciones**: **scheduled tasks** grouped by department, with the last run and its result: create one (project, title, order, and *every day*, *weekly* on chosen days, or *once*), switch it on/off, run it now (⚡) or delete it. A master switch pauses all of them. Below them, Claude Desktop scheduled tasks (read-only, managed in the Claude app) and the latest project signals.
- **Calendar**: month view of scheduled tasks and past runs.

Scheduled tasks run on the server as if you had typed the order yourself, so they **use your Claude plan** while the app is running. Nothing is scheduled by default, occurrences missed while the server was off are not replayed, and one-off tasks switch themselves off after running.
- **Brain**: browse and edit the shared notes in `brain/`. Changes made by agents appear live, and each note shows who edited it last.

On first start The Brain creates `brain/index.md`, `perfil.md`, `decisiones.md` and one `proyectos/<id>.md` per project. Fill in **perfil.md**: every agent reads it.

## Configuring your agents

Everything about your agents lives in **`config.json`**. It's created from `config.example.json` on first install and is ignored by git, so your prompts and project details stay private. Edits are picked up without restarting the server; reload the page to see new rooms.

```json
{
  "defaults": {
    "model": "claude-sonnet-5-5",
    "routerModel": "claude-haiku-5-5",
    "tools": ["Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch"]
  },
  "projects": [
    {
      "id": "shop",
      "name": "My Online Shop",
      "aliases": ["shop", "store"],
      "color": "#22d3ee",
      "icon": "cart",
      "agents": 1,
      "folder": "workspaces/shop",
      "description": "Catalog, orders and campaigns.",
      "keywords": ["order", "product", "catalog", "shipping"],
      "tools": ["Read", "Write", "Edit", "Glob", "Grep", "WebSearch"],
      "systemPrompt": "You are the agent for the user's online shop... Never send or publish anything: leave a draft and ask for approval."
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `id` | Unique identifier (lowercase, no spaces). |
| `name` | Project name shown in the UI. |
| `live` | Optional. With Claude connected every agent is real; set `false` to keep one simulated. |
| `aliases` | What you can type after `@` in the chat. |
| `color`, `icon` | Accent color (hex, also the employee's clothes and the room rug) and icon name: `briefcase`, `store`, `rocket`, `megaphone`, `compass`, `trophy`, `headphones`, `music`, `book`, `code`, `cart`, `building`, `palette`, `pen`, `plane`, `home`, `heart`, `wallet`, `fitness`, `study`, `bot`. |
| `agents` | Number of agents counted in the top bar (visual only). |
| `folder` | The agent's working folder. It's created automatically and is the only place the agent can write. |
| `description` | One line the router uses to understand the project. |
| `keywords` | Hints for the router, and the only routing signal in demo mode. |
| `tools` | Claude Code tools the agent may use (`Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`, `WebSearch`, `WebFetch`, …). |
| `systemPrompt` | The agent's role and style. The Brain appends its own working rules (plan, progress, approvals, folders). |
| `model` | Optional per-agent model. Defaults to `defaults.model`. |
| `fallback` | `true` for the catch-all **General** agent only. It sits in the atrium. |
| `department` | Optional. Floor wing for the employee; projects with the same department share a room. Without it, the project gets a room of its own. |
| `agentName`, `role` | Optional. Employee name and job title on the card. By default a stable name is picked from the id and the role is `name`. |
| `claudeUrl` | Optional. Link to the matching project on claude.ai for **Abrir en Claude**. |
| `inheritProjectSettings` | Optional. `true` loads the `CLAUDE.md` and project settings of the agent's `folder`, for agents that work inside one of your repos. |
| `actions` | Optional. Fixed commands the server may run after your approval (see below). |

`folder` can also be an absolute path to one of your repositories. Several employees can share it. If an absolute folder doesn't exist, the run fails with a clear message instead of creating it.

An optional top-level `office` block sets the headline and the chief of staff:

```json
"office": {
  "title": "My AI office",
  "chief": { "name": "Iris", "role": "Chief of staff" },
  "claudeScheduledTasksDir": "~/.claude/scheduled-tasks"
}
```

### Approved actions

```json
"actions": [
  { "id": "publish-video", "label": "Publish today's video", "command": "npm run publish", "timeoutSec": 900 }
]
```

The command is written by you and runs in the project's `folder`. It runs in two cases, both after you approve:

- An agent asks for it with `request_approval` and the action id. The card's button then says what will happen (for example *Aprobar y publicar*). Agents can't invent ids or change the command.
- You click the action on the employee's card. That creates an order waiting for your decision, showing the exact command and folder.

Output goes to the project log line by line; the order ends as done or failed with the last lines as a note. Actions requested by a simulated agent are never executed: the log only says what would have run.

### Project signals

A project can write `<folder>/.brain/status.json`; The Brain only reads it (every minute):

```json
{
  "updatedAt": "2026-11-10T10:05:00Z",
  "headline": "Today's video is ready",
  "tone": "ok",
  "items": [{ "label": "Followers", "value": "1,240", "delta": "+18" }],
  "report": "reports/2026-11-10.md",
  "image": "out/cover.jpg"
}
```

`tone` is `ok`, `warn` or `error`; up to 6 `items`. `report` (Markdown) and `image` (jpg/png) are optional paths inside the project folder, served read-only.

To **add a project**, append an entry to `projects`. To **remove** one, delete its entry. Its past runs stay in the database.

## Safety model

The Brain is built so that agents can prepare work but never act on the outside world on their own:

- **No sending, publishing or paying.** Agents have no tool to do it. External work goes through `request_approval`, which pauses until you decide.
- **Folder sandbox.** An agent can write only inside its own `folder`, and read only its folder and `/brain`. Attempts outside are denied and logged.
- **Blocked commands.** Even when `Bash` is allowed, commands that delete files or reach the network (`rm`, `rmdir`, `del`, `Remove-Item`, `git push`, `curl`, `wget`, `ssh`, …) are blocked, and so are the commands of the project's own `actions`.
- **No secrets.** No agent can read or write `.env*` files, and Bash commands that mention them are blocked.
- **Actions only after approval.** Commands from `actions` are run by the server, with a time limit and without your Claude credentials in their environment, and only after you approve.
- **Only listed tools.** An agent gets exactly the tools in its `tools` list.
- **No inherited settings by default.** Agents don't load your personal Claude Code settings, hooks or `CLAUDE.md`. With `inheritProjectSettings` an agent loads only the project settings of its own folder.
- **Bounded runs.** Each run has a maximum number of turns.
- **Full log.** Every text the agent writes and every tool call (with its input) is stored, including denials.

## Privacy: what stays on your machine

Nothing personal is committed. These paths are git-ignored:

| Path | Contents |
| --- | --- |
| `config.json` | Your agents, prompts and project details. |
| `.env` | Your token or API key. |
| `brain/` | Shared notes the agents read and write (previous versions in `brain/.history/`). |
| `workspaces/` | Everything agents produce, including drafts. |
| `data/` | The SQLite database (messages, runs, orders, logs). |

Your prompts and the files agents read are sent to Claude to do the work, as with any Claude product. Nothing else leaves your machine.

## Costs and usage limits

- **Subscription (Option A):** no per-request charge. Runs count toward your Pro/Max usage limits. The cost shown in the agent panel is an *estimate* of the equivalent API price.
- **API key (Option B):** billed per token. Approximate prices: Claude Haiku 5.5 (router) $0.10 / $0.50, Claude Sonnet 5.5 (agents) $2 / $10, per million input / output tokens. A typical task (e.g. drafting a reply) usually costs a few cents. Each run's cost appears in the agent's history.
- **Scheduled tasks** run unattended and count like any other run. Use the master switch in **Tasks → Programadas** to pause them all.
- **Demo mode:** free.

To reduce usage, switch `defaults.model` (or a single agent's `model`) to a smaller model, or keep agents simulated by removing `"live": true`.

## Project structure

```
config.example.json   example agents (copied to config.json on install)
.env.example          credentials template (copy to .env)
scripts/
  ensure-config.mjs   creates config.json on first run
  claude-login.mjs    npm run login → claude setup-token
shared/              types and schedule rules shared by server and web
server/               Node + Fastify + WebSocket + SQLite
  src/index.ts        REST API and /ws event stream
  src/router.ts       @mentions, Claude router, keyword fallback
  src/orchestrator.ts message → parallel agent runs
  src/hq.ts           state changes, events, approval waits
  src/brain.ts        Brain notes on disk, backups, agent context
  src/db.ts           SQLite persistence
  src/scheduler.ts    runs scheduled tasks on time
  src/actions.ts      approved actions run by the server
  src/signals.ts      project signals (.brain/status.json) and their files
  src/automations.ts  read-only Claude Desktop scheduled tasks
  src/agents/
    claude.ts         real agent (Claude Agent SDK)
    tools.ts          MCP tools: plan_orders, update_order, request_approval, brain_write
    guard.ts          tool permission guard
    simulated.ts      demo agent
web/                  React + Vite + Tailwind
  src/office3d/       3D office: layout, building, rooms, characters, camera, HUD
  src/components/     top bar, chat, order queue, agent panel
  src/views/          Tasks, Automations, Calendar, Brain
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm install` | Installs dependencies and creates `config.json` if missing. |
| `npm run dev` | Starts the agent server (`:8787`) and the web app (`:5173`) with live reload. |
| `npm run login` | Gets a token for your Claude subscription (`claude setup-token`). |
| `npm run typecheck` | Type-checks the server and builds the web app. |
| `npm run build` | Production build of the web app. |

## Troubleshooting

**The page is blank on the very first load.** Vite is optimizing dependencies. Reload once.

**Top bar says "Sin conexión con el servidor".** The agent server isn't running or crashed. Check the `[server]` lines in the `npm run dev` output.

**Top bar says "Modo simulado" but I set up credentials.** Make sure the file is named exactly `.env` (in the project root, not `.env.example`), that the variable has no quotes or spaces, and that you restarted `npm run dev`.

**Runs fail with `Not logged in`, `401` or `OAuth access token is invalid`.** Your token is missing, expired or revoked. Run `npm run login` again and replace `CLAUDE_CODE_OAUTH_TOKEN` in `.env`. With an API key, check it in the Console and make sure you have credits.

**The router says "Router con Claude no disponible, uso palabras clave".** The routing call failed (usually credentials or network), so it fell back to keywords. The reason appears in the log.

**Port already in use.** Set `SERVER_PORT` in `.env` and in your shell for the web proxy, or stop the other process. The web app always uses `5173`.

**A run stays `waiting`.** It's waiting for you: approve or reject the draft in the queue. If the server restarts while a run is in progress, that run is marked as failed on the next start.

## Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| a | Isometric UI with sample data | ✅ |
| b | Server, chat, routing and a real agent | ✅ |
| c | All agents live, persistent Brain (agents read and write `/brain`), cancel runs | ✅ |
| d | Scheduled tasks and calendar backed by the server | ✅ |
| e | 3D office, departments, decisions in the scene, approved actions, signals and automations | ✅ |

