# Rule: Context Discipline
> **Scope**: All sessions | **Generated**: 2026-04-08

## Flush Cadence

Flush working state to file every 5 operations:
- Write current state to a context checkpoint file
- Include: what's done, what's next, accumulated results
- Path: `context/checkpoint-{date}-{task}.md`

## Before Batch Work

Always write an execution plan to `tmp/{task}/plan.md` before starting.
This file must survive context loss and be readable by any future session.

## On User Correction

1. FIRST write the correction to its durable home (memory/rule/skill file)
2. THEN apply the correction to current work

This ensures the learning persists even if the session ends unexpectedly.
