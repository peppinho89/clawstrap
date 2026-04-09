# Rule: Context Discipline
> **Scope**: All sessions | **Generated**: 2026-04-08

## Flush Cadence

Flush working state to file every 5 operations:
- Write current state to a context checkpoint file
- Include: what's done, what's next, accumulated results
- Path: `context/checkpoint-{YYYY-MM-DD}-{task-slug}.md`

## Before Batch Work

Always write an execution plan before starting batch work:
- Path: `context/plan-{YYYY-MM-DD}-{task-slug}.md`
- This file must survive context loss and be readable by any future session.

Subagent output goes to `tmp/{task}/` — not `context/`.

## Session Handoff

Next-session plan goes to `context/next-session.md` (overwrite each time).
QC results go to `context/qc-{YYYY-MM-DD}.md`.

## On User Correction

1. FIRST write the correction to its durable home (memory/rule/skill file)
2. THEN apply the correction to current work

This ensures the learning persists even if the session ends unexpectedly.
