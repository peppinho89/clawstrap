# Process: [Project Name]
> Workflow, hooks, and session checklist for this project.
> Update this file as the workflow evolves.

---

## Session Start Checklist (Pre-Hooks)

Run these at the start of every session on this project:

1. [ ] Read `README.md` — confirm current status and next step
2. [ ] Read `CLAUDE.md` (auto-loaded, but confirm it's current)
3. [ ] Check `tmp/{task}/plan.md` if a batch is in progress
4. [ ] Confirm SSOT files are in expected state (no stale data)

---

## Session End Checklist (Post-Hooks)

Run these at the end of every session (mandatory — not optional):

1. [ ] Save all work to SSOT files
2. [ ] Sync derived files (regenerate from SSOTs)
3. [ ] SSOT integrity check (no duplicates, no stale data)
4. [ ] Update `README.md` → "Last done" and "Next" fields
5. [ ] Write next-session plan to `tmp/{task}/plan.md`
6. [ ] Run QC on work done this session

---

## Execution Workflow

```
1. Plan → get approval → execute
2. Batch size: [N items per batch]
3. QC gate: every 5 operations
4. Output: tmp/{task}/{name}.json
```

---

## Active Batch Tracking

| Batch | Status | QC Grade | Notes |
|-------|--------|----------|-------|
| *(none yet)* | — | — | — |

---

## Known Gotchas (Project-Specific)

*(1-2 line summaries of project-specific failure modes)*

*(None yet — add entries as issues arise)*
