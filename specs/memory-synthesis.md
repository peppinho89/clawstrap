# Spec: Memory Synthesis — Periodic Living Summary
> **Status**: draft | **Created**: 2026-04-09 | **Issue**: peppinho89/clawstrap#8

---

## Problem Statement

`MEMORY.md` is append-only. After weeks of real usage it accumulates entries from sessions, git analysis, and convention scans — many stale, many superseded by later entries. The dedup logic prevents exact repeats but not semantic drift. At scale the file becomes too noisy to be useful, defeating the purpose of cross-session memory.

---

## Acceptance Criteria

- [ ] After every N new entries appended to `MEMORY.md` (default N=10, configurable), the daemon triggers a synthesis pass
- [ ] The synthesis sends the last N entries plus any existing Living Summary to the configured LLM adapter
- [ ] The result is written as a `## Living Summary` block at the top of `MEMORY.md`, replacing any existing one
- [ ] Existing raw entries are preserved below the Living Summary unchanged
- [ ] `watchState.entriesSinceLastSynthesis` in `.clawstrap.json` tracks the entry count between synthesis runs; resets to 0 after each run
- [ ] Synthesis is skipped silently if the LLM adapter fails — daemon does not crash
- [ ] Feature is opt-in via `watch.synthesis.enabled` (default: `false`); no synthesis occurs when disabled
- [ ] `clawstrap watch --silent` produces no synthesis UI output
- [ ] The new `synthStart()` / `synthDone()` UI methods render correctly in `RichUI`

---

## Technical Constraints

- Must not break existing 114 tests
- Must not block the daemon event loop — `synthesizeMemory` is `async`, called with `await`
- Must use the existing `Adapter` interface (`adapter.complete(prompt)`) — no new LLM dependencies
- Must use `picocolors` (not chalk) for any terminal color additions
- `appendToMemory` return type changes from `void` to `number` (entries actually written, after dedup) — this is the counter input

---

## Out of Scope

- Synthesizing gotcha-log, open-threads, or future-considerations (MEMORY.md only)
- Summarising the entire file history (only the last N entries are passed to the LLM each run)
- Configuring the synthesis prompt

---

## Design

### New config fields (`src/schema.ts`)

```typescript
watch: z.object({
  // existing ...
  synthesis: z.object({
    enabled: z.boolean().default(false),
    triggerEveryN: z.number().default(10),
  }).default({}),
})

watchState: z.object({
  // existing ...
  entriesSinceLastSynthesis: z.number().optional(),
})
```

### `appendToMemory` signature change (`src/watch/writers.ts`)

```typescript
// Before
export function appendToMemory(rootDir, entries, source): void

// After
export function appendToMemory(rootDir, entries, source): number
// Returns count of entries actually written (after dedup filtering)
```

### New file: `src/watch/synthesize.ts`

```typescript
export async function synthesizeMemory(
  rootDir: string,
  adapter: Adapter
): Promise<string | null>
```

**Logic:**
1. Read `MEMORY.md`; parse all entries via `parseMemoryEntries`
2. Take the last 20 entries (capped — avoids sending the entire file on large repos)
3. Extract any existing Living Summary (between sentinel markers)
4. Build prompt:
   - If existing summary: "Here is the current summary: {summary}. Here are recent new entries: {entries}. Update the summary to incorporate the new information. Output only the updated paragraph (3–5 sentences, no markdown heading)."
   - If no summary: "Here are recent memory entries: {entries}. Write a concise 3–5 sentence summary of the persistent truths about this workspace. Output only the paragraph."
5. Call `adapter.complete(prompt)`; strip any stray markdown
6. Write result between `<!-- CLAWSTRAP:SYNTHESIS:START -->` and `<!-- CLAWSTRAP:SYNTHESIS:END -->` at the top of `MEMORY.md` (after the first `#` heading line)
7. Return the summary string, or `null` on adapter failure

**MEMORY.md format after synthesis:**

```markdown
# Memory

<!-- CLAWSTRAP:SYNTHESIS:START -->
## Living Summary
> Updated: 2026-04-09T22:05:00Z

This workspace is the clawstrap CLI tool itself...
<!-- CLAWSTRAP:SYNTHESIS:END -->

---
[git] 2026-04-09T...
Co-changing file pairs...
```

### `WatchUI` additions (`src/watch/ui.ts`)

```typescript
interface WatchUI {
  // existing ...
  synthStart(): void;
  synthDone(summary: string | null): void;
}
```

`RichUI.synthStart()` — starts an ora spinner: `Synthesizing memory...`
`RichUI.synthDone(summary)` — `spinner.succeed(...)` with first 60 chars of summary, or `spinner.fail(...)` on null

### `daemon.ts` changes

After each `appendToMemory` call, accumulate returned count:

```typescript
const written = appendToMemory(rootDir, entries, "session");
entriesSinceLastSynthesis += written;
updateWatchState(rootDir, { entriesSinceLastSynthesis: String(entriesSinceLastSynthesis) });

const synthEnabled = config.watch?.synthesis?.enabled ?? false;
const triggerEveryN = config.watch?.synthesis?.triggerEveryN ?? 10;
if (synthEnabled && entriesSinceLastSynthesis >= triggerEveryN) {
  ui.synthStart();
  const summary = await synthesizeMemory(rootDir, adapter);
  ui.synthDone(summary);
  entriesSinceLastSynthesis = 0;
  updateWatchState(rootDir, { entriesSinceLastSynthesis: "0" });
}
```

`entriesSinceLastSynthesis` is initialised from `config.watchState?.entriesSinceLastSynthesis ?? 0` at daemon start.

---

## Files changed

| File | Change |
|------|--------|
| `src/schema.ts` | Add `watch.synthesis`, `watchState.entriesSinceLastSynthesis` |
| `src/watch/writers.ts` | `appendToMemory` returns `number` |
| `src/watch/synthesize.ts` | **NEW** — `synthesizeMemory()` |
| `src/watch/ui.ts` | Add `synthStart()`, `synthDone()` to interface + both impls |
| `src/watch/daemon.ts` | Accumulate counter; trigger synthesis |
| `tests/watch.test.ts` | Tests for `appendToMemory` return value, `synthesizeMemory` |
| `tests/schema.test.ts` | Tests for new schema defaults |

---

## Open Questions

- [x] Cap on entries sent to LLM → 20 (balances context cost vs. quality)
- [x] Default `enabled: false` → yes, opt-in (avoids unexpected LLM calls on fresh installs)
- [x] What happens if MEMORY.md has no heading line → insert synthesis block at file top

---

> Status: **awaiting approval**
