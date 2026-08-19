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
npm run changeset    # record a pending version bump for the current change
npm run version      # consume pending changesets -> bump package.json + CHANGELOG.md
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

## Versioning & releases

Version is managed with [Changesets](https://github.com/changesets/changesets), not
by hand-editing `package.json`'s `version` field or ad-hoc git tags. Cutting a
release is automated by two workflows in `.github/workflows/`; there is normally no
need to run the manual steps below by hand — they exist for local dry-runs and for
understanding what the automation does.

- **When making a user-facing change** (anything that changes what the card does,
  not internal refactors/tests-only changes), add a changeset alongside it. For a
  human, `npm run changeset` is the interactive prompt. For Claude/an agent, use the
  `release-note` skill (`.claude/skills/release-note/`) instead — it wraps
  `scripts/add-changeset.mjs`, a non-interactive equivalent, since the interactive
  prompt can't be driven from a script or an agent. Either way, commit the resulting
  `.changeset/*.md` file with the change. The description you write there ends up,
  verbatim, as the `CHANGELOG.md` entry and — via `release.yml` — the published
  GitHub release notes, so write it for that audience, not as a commit message.
- This package is `"private": true`, and `.changeset/config.json` has
  `"privatePackages": { "version": true, "tag": true }` set — **do not remove
  `private: true` or that config together**; `@changesets/should-skip-package` (v3+)
  silently skips version-bumping any `private: true` package unless
  `privatePackages.version` opts it back in, which is easy to reintroduce by accident
  (it happened once already in this repo's history) and produces no error, just a
  `changeset version` that quietly does nothing.
- There is no npm registry target, so `changeset publish` is never used here — the
  "publish" step is a GitHub Release with the built card attached (below), not an npm
  publish.

### Automated flow (`.github/workflows/`)

1. **`version-pr.yml`** — on every push to `main`, runs `changesets/action` with only
   a `version` command configured (no `publish` input) so it *only* opens/updates a
   "Version Packages" PR when pending `.changeset/*.md` files exist. That PR contains
   the `npm run version` result: the `package.json` bump + `CHANGELOG.md` entry.
2. Merging that PR pushes the version bump to `main`.
3. **`release.yml`** — on every push to `main` that touches `package.json`, checks
   whether a `vX.Y.Z` tag matching the current version already exists. If not (i.e.
   this push is that merged version-bump), it builds, tags, extracts the matching
   `## X.Y.Z` section of `CHANGELOG.md`, and runs `gh release create` with
   `dist/decluttering-selector.js` attached and that extracted section as
   `--notes-file` (not `--generate-notes`) — so the changeset descriptions written in
   step 1 are what end users actually read on the release page. Attaching the built
   JS is **the step HACS actually depends on**: it downloads the file from the
   latest GitHub Release's assets, not from the repo tree directly, so a version bump
   without this step leaves HACS installs 404ing.

### Manual equivalent (dry-run / no CI)

1. `npm run version` — consumes every pending `.changeset/*.md` file, bumps
   `package.json`'s `version`, and updates `CHANGELOG.md`.
2. `npm run build` — rebuild `dist/decluttering-selector.js` against the new version.
3. Commit the version bump + `CHANGELOG.md` + rebuilt `dist/`.
4. `git tag vX.Y.Z` (matching the new `package.json` version) and push the tag.
5. `gh release create vX.Y.Z dist/decluttering-selector.js --title vX.Y.Z --generate-notes`.

Never run `npm run version`, tag, push a tag, or create a release by hand without the
user explicitly asking — see [Git](#git) below on the same principle for commits.

## Git

Only commit when explicitly asked. Never `git push --force` or rewrite published
history without explicit confirmation.
