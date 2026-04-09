# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.5.1] - 2026-04-10

### Fixed

- `clawstrap watch` ora spinner crash on startup — `TypeError: ora.default is not a function` caused by tsup's CJS bundle ESM interop; normalised at import time
- Stopwords list was duplicated independently in `git.ts` and `promote.ts`; extracted to shared `src/watch/stopwords.ts` to prevent drift
- Concurrent LLM adapter calls (transcript, synthesis, inference, promotion) now serialized via a promise-chain wrapper in the daemon — prevents unbounded concurrent API requests
- `clawstrap status` now lists individual pending-review rule files with title previews (previously showed count only)

### Changed

- `clawstrap init` governance template now includes a **Directory Map** table mapping `artifacts/`, `context/`, `research/`, `tmp/`, and `.claude/memory/` to their purpose and when to write to them
- `clawstrap init` context-discipline rule now routes execution plans to `context/plan-{date}-{task}.md` instead of `tmp/` (which is for subagent output only); adds explicit session handoff paths

## [1.5.0] - 2026-04-09

### Added

- `clawstrap watch` now runs in the foreground with a rich, step-by-step terminal UI (modelled on Claude Code output style) — `--silent` is the explicit opt-out for CI/process-manager use
- Git observer periodic polling while the daemon runs: re-scans git log every N minutes (configurable via `watch.git.pollIntervalMinutes`, default 5) and writes new commits to MEMORY.md incrementally
- Memory synthesis: periodic living-summary pass on MEMORY.md via LLM adapter — rewrites a `## Living Summary` block at the top of the file so long-running projects stay navigable; opt-in via `watch.synthesis.enabled`, configurable threshold via `watch.synthesis.triggerEveryN`
- LLM-assisted architecture inference in convention scanner: `clawstrap watch` (and `--once`) now samples recently-changed source files and asks the configured adapter to infer 3–8 imperative architectural rules; written to `CONVENTIONS.md` under `## Architecture & Design Patterns`

### Changed

- `clawstrap watch` no longer detaches — users relying on background behavior should migrate to a process manager (`pm2`, `launchd`, `systemd`) with `--silent`
- `appendToMemory` now returns the number of entries actually written (after dedup), used by the synthesis counter
- Version bumped to 1.5.0

## [1.3.0] - 2026-04-04

### Added

- `--sdd` flag on `clawstrap init` to enable Spec-Driven Development mode
- Interactive SDD prompt during setup (opt-in, default: no)
- `specs/_template.md` — structured spec format scaffolded in every SDD workspace (problem statement, acceptance criteria, technical constraints, out-of-scope, open questions, implementation notes)
- `.claude/rules/sdd.md` — auto-loaded governance rule enforcing spec-first workflow with explicit exemptions for small bug fixes and docs-only changes
- `.claude/commands/spec.md` — `/spec` slash command that guides Claude through writing, saving, and getting approval on a spec before any implementation begins
- SDD section in `CLAUDE.md` and `GETTING_STARTED.md` when mode is enabled
- `status` command now shows `Spec-driven dev: yes/no`
- 11 new tests covering SDD file generation, content correctness, conditional CLAUDE.md/GETTING_STARTED.md blocks, and schema default

### Changed

- Version bumped to 1.3.0

## [1.2.0] - 2026-03-31

### Added

- `clawstrap export --format paperclip` command for Paperclip company export
- Exports follow the `agentcompanies/v1` spec (COMPANY.md, AGENTS.md, TEAM.md, SKILL.md)
- Agent bodies use "What triggers you / What you do / What you produce / Who you hand off to" structure
- `teams/engineering/TEAM.md` with manager + includes for org hierarchy
- `--validate` flag for dry-run export without writing files
- `--name`, `--mission`, `--out`, `--adapter` flags for export customization
- `status` command now shows last export metadata
- Reviewer agents auto-detected and get quality-gate-specific instructions

### Changed

- Version bumped to 1.2.0

## [1.1.0] - 2026-03-30

### Added

- `clawstrap add agent <name>` command with role selection (worker/orchestrator/reviewer)
- `clawstrap add skill <name>` command with SKILL_REGISTRY.md auto-update
- `clawstrap add project <name>` command with README.md and process.md
- `clawstrap status` command showing workspace config and structure
- Shared `loadWorkspace()` utility with friendly error handling for corrupt configs
- 13 new tests for all add commands

### Fixed

- Skill registry append logic anchored to heading (not fragile lastIndexOf)
- Malformed .clawstrap.json now shows friendly error instead of raw stack trace

## [1.0.0] - 2026-03-28

### Added

- `clawstrap init [directory]` command with interactive setup
- 4 workload profiles: research, content, data-processing, custom
- Parallel agent configuration: single, small-team, production
- Quality level selection: solo, team, production
- Session handoff checklists (opt-in)
- `--yes` flag for non-interactive mode with sensible defaults
- Custom template engine with `{%var%}`, `{%#if%}`, `{%#unless%}` syntax
- 15 governance templates (CLAUDE.md, rules, agents, skills, projects)
- Overwrite protection with confirmation prompt
- Nested `{%#if%}` block detection (throws error instead of silent corruption)
- 34 tests covering template engine, schema validation, and workspace generation
- CI pipeline with GitHub Actions (Node 18/20/22 matrix + macOS)
- Manual publish workflow with dry-run support and npm provenance
