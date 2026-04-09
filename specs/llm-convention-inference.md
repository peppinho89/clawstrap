# Spec: LLM-Assisted Semantic Inference in Convention Scanner
> **Status**: draft | **Created**: 2026-04-09 | **Issue**: peppinho89/clawstrap#6

---

## Problem Statement

The convention scanner (`scan.ts`) is entirely syntactic — it counts naming patterns, import styles, and comment density. It misses the architectural and design patterns that most influence AI agent decisions: things like "all external I/O is isolated in `adapters/`" or "errors are always wrapped before re-throwing." These are visible in the code but not countable.

---

## Acceptance Criteria

- [ ] After the syntactic scan, up to 10 source files are sampled and sent to the LLM adapter alongside the syntactic findings
- [ ] The adapter returns 3–8 imperative rules (`Always…`, `Never…`, `When X, do Y`) describing architectural and design patterns
- [ ] Results are written into a `## Architecture & Design Patterns` section inside the existing `CLAWSTRAP:AUTO` block in `conventions.md`, refreshed on each scan cycle
- [ ] File sampling prefers recently changed files (git log), prefers non-test files, caps at 10 files and ~150 lines per file
- [ ] Feature is silently skipped (no crash, no section written) when: no LLM adapter is configured, the adapter call fails, or there is no git repo / no code files found
- [ ] Works in both the foreground daemon scan cycle and `clawstrap watch --once`
- [ ] `clawstrap watch --silent` produces no inference UI output
- [ ] New `inferStart()` / `inferDone()` UI methods render correctly in `RichUI`

---

## Technical Constraints

- `runScan` in `scan.ts` stays pure/synchronous — no adapter dependency introduced there
- Must use the existing `Adapter` interface — no new LLM dependencies
- Must use `picocolors` for any terminal color additions
- Must not break existing 139 tests

---

## Out of Scope

- Inferring patterns from non-code files (markdown, JSON config)
- Running inference outside the scan cycle (e.g. on every transcript)
- Making the inference prompt configurable

---

## Design

### New file: `src/watch/infer.ts`

```typescript
export async function inferArchitecturePatterns(
  rootDir: string,
  syntacticSections: ConventionSections,
  adapter: Adapter
): Promise<string[]>
```

**File sampling logic:**
1. Try `git -C rootDir log --format='' --name-only -n 100` → parse unique file paths → keep only `.ts/.js/.tsx/.jsx` that exist → exclude test files (`*.test.*`, `*.spec.*`) → take first 10
2. If git unavailable or fewer than 3 files found, fall back to `walkDir` (already in scan.ts — duplicate inline), pick non-test code files up to 10
3. For each sampled file, read up to 150 lines (truncate beyond that with `// ... truncated`)

**Prompt:**
```
You are analysing a software project to infer its architectural and design conventions.

Syntactic analysis already found:
- Naming: {naming}
- Imports: {imports}
- Error handling: {errorHandling}

Source file samples:
=== {filename} ===
{content}
...

Based on the code, identify 3–8 architectural or design patterns as imperative rules.
Rules must be specific to this codebase, not generic best practices.
Format: one rule per line, starting with "Always", "Never", or "When".
Output only the rules — no explanation, no numbering, no markdown.
```

**Return value:** array of rule strings; empty array on failure.

### `src/watch/writers.ts` — extend `ConventionSections`

```typescript
export interface ConventionSections {
  naming: string[];
  imports: string[];
  testing: string[];
  errorHandling: string[];
  comments: string[];
  architecture?: string[];   // NEW — optional, omitted when inference skipped
}
```

`buildAutoBlock` gains a new section:

```
## Architecture & Design Patterns
- Always isolate external I/O in adapters/ files
- Never call services directly from CLI handlers
```

If `architecture` is absent or empty, the section is omitted entirely from the block.

### `src/watch/ui.ts` — new methods

```typescript
interface WatchUI {
  // existing...
  inferStart(): void;
  inferDone(rulesCount: number | null): void;
}
```

`RichUI.inferStart()` — starts an ora spinner: `Inferring architecture patterns...`
`RichUI.inferDone(n)` — `spinner.succeed("Architecture patterns inferred  N rules")` or `spinner.fail(...)` on null. Stops and clears lingering spinner before starting (same defensive pattern as `synthStart`).

### `src/watch/daemon.ts` — wire into scan cycle

In `doScan()`:

```typescript
const doScan = async () => {
  ui.scanStart(lastScan);
  ui.scanFilesStart();
  const sections = await runScan(rootDir);
  ui.scanFilesDone();

  // LLM architecture inference (skipped silently if adapter unavailable)
  if (config.watch?.adapter) {
    ui.inferStart();
    const rules = await inferArchitecturePatterns(rootDir, sections, adapter);
    ui.inferDone(rules.length > 0 ? rules.length : null);
    sections.architecture = rules.length > 0 ? rules : undefined;
  }

  writeConventions(rootDir, sections);
  updateWatchState(rootDir, { lastScanAt: new Date().toISOString() });
  ui.scanDone(sections.naming[0] ?? "");
};
```

### `src/watch.ts` — wire into `--once` path

Same pattern: after `runScan`, if `config.watch?.adapter` is set, call `inferArchitecturePatterns` and merge before `writeConventions`.

---

## Files changed

| File | Change |
|------|--------|
| `src/watch/infer.ts` | **NEW** — `inferArchitecturePatterns()` |
| `src/watch/writers.ts` | `ConventionSections.architecture?: string[]`; new section in `buildAutoBlock` |
| `src/watch/ui.ts` | `inferStart()` / `inferDone()` on interface + both impls |
| `src/watch/daemon.ts` | Call inference inside `doScan()` |
| `src/watch.ts` | Call inference in `--once` path |
| `tests/watch.test.ts` | Tests for `inferArchitecturePatterns`, `ConventionSections.architecture` in `writeConventions` |

---

## Open Questions

- [x] Cap on file content → 150 lines per file (controls token cost)
- [x] Min files before inference is worthwhile → 3 (fewer than 3 useful files → skip)
- [x] `architecture` section omitted vs. empty when inference skipped → omitted (no empty heading in conventions.md)
- [x] `--once` path: use `createAdapter(config)` only if `config.watch` is defined

---

> Status: **awaiting approval**
