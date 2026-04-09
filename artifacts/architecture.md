# Clawstrap — System Architecture
> **Last updated**: 2026-04-10 | **Status**: active
> **TLDR**: How clawstrap works — init pipeline, watch daemon, memory systems, the feedback loop, and the design decisions behind it all.

---

## 1. What Clawstrap Is

A CLI tool that scaffolds a production-ready AI agent governance workspace in under 2 minutes, then keeps it alive with a background watch daemon that learns from every session.

**The problem it solves:** Claude Code sessions are ephemeral. Context windows compress, sessions end, corrections get forgotten. Clawstrap provides the file-backed persistence layer that makes an AI workspace durable — governance rules, structured memory, convention detection, and a feedback loop that turns mistakes into rules.

```
┌─────────────────────────────────────────────────────────────┐
│  clawstrap init                                             │
│  → Scaffolds CLAUDE.md, rules, skills, memory, agents      │
│  → Creates artifacts/, context/, research/, tmp/           │
│  → Writes .clawstrap.json workspace config                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  clawstrap watch  (foreground daemon)                       │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Git observer│  │ Transcript   │  │ Convention scan   │  │
│  │ (git log)   │  │ watcher      │  │ (periodic)        │  │
│  │ → MEMORY.md │  │ (tmp/sessions│  │ → CONVENTIONS.md  │  │
│  │             │  │  → LLM →     │  │ + arch inference  │  │
│  │             │  │  memory/     │  │   via LLM         │  │
│  │             │  │  gotcha-log  │  │                   │  │
│  │             │  │  → promote   │  │                   │  │
│  │             │  │  → rules/)   │  │                   │  │
│  └─────────────┘  └──────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Init Pipeline

`clawstrap init` renders templates from `src/templates/` using a mustache-like engine (`{%var%}`, `{%#if%}`, `{%/if%}`) into the target workspace directory.

**Key outputs:**

| File | Purpose |
|------|---------|
| `CLAUDE.md` (or custom) | Master governance, loaded every session |
| `.claude/rules/*.md` | Domain rules auto-loaded every session |
| `.claude/skills/SKILL_REGISTRY.md` | Skill index with trigger phrases |
| `.claude/agents/` | Optional agent definitions |
| `.claude/memory/MEMORY.md` | Watch daemon memory index |
| `.claude/gotcha-log.md` | Incident log |
| `.claude/future-considerations.md` | Deferred ideas |
| `projects/_template/` | Sub-project template |
| `artifacts/`, `context/`, `research/` | Working directories (empty, gitkeep) |
| `tmp/` | Gitignored temp + session summaries |
| `.clawstrap.json` | Workspace config (version, profile, watch settings) |

**Workload profiles:** `research`, `content`, `data-processing`, `custom` — each enables different conditional blocks in the governance template (subagent rules, quality gates, etc.).

---

## 3. Watch Daemon

`clawstrap watch` runs in the **foreground** (since v1.5.0). Use `--silent` for CI/process managers. Use `--once` to run all observers once and exit.

### 3.1 Git Observer

Reads `git log` incrementally from `watchState.lastGitCommit`. Writes commit messages and diffs as entries to `.claude/memory/MEMORY.md` using the `---` delimiter format. Runs at startup and polls every N minutes (default: 5, configurable via `watch.git.pollIntervalMinutes`). In-memory `lastGitCommit` prevents re-processing; a concurrency guard prevents overlapping ticks.

### 3.2 Transcript Watcher

Watches `tmp/sessions/*.md` for new session summary files. When a file appears:

1. Sends to LLM adapter
2. Extracts: `decisions[]`, `corrections[]`, `deferredIdeas[]`, `openThreads[]`
3. Writes decisions → `.claude/memory/MEMORY.md` (with Jaccard dedup)
4. Writes corrections → `.claude/gotcha-log.md`
5. Writes deferred ideas → `.claude/future-considerations.md`
6. Writes open threads → `.claude/open-threads.md`
7. Runs correction promotion check (see §3.5)
8. Increments `entriesSinceLastSynthesis` by actual writes (not attempted)
9. Optionally triggers memory synthesis (see §3.4)

Session summaries are written by Claude at session end via the `<!-- CLAWSTRAP:WATCH -->` hook injected into CLAUDE.md when the daemon starts.

### 3.3 Convention Scanner

Runs on startup if overdue, then periodically (default: every 7 days). Scans source files for naming conventions, import patterns, error handling, and testing patterns. Writes to `CONVENTIONS.md` between `<!-- CLAWSTRAP:AUTO -->` / `<!-- CLAWSTRAP:END -->` sentinel markers.

If an LLM adapter is configured, also runs **architecture inference** (`src/watch/infer.ts`): samples up to 10 recently-changed source files via `git log`, sends to adapter, filters response to `Always/Never/When` rules, writes a `## Architecture & Design Patterns` section.

### 3.4 Memory Synthesis

When `watch.synthesis.enabled: true` and `entriesSinceLastSynthesis >= triggerEveryN` (default: 10), calls the adapter to synthesize a `## Living Summary` block. Written between `<!-- CLAWSTRAP:SYNTHESIS:START -->` / `<!-- CLAWSTRAP:SYNTHESIS:END -->` sentinels at the top of `.claude/memory/MEMORY.md`. Incremental: passes the existing summary to the adapter on subsequent runs.

### 3.5 Correction Promotion

After every `appendToGotchaLog` call, `checkAndPromoteCorrections` runs. Groups gotcha-log entries by Jaccard similarity (threshold: 0.65, min group: 3). For groups not already promoted, calls the adapter to synthesize a draft governance rule. Writes to `.claude/rules/{slug}-auto.md` with `status: pending-review`. Appends a MEMORY.md entry. `clawstrap status` shows pending rule count.

---

## 4. Adapter Layer

All LLM calls go through a single `Adapter` interface (`src/watch/adapters/index.ts`):

```typescript
interface Adapter {
  complete(prompt: string): Promise<string>
}
```

Available adapters: `claude-local` (Claude Code CLI), `claude-api` (Anthropic API), `openai`.

In the daemon, the adapter is wrapped with `serializedAdapter()` before being passed to subsystems — this chains all `complete()` calls via a promise queue, preventing concurrent API calls from transcript processing, synthesis, inference, and promotion firing simultaneously.

---

## 5. Memory Systems

Two memory systems coexist, serving different purposes:

| System | Location | Written by | Read by |
|--------|----------|-----------|---------|
| **Workspace memory** | `.claude/memory/MEMORY.md` | Watch daemon | Claude on demand |
| **Auto-memory** | `~/.claude/projects/.../memory/` | Claude Code (built-in) | Claude every session |

Workspace memory is structured governance learning from sessions. Auto-memory is Claude Code's operational project state across conversations. Do not conflate them.

**Entry format** in workspace memory (`.claude/memory/MEMORY.md`):
```
---
[source] ISO-timestamp
Entry text
```

Deduplication via Jaccard similarity (threshold: 0.75) prevents near-duplicate entries.

---

## 6. The Full Feedback Loop

```
Session ends
    │
    ▼
Claude writes tmp/sessions/YYYY-MM-DD-HHmm.md
    │
    ▼
Watch daemon picks up file
    │
    ├─→ decisions → .claude/memory/MEMORY.md
    ├─→ corrections → .claude/gotcha-log.md
    ├─→ deferred ideas → .claude/future-considerations.md
    └─→ open threads → .claude/open-threads.md
              │
              ▼
        checkAndPromoteCorrections()
              │
        3+ similar corrections?
              │
              ▼
        LLM synthesizes draft rule
              │
              ▼
        .claude/rules/{slug}-auto.md  (status: pending-review)
              │
              ▼
        Human reviews, removes pending-review flag
              │
              ▼
        Rule loaded every session → prevents recurrence
```

This is the core loop the system is designed around: **mistake → correction → pattern → rule → prevention.**

---

## 7. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Foreground daemon (v1.5.0)** | Background subprocess had no output; users couldn't tell if it was working. Foreground + rich UI makes the daemon feel real. `--silent` for CI. |
| **Sentinel markers** (`<!-- CLAWSTRAP:X -->`) | Allows watch daemon to update specific sections of CLAUDE.md and MEMORY.md without clobbering user-written content. |
| **Jaccard dedup (0.75 threshold)** | Near-duplicate memory entries accumulate fast. Jaccard on word tokens is cheap and catches paraphrased duplicates without LLM calls. |
| **Serialized LLM queue** | Transcript processing, synthesis, infer, and promotion can all fire within the same daemon tick. Concurrent API calls waste money and hit rate limits. A promise chain costs nothing. |
| **Shared stopwords** (`src/watch/stopwords.ts`) | `git.ts` and `promote.ts` both tokenize text. One canonical set prevents drift. |
| **`appendToMemory` returns write count** | The synthesis counter must increment by entries *actually written* (post-dedup), not entries attempted. `void` return would require re-reading the file to count. |
| **`z.coerce.number()` in schema** | `updateWatchState` writes all values as strings (JSON stringify). `z.number()` would reject `"5"` on daemon restart. `z.coerce.number()` accepts both. |
| **MIN_FILES=3 guard in infer.ts** | Inference on 1–2 files produces generic rules, not codebase-specific ones. 3 files is the minimum for meaningful patterns. |
| **`status: pending-review` flag** | Auto-promoted rules are drafts. Humans must review and remove the flag to activate. Prevents garbage rules from loading silently. |

---

## 8. File Map

```
clawstrap/
├── CLAUDE.md                          # Master governance (always loaded)
├── CONVENTIONS.md                     # Auto-generated by watch scanner
├── .clawstrap.json                    # Workspace config + watchState
│
├── src/
│   ├── index.ts                       # CLI entry point (commander)
│   ├── init.ts                        # `clawstrap init` command
│   ├── watch.ts                       # `clawstrap watch` command
│   ├── status.ts                      # `clawstrap status` command
│   ├── schema.ts                      # Zod schema for .clawstrap.json
│   ├── load-workspace.ts              # Config loader
│   ├── scaffold/                      # Init scaffold logic
│   ├── templates/                     # Template files for init
│   └── watch/
│       ├── daemon.ts                  # Main daemon loop
│       ├── ui.ts                      # WatchUI interface + RichUI/SilentUI
│       ├── git.ts                     # Git observer
│       ├── scan.ts                    # Convention scanner
│       ├── transcripts.ts             # Session transcript watcher
│       ├── synthesize.ts              # Memory synthesis
│       ├── infer.ts                   # Architecture inference
│       ├── promote.ts                 # Correction → rule promotion
│       ├── writers.ts                 # appendToMemory, appendToGotchaLog, etc.
│       ├── dedup.ts                   # Jaccard similarity + parseMemoryEntries
│       ├── stopwords.ts               # Shared stopword set
│       ├── pid.ts                     # Daemon PID management
│       └── adapters/                  # LLM adapter implementations
│
├── artifacts/
│   └── architecture.md               # THIS FILE — living system doc
├── context/                           # Execution plans + checkpoints (gitignored)
├── research/                          # Reference material (gitignored)
├── projects/
│   └── _template/                    # Sub-project template
├── specs/                             # SDD spec files
├── tests/                             # Vitest test suites
└── tmp/                               # Subagent output + sessions (gitignored)
    └── sessions/                      # Session summaries (watched by daemon)
```
