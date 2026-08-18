# Decluttering Selector — Implementation Plan

> **Context for the implementer (Claude or any dev agent):** This is a **HACS custom Lovelace card** for Home Assistant, written in **TypeScript + Lit 3**, bundled with **Vite** into a single ES module. It is intended to be executed by a coding agent (e.g. Claude Code) on a different machine — there is **no Hermes/Hermes-specific tooling assumed**. Work the tasks sequentially; each task is independently verifiable. A real HA instance (or the dev mock in Phase 5) is needed only for final manual verification, not for the unit-testable logic.
>
> **This plan was rewritten after a direction change.** The original plan built a *standalone read-only explorer card*. The new goal (decided with the user) is to **feed decluttering templates into Home Assistant's native "Add Card" selector** so that, while building a dashboard, every template shows up as a selectable card with a live preview and inserts pre-filled.

## Status (as of 2026-08-18) — resume here in a fresh context window

**Read [`CLAUDE.md`](./CLAUDE.md) first** — it documents the repo layout, conventions,
and the subagent team (`lit-expert`, `home-assistant-expert`, `testing-expert`,
`code-reviewer`, defined in `.claude/agents/`). Keep using that team: tests first
(`testing-expert`), then the matching domain expert implements against the test file,
then `code-reviewer` reviews the diff before considering a task done.

