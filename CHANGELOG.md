# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
