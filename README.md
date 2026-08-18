# Decluttering Selector

A Lovelace card for Home Assistant that **registers your
[`decluttering-card`](https://github.com/custom-cards/decluttering-card) templates
into Home Assistant's native "Add Card" picker** — so while you build a dashboard,
every template shows up as a selectable card with a live preview and inserts
pre-filled.

Add this card **once** to any dashboard that defines `decluttering_templates`. On
load it reads your templates, defines a synthetic `hui-card-decluttering-card-*`
element for each (with a `getStubConfig()` that returns a pre-filled
`custom:decluttering-card`), and pushes them into the global `window.customCards`
array that the native Add Card picker renders. No fork, no monkey-patching — only
public extension points.

> **This repo is the scaffold + plan.** The card itself is built task-by-task from
> [`PLAN.md`](./PLAN.md) by a coding agent (e.g. Claude). See that file for the full
> breakdown.

## What it does (v1)

- Reads `decluttering_templates` from the current dashboard
- Registers each template into the native Add Card picker (name, description, live preview)
- Clicking a template inserts a **pre-filled** `custom:decluttering-card`
- Re-registers on `lovelace_updated` (dashboard saved)
- Bonus: an in-dashboard explorer list (variables, usage count, expandable raw YAML, "Copy YAML")

## Development

```bash
npm install
npm run dev      # open dev/index.html with a mock HA object (fast iteration)
npm run test     # Vitest unit tests for the pure parse/register logic
npm run build    # outputs dist/decluttering-selector.js
```

To test against a real HA instance:

1. `npm run build`
2. Copy `dist/decluttering-selector.js` to HA `/config/www/`
3. Add it as a `module` resource
4. Add the card to a dashboard: `type: custom:decluttering-selector`
5. Open "Add Card" → your templates appear with previews

## Tech

TypeScript + Lit 3, bundled with Vite into a single ES module. Pure, unit-tested
logic handles template parsing and the custom-element/registry wiring.