**Done — Phases 0, 1, 2, 3, and Task 9** (Tasks 1–10 below; all still uncommitted —
nothing has been pushed or committed per the user's "only commit when asked" rule):
- `package.json`/`tsconfig.json`/`vite.config.ts`/`.gitignore` scaffolded, `js-yaml`
  dropped (unused, was cosmetic scope creep flagged by review).
- `src/types.ts`, `src/decluttering.ts`, `src/register.ts`,
  `src/decluttering-selector.ts` all implemented.
- `tests/decluttering.test.ts`, `tests/register.test.ts`,
  `tests/decluttering-selector.test.ts` — **72 tests, all green**. `npx tsc --noEmit`
  clean. `npm run build` produces `dist/decluttering-selector.js` (~26 kB, ~8 kB
  gzipped).
- `dev/index.html` + `dev/mock-hass.ts` updated to exercise `decluttering-selector`
  (the old `decluttering-explorer-card` references are gone).
- `info.md` (Task 9) written from `README.md` as the source, per its instructions.
- A `code-reviewer` pass found and the team fixed, TDD-style: stale
  `getStubConfig()`/`render()` after editing a template, silent tag-collision
  overwrite, malformed non-object `default` values producing garbage `variables`,
  missing `disconnectedCallback` unsubscribe for `lovelace_updated`, and a follow-up
  bug the collision fix itself introduced (stale tag ownership never released across
  `registerAll` passes, permanently blocking a colliding template's rename/successor
  from ever registering — fixed by having `registerAll` reconcile ownership against
  the current batch on every call).
- **Architecture deviation (previously flagged, now resolved):** `getDeclutteringTemplates(hass)`
  is now implemented in `src/decluttering.ts` as a pure function (reads
  `hass?.lovelace?.config?.decluttering_templates`, throws an exported
  `LovelaceUnavailableError` — safe against `hass` itself being `undefined`/`null` —
  when unavailable) with its own unit tests in `tests/decluttering.test.ts`.
  `src/decluttering-selector.ts`'s `_resolveTemplates()` now calls it and catches
  `LovelaceUnavailableError` via `instanceof` to fall back to the `lovelace/config` WS
  call; any other error rethrows into `_register()`'s catch, which now
  `console.error`s it instead of silently swallowing. Reviewed by `code-reviewer`
  (findings applied: null-safety on the pure function's `hass` param, error logging).

**Known accepted scope boundary (not a bug, but worth knowing):** when a template is
renamed or deleted, its old `window.customCards` entry is never actively pruned —
`registerAll`'s reconciliation only releases *tag ownership* so a colliding survivor
can re-register; it doesn't walk `window.customCards` removing entries for names no
longer present. In practice this only matters if a template is deleted outright with
no successor claiming its tag (rare — most edits are either a same-name edit or a
same-pass collision, both handled). Revisit only if it turns out to matter in real use.

**Minor known gap:** `HassWithLovelace` is still hand-duplicated (once, unexported, in
`src/decluttering.ts`; once, intersected with `HomeAssistant`, in
`src/decluttering-selector.ts`) — both describe the same `lovelace.config.decluttering_templates`
shape. Not a boundary violation (types erase at compile time), just two copies that
could drift if edited in only one place. Low priority; fold into one exported type if
it ever needs a third shape change.

**Not done yet — pick up here:**
- **Task 11 (manual verification)**: `npm install`/`test`/`build` are all verified
  green by the agent team, but the actual manual HA verification step (`dist/` copied
  into a real HA `www/`, added as a `module` resource, dashboard with
  `decluttering_templates` set up, "Add Card" picker opened, template clicked and
  inserted) has **not** been done — no real HA instance was available in this session.
  This still needs doing before calling the feature actually proven.
- **Phase 4 / Task 12**: final cleanup, and committing + pushing to
  `quincarter/hass-decluttering-card-explorer` — not started. Nothing in this repo has
  been committed yet; `git status` will show everything from this session as
  untracked/modified.

**Goal:** A card element that, once loaded on a dashboard, reads the dashboard's `decluttering_templates` and **registers each template into HA's native Add Card picker** (`window.customCards`) via a dynamically-defined `hui-card-decluttering-card-*` custom element whose `getStubConfig()` returns a fully pre-filled `custom:decluttering-card`. Clicking a template in the native picker shows a live preview and inserts the pre-filled card. Optionally it can also render a compact in-dashboard list/explorer as a bonus.

**Architecture (grounded in `home-assistant/frontend` `dev`):**

1. **Discovery of templates** — read `hass.lovelace.config.decluttering_templates` (storage + YAML mode both expose this). Fall back to the `lovelace/config` websocket if `hass.lovelace` is unavailable.
2. **Per-template synthetic element** — for each template `T`, define a HTMLElement subclass (Lit `LitElement`) at tag `hui-card-decluttering-card-<safe(T)>` with:
   - `static getStubConfig()` → `{ type: "custom:decluttering-card", template: T, variables: <template defaults flattened> }`
   - `render()` → a tiny preview (the template name + variable count) that **never throws** (the picker wraps previews in an `hui-error-card` detection, so a throwing render would mark the entry broken).
3. **Register into the native picker** — push `{ type: "decluttering-card-<safe(T)>", name, description, preview: true }` into the global `window.customCards` array. The picker's `_loadCards()` maps every `window.customCards` entry into a selectable row; clicking it calls `getCardStubConfig(type)` → `getCardElementClass(type)` → `tryCreateLovelaceElement` which strips the `custom:` prefix and resolves `hui-card-decluttering-card-<safe(T)>` to **our** element. So the inserted config is exactly our stub, pre-filled.
4. **Re-register on edits** — subscribe to the `lovelace_updated` event (and re-read on `hass` change) so adding/renaming templates updates the picker. Idempotent: skip redefining an existing tag; update the `customCards` entry in place if present.
5. **Scope** — only the **current dashboard's** `decluttering_templates` (matches what `decluttering-card` itself resolves). Cross-dashboard discovery is out of scope (a future version can use `lovelace/dashboards/list` + per-dashboard `lovelace/config?url_path=`).

**Why this is robust (no monkey-patching):** We only use public extension points — the global `window.customCards` array (the same one every custom card like mushroom/button-card uses) and the `customElements` registry that HA's own `tryCreateLovelaceElement` consults for `custom:*` types. No fork of `hui-card-picker`, no prototype patching. The only maintenance surface is the (stable) `window.customCards` shape and the `customElements` resolution convention, both unchanged for years.

**Tech Stack (pin to these; verify latest patch at install):**
- `lit@3.3.3`
- `custom-card-helpers` (latest) — for `HomeAssistant`, `LovelaceConfig` types
- `js-yaml` (latest) — YAML serialization for the optional "Copy YAML" explorer feature
- `vite@8.2.1` (dev/build), `typescript@latest`, `vitest@latest` (tests)

> Note: Preact signals are **dropped** from the original plan — the loader is event/registration driven, not reactive-UI driven, so signals add nothing. This keeps the bundle smaller and the logic simpler.

---

## Project Structure

```text
decluttering-selector/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── hacs.json
├── info.md                      # HACS store listing
├── README.md                    # Install + dev instructions
├── src/
│   ├── decluttering-selector.ts # main element (the loader)
│   ├── decluttering.ts          # PURE parse/build logic (unit-tested)
│   ├── register.ts              # customElements.define + window.customCards push (unit-tested)
│   └── types.ts                 # local types
├── tests/
│   ├── decluttering.test.ts     # Vitest unit tests (TDD)
│   └── register.test.ts
└── dev/
    ├── index.html               # loads the card with a mock hass
    └── mock-hass.ts             # fake HomeAssistant object for fast iteration
```

---

## Phase 0 — Scaffold

### Task 1: `package.json` — ✅ DONE
Pin versions above. Scripts: `dev` (vite), `build` (`tsc --noEmit && vite build`), `test` (`vitest run`), `test:watch` (`vitest`).

### Task 2: `tsconfig.json`, `vite.config.ts`, `.gitignore` — ✅ DONE
- `tsconfig.json`: `experimentalDecorators: true`, `useDefineForClassFields: false`, `strict: true`, `moduleResolution: Bundler`, `types: ["vite/client"]`, include `src`, `tests`, `dev`.
- `vite.config.ts`: lib build, single ES module `dist/decluttering-selector.js`, `target: es2020`, `minify: true`.
- `.gitignore`: `node_modules/`, `dist/`.

---

## Phase 1 — Pure logic (TDD)

### Task 3: `src/types.ts` — ✅ DONE
Local types: `DeclutteringTemplate` (`card? | element?`, `default?`, `variables?`, `entities?` — the known `decluttering-card` fields), `DeclutteringTemplates` map, `TemplateMeta` (`name`, `safeName`, `variableCount`, `requiredVariables`, `stubConfig`).

### Task 4: `src/decluttering.ts` — ✅ DONE
**Pure, no DOM, no HA** — fully unit-testable:
- `safeTagName(name: string): string` — lower-case, strip/replace illegal chars (`[^a-z0-9-]` → `-`), collapse repeats, trim `-`, prefix guard (HTML tags can't start with a digit → prefix `t-` if needed).
- `extractTemplates(config): DeclutteringTemplates` — returns `config.decluttering_templates ?? {}`.
- `buildStubConfig(name, template): LovelaceCardConfig` — returns `{ type: "custom:decluttering-card", template: name, variables: <flattened defaults> }`. Flattening: a `default:` array of objects becomes a merged object → expressed as `variables: [{ ...mergedDefaults }]` (decluttering-card accepts either an object map or an array of single-key objects; the array-of-objects form is the safest).
- `analyzeTemplates(templates): TemplateMeta[]` — for each: variable count (scan `card`/`element` YAML for `[[...]]` placeholders), required (no-default) variables, safeName.
- `getDeclutteringTemplates(hass)` — reads `hass.lovelace?.config?.decluttering_templates`, else throws a typed "unavailable" so the UI can fall back to the WS call. (WS fallback is wired in the element, not the pure fn.)

### Task 5: `tests/decluttering.test.ts` (write FIRST — TDD) — ✅ DONE
Cover: safeTagName edge cases (`My_Template!` → `my-template-`, leading digit `1foo` → `t-1foo`), stub config shape, variable/required extraction, empty templates → `[]`.

### Task 6: `src/register.ts` — ✅ DONE
**Pure-ish (DOM-registry guarded, testable via happy-dom/jsdom):**
- `makePreviewElement(tag, meta)` — returns a `LitElement` subclass with `static async getStubConfig()` returning `meta.stubConfig` and a `render()` that shows the template name + `${meta.variableCount} var(s)` (never throws).
- `registerTemplate(meta)` — if `!customElements.get(tag)` then `customElements.define(tag, cls)`; push `{ type: "decluttering-card-<safeName>", name, description, preview: true }` into `window.customCards` (update in place if an entry with that type already exists).
- `registerAll(metas)` — loop; return the list of registered types. Idempotent.

### Task 7: `tests/register.test.ts` — ✅ DONE
With happy-dom: after `registerTemplate(meta)`, assert `customElements.get(tag)` exists, `window.customCards` contains the entry with the right `type`/`name`/`preview`, and calling `getStubConfig()` yields the pre-filled stub. Re-register is idempotent (no throw, entry updated).

---

## Phase 2 — Loader element + wiring

### Task 8: `src/decluttering-selector.ts` — ✅ DONE
- `@customElement("decluttering-selector")` Lit element, standard `setConfig` (accepts optional `title`), `static getStubConfig()` returns `{ type: "custom:decluttering-selector" }`.
- `updated()` / `firstUpdated()`: when `hass` arrives, call `_register()`.
- `_register()`: `try { const t = getDeclutteringTemplates(this.hass); } catch { fall back to WS lovelace/config }`. Build `TemplateMeta[]` via `analyzeTemplates`, then `registerAll(metas)`. Render a small bonus explorer (list of templates + Copy YAML) **and** a status line ("N templates registered into Add Card"). Guard all renders.
- Subscribe to the `lovelace_updated` event on `this.hass.connection` to re-run `_register()` when the dashboard is saved.
- `render()`: the bonus explorer list (name, variable count, usage count, expandable raw YAML, Copy YAML button) **plus** a notice that templates are also available in the native Add Card picker. This preserves the original "explorer" value-add while the headline feature is the native integration.
- `getCardEditor()` — optional minimal editor (can be omitted for v1; return `undefined` is acceptable).

### Task 9: `info.md` (HACS listing) + `README.md` (install/dev) — ✅ DONE
State clearly: "Add this card once to any dashboard; it registers your decluttering templates into Home Assistant's native Add Card picker."

---

## Phase 3 — Dev environment + verification

### Task 10: `dev/index.html` + `dev/mock-hass.ts` — ✅ DONE
Mock `HomeAssistant` with a `lovelace.config` containing `decluttering_templates` + usages. Load the card; verify it registers entries into a `window.customCards` stub and the bonus list renders.

### Task 11: Build + verify — ⚠️ PARTIALLY DONE (build/test verified; manual HA verification still pending)
- `npm install` → 0
- `npm run test` → Vitest green
- `npm run build` → `dist/decluttering-selector.js` produced, no TS errors
- Manual: put `dist` in HA `www/`, add as `module` resource, add `type: custom:decluttering-selector` to a dashboard that has `decluttering_templates`; open "Add Card" → templates appear with previews; click one → pre-filled card inserted.

---

## Phase 4 — Polish + commit

### Task 12: Final cleanup + commit + push to `quincarter/hass-decluttering-card-explorer` — ⬜ TODO
Keep the file names from the existing repo (`decluttering-explorer-card.ts` etc. are fine to reuse/repurpose; the bundle output filename should match `hacs.json` `filename`).

## Risks / Tradeoffs / Open Questions
- **Tag collision:** if a user defines two templates whose `safeTagName` collides, the second is skipped (kept idempotent). Document the safe-name rule.
- **Picker re-render timing:** the native picker caches its card list in `_loadCards()` which runs on attach. Adding entries to `window.customCards` after the picker is already open won't refresh it until reopened. This is fine — the loader runs when the dashboard loads, before the user opens Add Card. If a template is added mid-session, the `lovelace_updated` re-registration updates `window.customCards`, but the *open* picker won't live-refresh (HA limitation). Acceptable for v1; note it.
- **`hui-error-card` detection:** our preview element must not throw, or the picker shows it as broken. All renders are guarded + wrapped in try/catch returning a safe node.
- **decluttering-card must be installed:** the inserted stub references `type: custom:decluttering-card`, so the real decluttering-card resource must be present (it always is, since the templates require it).
- Cross-dashboard discovery excluded (current dashboard only).
