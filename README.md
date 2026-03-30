
```
   ██████╗██╗      █████╗ ██╗    ██╗███████╗████████╗██████╗  █████╗ ██████╗
  ██╔════╝██║     ██╔══██╗██║    ██║██╔════╝╚══██╔══╝██╔══██╗██╔══██╗██╔══██╗
  ██║     ██║     ███████║██║ █╗ ██║███████╗   ██║   ██████╔╝███████║██████╔╝
  ██║     ██║     ██╔══██║██║███╗██║╚════██║   ██║   ██╔══██╗██╔══██║██╔═══╝
  ╚██████╗███████╗██║  ██║╚███╔███╔╝███████║   ██║   ██║  ██║██║  ██║██║
   ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝
```

### Scaffold a production-ready AI agent workspace in under 2 minutes.

![npm](https://img.shields.io/npm/v/clawstrap)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![Built for](https://img.shields.io/badge/built%20for-Claude%20Code-blueviolet)

Most AI agent systems fail not because the models are bad, but because there's no foundation underneath them. Sessions die. Context vanishes between runs. Agents drift without guardrails. Quality degrades silently mid-batch. Clawstrap generates a complete, opinionated workspace that solves all of this before you write your first prompt.

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

Configuration:
  Workspace:       my-project
  Workload:        Research & Analysis
  Parallel agents: single
  Quality level:   team
  Session handoff: yes

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
│   │   └── quality-gates.md         # QC as structural gate (team/production only)
│   ├── agents/                      # (multi-agent workspaces only)
│   │   ├── primary-agent.md         # Main orchestrator definition
│   │   └── _template.md             # Template for new subagents
│   ├── skills/
│   │   └── SKILL_REGISTRY.md        # Skill index
│   ├── memory/
│   │   └── MEMORY.md                # Cross-session memory (session handoff only)
│   ├── subagent-bootstrap.md        # Lightweight ad-hoc governance (multi-agent only)
│   ├── gotcha-log.md                # Incident tracking — why rules exist
│   └── future-considerations.md     # Deferred ideas parking lot
├── projects/
│   └── _template/
│       ├── README.md                # Project metadata template
│       └── process.md               # Workflow and session checklist template
├── tmp/                             # Gitignored session workspace
├── research/                        # Reference material
├── context/                         # Session checkpoints
└── artifacts/                       # Durable output
```

Solo single-agent workspaces get a leaner structure — no agent definitions, no quality-gates rule file, no memory directory. The workspace scales with your needs.

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

## Why Clawstrap Exists

Built from real failures, not theory. After months of running AI agent workflows, the same problems kept killing projects: context lost between sessions with no recovery path, agents drifting into unsupervised work that had to be thrown away, and quality collapsing silently mid-batch because nobody was checking.

Every rule in a Clawstrap workspace exists because something went wrong without it. The governance isn't theoretical — it's scar tissue encoded as structure.

## Commands

```
clawstrap init [directory]         Scaffold a new workspace (interactive)
clawstrap init [directory] --yes   Use defaults, skip prompts
clawstrap add agent <name>         Add a new agent definition
clawstrap add skill <name>         Add a new skill with SKILL.md
clawstrap add project <name>       Add a new project with README + process.md
clawstrap status                   Show workspace configuration and structure
```

## Flags

| Flag | Description |
|------|-------------|
| `--yes`, `-y` | Skip prompts, use sensible defaults (init only) |
| `--version` | Show version |
| `--help` | Show help |

## Roadmap

| Version | Status | What |
|---------|--------|------|
| **v1.0** | Done | `init` command, 4 workspace profiles, full governance templates, `--yes` mode |
| **v1.1** | **Now** | `add agent`, `add skill`, `add project`, `status` commands |
| **v1.2** | Next | `upgrade` — merge latest templates without overwriting customizations |
| **v2.0** | Planned | Multi-model support, generic agent system scaffolding |

## Contributing

PRs welcome. Issues welcome. Stars appreciated.

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. If you've hit a failure mode that Clawstrap doesn't handle yet, open an issue — those are the most valuable contributions.

## License

[MIT](LICENSE)
