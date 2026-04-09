# CLAUDE.md — Master Governance Rules
> **Workspace**: clawstrap | **Generated**: 2026-04-08 | **Status**: active
> Loaded every session. Keep lean. Move details to skills or rules files.

---

## Workflow Rules

**Approval-first, always.**
Plan work and get explicit approval before executing. No speculative actions.
If scope changes mid-task, pause and re-confirm.

**If it's not on disk, it didn't happen.**
Save findings immediately, not at session end. Flush every 5 operations.
Write corrections to durable locations before applying them.

**Quality > context cleanliness > speed > token cost.**
Quality failures require full rework (100% waste). Never trade quality for tokens.

---

## Persistence Hierarchy

From most ephemeral to most durable:

| Layer | Location | Loaded When |
|-------|----------|-------------|
| Conversation | (in-context) | Always — volatile |
| Temp files | `tmp/` | Per-task, gitignored |
| Memory | `.claude/memory/` | On demand |
| Skills | `.claude/skills/*/SKILL.md` | When triggered |
| Rules | `.claude/rules/*.md` | Every session |
| **CLAUDE.md** | `./CLAUDE.md` | **Every session** |

---

## Directory Map

| Directory | Purpose | When Claude writes here |
|-----------|---------|------------------------|
| `artifacts/` | Architecture docs, ADRs, system overviews | After major design decisions; `artifacts/architecture.md` is the living system doc |
| `context/` | Execution plans and session checkpoints | Before batch work → `context/plan-{date}-{task}.md`; every 5 ops → `context/checkpoint-{date}-{task}.md`; wrap-up → `context/next-session.md` |
| `projects/` | Active sub-projects (copy `projects/_template/`) | When a feature track needs its own `process.md` |
| `research/` | Reference material from external sources | When reading specs, docs, or papers worth keeping |
| `tmp/` | Subagent output, session summaries (gitignored) | Summaries → `tmp/sessions/YYYY-MM-DD-HHmm.md`; subagent output → `tmp/{task}/` |
| `.claude/memory/` | LLM-processed governance (fed by watch daemon) | Do not write directly — watch daemon only |

---

## Context Discipline

- Flush working state to file every 5 operations
- Before batch work: write execution plan to file (survives context loss)

---

## Session Handoff Checklist

Run this at every session end (mandatory, not optional):

1. Save all work to SSOT files
2. Sync derived files (rebuild from SSOTs)
3. SSOT integrity check (no duplicates, no stale data)
4. Update progress tracker → `context/progress-{date}.md`
5. Write next-session plan → `context/next-session.md`
6. Launch QC on work done this session → write results to `context/qc-{date}.md`

---

## Security Rules

- Never read `.env` files or echo credentials
- Never install third-party MCP servers/plugins without explicit approval
- Never write outside this workspace root — use project-local `tmp/`, not system `/tmp/`
- Approved tools only — ask before using new tools/APIs

---

## Quality Rules

- QC is a structural gate, not an optional post-step
- Run QC checkpoints at regular intervals during batch work
- All results must be reviewed before being marked complete

---

## Pointers to Other Layers

- Rules: `.claude/rules/` — domain-specific rules loaded every session
- Skills: `.claude/skills/SKILL_REGISTRY.md` — index of all skills
- Gotchas: `.claude/gotcha-log.md` — incident log (why rules exist)
- Future: `.claude/future-considerations.md` — deferred ideas

---

## Spec-Driven Development

This workspace uses SDD. Before implementing any feature:

1. Write a spec → `specs/{name}.md` (use `/spec` or copy `specs/_template.md`)
2. Get explicit user approval
3. Implement from the approved spec — not from the conversation

Rule details: `.claude/rules/sdd.md`

<!-- CLAWSTRAP:WATCH -->
## Session Watch Hook

`clawstrap watch` is active. At every session end, write a session summary to
`tmp/sessions/YYYY-MM-DD-HHmm.md` using this format:

```
## Decisions
- [what approach was chosen and why]

## Corrections
- [what the agent got wrong and how it was fixed]

## Deferred Ideas
- [mentioned but not acted on]

## Open Threads
- [unresolved questions or next steps]
```

The watch daemon picks this up automatically and updates MEMORY.md and gotcha-log.md.
