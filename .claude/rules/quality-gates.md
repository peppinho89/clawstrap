# Rule: Quality Gates
> **Scope**: All sessions | **Generated**: 2026-04-08

## Core Principle

Quality is a structural gate in the execution loop, not a phase run at the end.

## Gates

### Write-Time Validation
- Validate schema/structure on every file write
- Malformed output is caught immediately, not discovered later

### Checkpoint Reviews (Ralph Loop)
- Every 5 outputs: stop and review the most complex item in the batch
- If quality grade is below B: fix the issue and rerun before proceeding
- This is mandatory — not optional, not skippable

### Human Review
- Human review is the final gate — all results surface to the user
- No output is marked "complete" without human confirmation
- Low-confidence results must be flagged, never silently passed through
