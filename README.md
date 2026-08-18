# Decluttering Explorer Card

A read-only Lovelace card for Home Assistant that explores your
[`decluttering-card`](https://github.com/custom-cards/decluttering-card) templates —
no more digging through dashboard YAML to find what you defined, what variables it
needs, or where it's used.

> **This repo is the scaffold + plan.** The card itself is built task-by-task from
> [`PLAN.md`](./PLAN.md) by a coding agent (e.g. Claude). See that file for the full
> breakdown.

## Features (v1)

- Lists every `decluttering_templates` entry on the **current dashboard**
- Shows each template's variables, defaults, and required (no-default) variables
- Shows how many times each template is used
- Click a row to expand the raw YAML
- "Copy YAML" button
- Live-refreshes when the dashboard is saved (`lovelace_updated` event)

## Development

```bash
npm install
npm run dev      # open dev/index.html with a mock HA object (fast UI iteration)
npm run test     # Vitest unit tests for the pure parse/count logic
npm run build    # outputs dist/decluttering-explorer-card.js
```

To test against a real HA instance:

1. `npm run build`
2. Copy `dist/decluttering-explorer-card.js` to HA `/config/www/`
3. Add it as a `module` resource
4. Add the card to a dashboard: `type: custom:decluttering-explorer-card`

## Tech

TypeScript + Lit 3, bundled with Vite into a single ES module. UI state is held in
Preact signals (`@preact/signals-core`) and consumed reactively inside the Lit render
via the official `@lit-labs/preact-signals` `SignalWatcher` mixin.
