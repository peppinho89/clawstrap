
```
   ██████╗██╗      █████╗ ██╗    ██╗███████╗████████╗██████╗  █████╗ ██████╗
  ██╔════╝██║     ██╔══██╗██║    ██║██╔════╝╚══██╔══╝██╔══██╗██╔══██╗██╔══██╗
  ██║     ██║     ███████║██║ █╗ ██║███████╗   ██║   ██████╔╝███████║██████╔╝
  ██║     ██║     ██╔══██║██║███╗██║╚════██║   ██║   ██╔══██╗██╔══██║██╔═══╝
  ╚██████╗███████╗██║  ██║╚███╔███╔╝███████║   ██║   ██║  ██║██║  ██║██║
   ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝
```

### Scaffold a production-ready AI agent workspace — then keep it sharp automatically.

![npm](https://img.shields.io/npm/v/clawstrap)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![AI Runtime](https://img.shields.io/badge/AI%20runtime-claude%20%7C%20ollama%20%7C%20codex-blueviolet)
![Adaptive Memory](https://img.shields.io/badge/adaptive%20memory-watch%20daemon-orange)

## What Is Clawstrap

Clawstrap scaffolds a complete, opinionated AI agent workspace in under 2 minutes. Run `npx clawstrap init`, answer five questions, and you get a governance-first directory: a `CLAUDE.md` master rules file loaded every session, approval-first workflow rules, quality gates, cross-session memory, subagent definitions, and a spec template — all wired together before you write your first prompt. Sessions no longer die without context. Agents no longer drift without guardrails.

The watch daemon takes it further. Run `clawstrap watch` once and it stays alive in the background, doing three things automatically: processing session summaries from `tmp/sessions/` through an LLM adapter to extract decisions, corrections, and deferred ideas — writing them to `MEMORY.md` and `gotcha-log.md`; mining your git history for co-changing file pairs, high-churn directories, and recurring commit patterns; and scanning your codebase on a configurable schedule to maintain `.claude/rules/conventions.md` with live naming, import, and error-handling patterns. Your workspace gets more accurate over time without any manual work.

Most AI workspace tools generate files and stop. Clawstrap keeps going.

## Quick Start

```bash
npx clawstrap init
```

```
$ npx clawstrap init

Welcome to Clawstrap 🔨
Scaffold a production-ready AI agent workspace.

? Workspace name: my-project

? What kind of work will this workspace handle?
● Research & analysis pipeline
○ Content & writing system
○ Data processing workflow
○ Custom / general purpose

? How many AI agents will work in parallel?
● Just me — single agent
○ Small team — 2 to 5 agents
○ Production — 5+ agents, orchestrator pattern

? What quality controls do you need?
○ Solo — lightweight checks, fast iteration
● Team — structured QC gates, review steps
○ Production — full QC pipeline, batch monitoring

? Enable session handoff checklists? (for multi-session work) Yes

? Enable Spec-Driven Development? (write specs before implementing) Yes

Configuration:
  Workspace:       my-project
  Workload:        Research & Analysis
  Parallel agents: single
  Quality level:   team
  Session handoff: yes
  Spec-driven dev: yes

Generating your workspace...

  ✓ CLAUDE.md
  ✓ GETTING_STARTED.md
  ✓ .gitignore
  ✓ .claude/rules/context-discipline.md
  ✓ .claude/rules/approval-first.md
  ✓ .claude/rules/quality-gates.md
  ✓ .claude/skills/SKILL_REGISTRY.md
  ✓ .claude/gotcha-log.md
  ✓ .claude/future-considerations.md
  ✓ projects/_template/process.md
  ✓ projects/_template/README.md
  ✓ .claude/memory/MEMORY.md
  ✓ .clawstrap.json
  ✓ tmp/
  ✓ research/
  ✓ context/
  ✓ artifacts/

Done. Open GETTING_STARTED.md to begin.
```

That's it. Your workspace is ready. Open `GETTING_STARTED.md` and start your first session.

```bash
# Then start the adaptive memory daemon:
clawstrap watch
```

## What You Get

The generated workspace adapts to your answers. Here's the full structure with everything enabled:

```
my-project/
├── CLAUDE.md                        # Master governance — loaded every session
├── GETTING_STARTED.md               # Your first session guide
├── .gitignore                       # Secrets and tmp excluded
├── .clawstrap.json                  # Your workspace configuration
├── .claude/
│   ├── rules/
│   │   ├── context-discipline.md    # Flush cadence, thin orchestrator pattern
│   │   ├── approval-first.md        # Plan → approve → execute
│   │   ├── quality-gates.md         # QC as structural gate (team/production only)
│   │   └── conventions.md           # Auto-generated by clawstrap analyze (watch only)
│   ├── agents/                      # (multi-agent workspaces only)
│   │   ├── primary-agent.md         # Main orchestrator definition
│   │   └── _template.md             # Template for new subagents
│   ├── skills/
│   │   └── SKILL_REGISTRY.md        # Skill index
│   ├── memory/
│   │   └── MEMORY.md                # Cross-session memory (session handoff only)
│   ├── commands/
│   │   └── spec.md                  # /spec slash command (SDD only)
│   ├── subagent-bootstrap.md        # Lightweight ad-hoc governance (multi-agent only)
│   ├── gotcha-log.md                # Incident tracking — why rules exist
│   └── future-considerations.md     # Deferred ideas parking lot
├── projects/
│   └── _template/
│       ├── README.md                # Project metadata template
│       └── process.md               # Workflow and session checklist template
├── specs/
│   └── _template.md                 # Spec template (SDD only)
├── tmp/                             # Gitignored session workspace
│   └── sessions/                    # Session summaries processed by watch daemon
├── research/                        # Reference material
├── context/                         # Session checkpoints
└── artifacts/                       # Durable output
```

Solo single-agent workspaces get a leaner structure — no agent definitions, no quality-gates rule file, no memory directory. The watch daemon works with any configuration.

## See the Difference

### Session continuity

**Without Clawstrap** — new day, new session, zero context:

```
You: Continue working on the API migration.
Claude: I don't have context about an API migration. Could you explain
        what you're working on, what's been done so far, and what the
        next steps are?
You: (spends 10 minutes re-explaining everything)
```

**With Clawstrap** — Claude reads `CLAUDE.md` and your progress automatically:

```
You: Continue working on the API migration.
Claude: Reading progress tracker... Last session completed endpoints for
        /users and /products. Next step from the plan: implement /orders
        endpoint with pagination. The execution plan is in
        tmp/api-migration/plan.md. Ready to proceed?
```

### Living memory across sessions

Without Clawstrap watch — corrections evaporate:

```
You (session 2): Stop using var. We use const and let everywhere.
Claude: Got it, fixing now...

You (session 3): Why are you using var again?
Claude: I apologize — I don't have context from last session.
You: (explains again)
```

With Clawstrap watch — corrections survive automatically:

```
You (session 2): Stop using var. We use const and let everywhere.
Claude: Understood. Writing session summary to tmp/sessions/...

[watch daemon detects new summary, extracts the correction,
appends to .claude/gotcha-log.md]

You (session 3): Continue the refactor.
Claude: Reading gotcha-log.md... Noted: use const/let, avoid var.
        Continuing with that convention.
```

### Subagent context control

**Without Clawstrap** — subagent dumps everything into the conversation:

```
You: Research the top 20 competitors and their pricing.
Claude: (spawns subagent, which returns 200 lines of raw data)
        Here's everything I found: [wall of text fills context window]
You: Now use that to write the report.
Claude: I'm having trouble — my context is very long. Could you
        remind me what the report should cover?
```

**With Clawstrap** — subagents write to files, return receipts:

```
You: Research the top 20 competitors and their pricing.
Claude: Launching research subagent...
        Subagent: "Done. 20 items. File: tmp/research/competitors.json.
        Summary: 20 competitors with pricing tiers, 3 flagged as
        low-confidence."
Claude: Research complete. Reading the 3 low-confidence entries for
        review before proceeding to the report.
```

## The Watch Daemon

The watch daemon is a background process that keeps your workspace's memory current without any manual work. It runs as a detached subprocess after `clawstrap watch`, survives terminal closes, and orchestrates three subsystems continuously.

**Transcript processor** — watches `tmp/sessions/` for new `.md` session summaries; when one appears, sends it to your configured LLM adapter, extracts decisions, corrections, and deferred ideas as structured JSON, and appends them to `MEMORY.md`, `gotcha-log.md`, and `future-considerations.md` respectively.

**Git observer** — on first run, reads your full commit history; on subsequent runs, reads only commits since the last processed SHA; extracts co-changing file pairs, high-churn directories, and recurring themes from commit messages; writes findings to `MEMORY.md`.

**Convention scanner** — walks the codebase on a configurable interval (default: weekly) and maintains `.claude/rules/conventions.md` with detected naming conventions, import style, test patterns, error handling approach, and comment density; preserves any sections you have manually edited.

```bash
clawstrap watch           # Start daemon (detached, persists after terminal closes)
clawstrap watch --once    # Run all observers once and exit
clawstrap watch --stop    # Stop the running daemon
clawstrap analyze         # Run convention scan immediately
```

The daemon uses an LLM to process session transcripts. Four adapters are available:

| Adapter | Requires | Notes |
|---------|----------|-------|
| `claude-local` (default) | Claude Code CLI | Uses your existing subscription, no API cost |
| `claude-api` | `ANTHROPIC_API_KEY` | Uses claude-haiku by default, configurable |
| `ollama` | Ollama running locally | Fully offline/air-gapped |
| `codex-local` | OpenAI Codex CLI | Uses your existing Codex setup |

Configure in `.clawstrap.json`:

```json
{
  "watch": {
    "adapter": "claude-local",
    "scan": { "intervalDays": 7 },
    "silent": false
  }
}
```

The daemon causes zero disruption to Claude Code sessions. It runs as a detached background process and only writes to files already managed by Clawstrap.

## Spec-Driven Development

Enable SDD mode to enforce a spec-first workflow. Before Claude implements anything, it writes a structured spec, saves it to `specs/{name}.md`, and gets your explicit approval.

```bash
npx clawstrap init --sdd
```

What you get:

- **`specs/_template.md`** — reusable spec format with problem statement, acceptance criteria, technical constraints, out-of-scope, and implementation notes
- **`.claude/rules/sdd.md`** — governance rule Claude loads every session: "Never implement from a vague prompt"
- **`.claude/commands/spec.md`** — `/spec` slash command that walks Claude through writing, saving, and presenting a spec for approval

In practice:

```
You: Build a CSV export for the orders table.

Claude: Writing spec to specs/csv-export-orders.md...

        # Spec: CSV Export — Orders Table
        Status: draft | Created: 2026-04-04

        ## Problem Statement
        Users need to export order data for reporting in external tools.

        ## Acceptance Criteria
        - [ ] Export all orders or filter by date range
        - [ ] CSV includes: order_id, customer, total, status, created_at
        - [ ] Empty state handled gracefully
        - [ ] File named orders-export-{date}.csv

        ## Technical Constraints
        - Must use existing DB connection pool
        - Must stream for large datasets (>10k rows)

        ## Out of Scope
        - PDF export
        - Scheduled exports

        Does this spec look right? Any changes before I start?

You: Looks good, go ahead.

Claude: Implementing from spec...
```

## The Five Principles

### 1. File-First Persistence

If it's not on disk, it didn't happen. Every finding, decision, and correction gets written to a durable location immediately — not at session end. Sessions are disposable. The work isn't.

### 2. Approval-First Workflow

Plan. Approve. Execute. In that order, every time. No agent acts without human sign-off. If scope changes mid-task, the agent stops and re-confirms. You stay in control.

### 3. Quality as a Structural Gate

Validation isn't optional — it's built into the workflow. Checkpoint every 5 outputs. Grade below B means stop, don't continue. Quality failures caught late cost 100% rework. Catch them early.

### 4. Governed Subagents

Every subagent gets a full definition: tools it can use, output schema, step-by-step procedure, and governance rules. No agent runs ungoverned. No "figure it out" prompts. Predictable agents ship reliable work.

### 5. Binary Decision Architecture

Complex decisions decomposed into sequential binary choices. One question at a time. Yes or no. This or that. Ambiguity kills reliability — binary decisions eliminate it.

## Working with Your Workspace

### Starting a session

Open Claude Code inside your Clawstrap workspace. That's it.

```bash
cd my-project
claude
```

Claude automatically reads `CLAUDE.md` and every file in `.claude/rules/`. The governance is active from the first message. You don't configure anything, install plugins, or write system prompts.

### Giving a task

Just describe what you want. The governance changes how Claude responds — it plans first, then asks for approval before executing.

```
You: Build a REST API for user authentication with JWT tokens.

Claude: Here's my plan:

        1. Create auth module with login/register endpoints
        2. JWT token generation and validation middleware
        3. Password hashing with bcrypt
        4. Protected route middleware
        5. Unit tests for all auth flows

        Shall I proceed with this plan?

You: Yes, go ahead.

Claude: Starting implementation...
```

### Ending and resuming sessions

When you're done for the day, tell Claude to wrap up. The session handoff checklist runs automatically:

```
You: Let's wrap up for today.

Claude: Running session handoff checklist:
        ✓ Saved all work to SSOT files
        ✓ Updated README.md status: "Last done: auth endpoints, Next: add rate limiting"
        ✓ Wrote next-session plan to tmp/auth/plan.md
        ✓ QC check: all endpoints return correct status codes

        Next session: start with rate limiting middleware.
        Plan file: tmp/auth/plan.md
```

### Delegating to subagents

When a task needs parallel work, tell Claude to delegate. The governance rules ensure subagents stay disciplined:

```
You: I need to analyze 3 competitor APIs. Delegate this to a subagent.

Claude: Launching research subagent with governance rules:
        - Output goes to tmp/competitor-analysis/results.json
        - One-line receipt on completion
        - No raw data returned to this conversation

        Subagent: "Done. 3 items. File: tmp/competitor-analysis/results.json.
        Summary: 3 APIs analyzed, 2 use REST + JWT, 1 uses GraphQL."

        Results written to file. Want me to read the findings and
        summarize, or proceed to the comparison report?
```

The main session never holds the raw subagent output. Context stays clean.

### When Claude makes a mistake

Tell Claude to correct course. The correction gets persisted before being applied — so the learning survives even if the session ends:

```
You: Don't use var for variable declarations. Always use const or let.

Claude: Writing correction to .claude/rules/context-discipline.md...
        ✓ Rule added: "Use const/let, never var"
        Now applying to current code...
```

The correction is saved to a durable rule file first, then applied. Next session, Claude follows the same rule without you repeating it.

## Commands

```
clawstrap init [directory]                  Scaffold a new workspace (interactive)
clawstrap init [directory] --yes            Use defaults, skip prompts
clawstrap init [directory] --sdd            Enable Spec-Driven Development mode
clawstrap add agent <name>                  Add a new agent definition
clawstrap add skill <name>                  Add a new skill
clawstrap add project <name>                Add a new project
clawstrap status                            Show workspace configuration and structure
clawstrap watch                             Start adaptive memory daemon
clawstrap watch --once                      Run all observers once and exit
clawstrap watch --stop                      Stop the running daemon
clawstrap watch --silent                    Start daemon without output
clawstrap analyze                           Run convention scan immediately
clawstrap export --format paperclip         Export workspace as Paperclip company template
```

## Export to Paperclip

Translate your Clawstrap workspace into a [Paperclip](https://github.com/paperclipai/paperclip) company template. Agents, governance rules, skills, and projects are mapped to Paperclip's format automatically.

```bash
clawstrap export --format paperclip --name "My Company" --mission "Ship reliable AI"
```

Generates a directory with `paperclip.manifest.json`, agent definitions with frontmatter, governance rules, and a one-command `import.sh` for Paperclip import. No running Paperclip instance required — it's a pure file transformation.

| Flag | Description |
|------|-------------|
| `--format`, `-f` | Export format (required, currently: `paperclip`) |
| `--out`, `-o` | Output directory (default: `{workspace}-paperclip/`) |
| `--name`, `-n` | Company name |
| `--mission`, `-m` | Company mission statement |
| `--adapter`, `-a` | Agent adapter type (default: `claude_local`) |

## Why Clawstrap Exists

Built from real failures, not theory. After months of running AI agent workflows, the same problems kept killing projects: context lost between sessions with no recovery path, agents drifting into unsupervised work that had to be thrown away, and quality collapsing silently mid-batch because nobody was checking.

Every rule in a Clawstrap workspace exists because something went wrong without it. The governance isn't theoretical — it's scar tissue encoded as structure.

## Roadmap

| Version | Status | What |
|---------|--------|------|
| **v1.0** | Done | `init` command, 4 workspace profiles, governance templates, `--yes` mode |
| **v1.1** | Done | `add agent/skill/project`, `status` command |
| **v1.2** | Done | `export --format paperclip` |
| **v1.3** | Done | `--sdd` flag, Spec-Driven Development mode |
| **v1.4** | Now  | `clawstrap watch` — adaptive memory daemon, `clawstrap analyze` |
| **v2.0** | Planned | Multi-model support, `upgrade` command, ClipMart publishing |

## Contributing

PRs welcome. Issues welcome. Stars appreciated.

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. If you've hit a failure mode that Clawstrap doesn't handle yet, open an issue — those are the most valuable contributions.

## License

[MIT](LICENSE)
