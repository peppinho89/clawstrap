# Spec: Auto-promote recurring corrections to rule files
> **Status**: approved | **Created**: 2026-04-09 | **Workspace**: clawstrap

---

## Problem Statement

The feedback loop in Clawstrap is open at the corrections stage. Session summaries → corrections extracted → appended to `gotcha-log.md`. But nothing ever converts those corrections into structured governance rules in `.claude/rules/`. A log entry is much weaker than a dedicated rule file — it lacks a principle statement, specific imperatives, and a name Claude can reference.

---

## Acceptance Criteria

- [ ] After every `appendToGotchaLog` call (in the daemon transcript callback), `checkAndPromoteCorrections` runs
- [ ] Groups of 3+ corrections with Jaccard similarity ≥ 0.65 trigger promotion
- [ ] Groups whose rule file (`{slug}-auto.md`) already exists are skipped
- [ ] Each promotable group is sent to the LLM adapter → returns title, principle, imperatives
- [ ] Rule file written to `.claude/rules/{slug}-auto.md` with `status: pending-review` frontmatter
- [ ] A MEMORY.md entry is appended noting the promotion
- [ ] `ui.promoteStart()` / `ui.promoteDone(count)` emitted around the operation
- [ ] `clawstrap status` shows `Pending rules: N` when N > 0
- [ ] Skipped silently if no adapter configured
- [ ] Returns `[]` / no-ops on any failure (never crashes daemon)
- [ ] Tests cover grouping logic, slug derivation, adapter call, file write, skip-if-exists, no-adapter guard

---

## Technical Constraints

- New file: `src/watch/promote.ts`
- Modified: `src/watch/daemon.ts`, `src/watch/ui.ts`, `src/status.ts`
- Reuse `parseMemoryEntries` from `dedup.ts` to parse gotcha-log entries (same `---` delimiter format)
- Re-implement `tokenize` + `jaccard` locally in `promote.ts` (not exported from `dedup.ts`)
- Gate on `config.watch?.adapter` — skip if not configured
- Must not modify `dedup.ts` public API

---

## Out of Scope

- Automatic activation of promoted rules (human review required — `pending-review` flag)
- Bulk re-scanning of old gotcha-log on daemon start
- A `clawstrap rules` sub-command (status surface is sufficient for discoverability)

---

## Implementation Notes

### Rule file format

```markdown
---
status: pending-review
generated: {ISO timestamp}
source: auto-promoted from gotcha-log
---

# {title}

{principle}

## Imperatives

- {imperative 1}
- {imperative 2}
- {imperative 3}
```

### Slug derivation

Top 2–3 most frequent non-stopword tokens from the correction group, joined with `-`.

Stopwords: `a an the is are was were be been being have has had do does did will would could should may might must can this that these those i we you he she it they of in on at to for with from by about`.

### LLM prompt format

Ask for structured plain-text output:
```
TITLE: ...
PRINCIPLE: ...
IMPERATIVES:
- ...
- ...
```

### Grouping algorithm

Greedy: for each correction entry, if it has Jaccard ≥ 0.65 with any member of an existing group, add it to that group. Otherwise start a new group.

### WatchUI additions

```typescript
promoteStart(): void
promoteDone(rulesWritten: number): void
```

`RichUI`: compact single line — `◆  Rules:  N draft rule(s) written to .claude/rules/`

### daemon.ts integration point

Inside the transcript callback, after `appendToGotchaLog`:
```typescript
if (result.corrections.length) {
  appendToGotchaLog(rootDir, result.corrections);
  await checkAndPromoteCorrections(rootDir, adapter, ui);
}
```

---

> Approved 2026-04-09.
