# CLAUDE.md

Guidance for Claude Code (and any subagents it spawns) working in this repo.

## What this repo is

`decluttering-selector` is a **HACS custom Lovelace card** for Home Assistant,
written in **TypeScript + Lit 3**, bundled by **Vite** into a single ES module. It
reads a dashboard's `decluttering_templates` and registers each one into HA's native
"Add Card" picker (via the public `window.customCards` array + the `customElements`
registry), so every template shows up as a selectable card with a live preview and
inserts fully pre-filled.

The full architecture, task breakdown, and rationale live in [`PLAN.md`](./PLAN.md) —
read it before starting implementation work. It is the source of truth for function
signatures, file layout, and sequencing. [`README.md`](./README.md) is the
user-facing description of the finished card.

## Commands

```bash
npm install
npm run dev        # dev/index.html with a mock HomeAssistant object
npm run test        # vitest run — must stay green
npm run test:watch  # vitest watch mode
npm run build        # tsc --noEmit && vite build -> dist/decluttering-selector.js
```

## Project layout

```
src/
  types.ts                 # local types: DeclutteringTemplate(s), TemplateMeta
  decluttering.ts           # pure parse/build logic — NO DOM, NO window, NO hass mutation
  register.ts                # customElements.define + window.customCards wiring
  decluttering-selector.ts    # the Lit loader element (the card users add)
tests/
  decluttering.test.ts
  register.test.ts
  decluttering-selector.test.ts
dev/
  index.html, mock-hass.ts   # fast local iteration without a real HA instance
```

## Core conventions

- **Pure logic stays pure.** `src/decluttering.ts` must never reference `window`,
  `document`, or `customElements` — that's what makes it trivially unit-testable.
  DOM/registry glue lives in `src/register.ts` and `src/decluttering-selector.ts`.
- **`render()` must never throw.** HA's native card picker treats a throwing render
  as a broken entry. Every render path — especially per-template previews — needs
  defensive guards around potentially missing/malformed template data.
- **Idempotent registration.** Re-running registration (on a second `hass` update or
  a `lovelace_updated` event) must not throw or duplicate `window.customCards`
  entries or re-`define` an existing custom-element tag.
- **Write tests for everything.** Every new or changed `src/*.ts` file gets
  corresponding Vitest coverage in the same change, written TDD-style (tests first)
  per `PLAN.md`'s task breakdown. `npm run test` must be green before a task is
  considered done.
- **No unrequested abstraction.** Match `PLAN.md`'s scope; don't add config knobs,
  generality, or cleanup beyond what the current task needs.
- **Comments explain why, not what.** Skip comments that restate the code; only
  comment non-obvious constraints (e.g. why `render()` must not throw).

## Subagent team

This repo has a fixed team of specialized subagents defined in `.claude/agents/`.
Prefer delegating to the matching specialist over doing the work directly:

- **`lit-expert`** — Lit 3 / LitElement / decorators / custom-element lifecycle /
  Vite lib bundling. Use for anything in `src/register.ts` or
  `src/decluttering-selector.ts`.
- **`home-assistant-expert`** — `decluttering-card` template format, `hass.lovelace`
  shape, the `lovelace/config` websocket fallback, and native Add Card picker
  internals (`window.customCards`, `getStubConfig`, `tryCreateLovelaceElement`). Use
  for anything in `src/decluttering.ts` or config-shape decisions anywhere else.
- **`testing-expert`** — writes/extends Vitest suites, TDD-first, including
  happy-dom-based tests for registry/DOM code. Use before or alongside any
  implementation task.
- **`code-reviewer`** — independent, read-only review of a diff for correctness,
  security, idempotency, render-safety, and unnecessary complexity, checked against
  `PLAN.md`'s "Risks / Tradeoffs" section. Use after a task's tests are green and
  before considering the task done.

Typical flow for one `PLAN.md` task: `testing-expert` writes the test file against
the spec → the matching domain expert (`lit-expert` or `home-assistant-expert`)
implements against that test file until green → `code-reviewer` reviews the diff.
Independent tasks (e.g. `decluttering.ts` vs `register.ts`) can be delegated in
parallel; dependent ones (the loader element needs both underneath it) must be
sequenced.

## Git

Only commit when explicitly asked. Never `git push --force` or rewrite published
history without explicit confirmation.
