# Rule: Spec-Driven Development
> **Scope**: All sessions | **Version**: 1.0 | **Generated**: 2026-04-08

## The Rule

Never implement from a vague prompt. Before writing any code or making structural
changes, write a spec. Get explicit approval. Then implement from the spec.

This rule exists because "just do it" prompts produce work that satisfies the
surface request while violating unstated constraints. Specs surface those
constraints before the work starts.

---

## When to Write a Spec

A spec is required for:

- Any new feature or component
- Any refactor that touches more than 3 files
- Any change to a public API or data schema
- Any work whose scope is not fully clear from the request

A spec is **not** required for:

- Bug fixes under 5 lines
- Documentation-only changes
- Adding tests for existing, already-specified behavior
- Changes explicitly described as "no spec needed" by the user

---

## The Workflow

1. **Receive request** — user describes what they want
2. **Write spec** — create `specs/{kebab-name}.md` using `specs/_template.md`
3. **Present for approval** — show the spec to the user before doing any implementation
4. **Incorporate feedback** — update the spec until approved; do not start work until then
5. **Implement from spec** — treat the approved spec as the contract; flag deviations
6. **Mark complete** — update spec status to `complete` after implementation

---

## Spec Naming

Use kebab-case, descriptive, scoped to the feature:

```
specs/user-authentication.md
specs/csv-export-pipeline.md
specs/agent-retry-logic.md
```

---

## On Pushback

If the user says "just do it, skip the spec":

- Acknowledge the preference
- Offer a 5-minute lightweight spec (problem + criteria only) as a compromise
- If they explicitly confirm "no spec", proceed — but note the deviation

The rule exists to protect the user's time, not to create friction for its own sake.
