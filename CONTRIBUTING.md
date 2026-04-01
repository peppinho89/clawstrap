# Contributing to Clawstrap

Thanks for your interest in contributing. Here's how to get started.

## Development Setup

```bash
git clone https://github.com/peppinho89/clawstrap.git
cd clawstrap
npm install
npm test        # run tests
npm run build   # build the CLI
```

Run the CLI locally after building:

```bash
node dist/index.cjs init /tmp/test-workspace --yes
node dist/index.cjs status
```

## Making Changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Add tests for new functionality
4. Run `npm test` — all tests must pass
5. Run `npm run typecheck` — no type errors
6. Open a PR against `main`

## What to Contribute

- **Bug fixes** — found something broken? Fix it and open a PR
- **Templates** — improve the generated workspace files (in `src/templates/`)
- **New export formats** — add support for other agent platforms
- **Documentation** — typos, clarity, examples

Check [open issues](https://github.com/peppinho89/clawstrap/issues) for ideas. Issues labeled `good first issue` are a great starting point.

## Code Standards

- TypeScript strict mode
- Tests with Vitest
- Template files use `{%var%}` syntax (not `{{}}`)
- No unnecessary dependencies

## Reporting Bugs

Open an [issue](https://github.com/peppinho89/clawstrap/issues/new?template=bug_report.md) with:
- What you expected
- What happened
- Steps to reproduce
- Node.js version and OS
