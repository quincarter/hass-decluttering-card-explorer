# Decluttering Selector

A Lovelace card for Home Assistant that **registers your
[`decluttering-card`](https://github.com/custom-cards/decluttering-card) templates
into Home Assistant's native "Add Card" picker** — so while you build a dashboard,
every template shows up as a selectable card with a live preview and inserts
pre-filled.

> **This repo is the scaffold + plan.** The card itself is built task-by-task from
> [`PLAN.md`](./PLAN.md) by a coding agent (e.g. Claude). See that file for the full
> breakdown.

## The problem it solves

[`decluttering-card`](https://github.com/custom-cards/decluttering-card) lets you
define a template once (`decluttering_templates:` in your dashboard config) and reuse
it everywhere with different variables — but Home Assistant's native "Add Card" picker
has no idea those templates exist. To use one, you normally have to open the raw YAML
editor and hand-write a `type: custom:decluttering-card` block yourself, remembering
the template name and every variable it expects.

**Decluttering Selector** closes that gap: add it once to a dashboard, and every
template you've defined shows up as its own selectable card in the picker, with a
preview and a ready-to-go config — no YAML required.

## How it works

1. **Discovery** — on load, the card reads `decluttering_templates` off the current
   dashboard's Lovelace config (falling back to a `lovelace/config` websocket call if
   that config isn't attached to `hass` yet).
2. **Per-template registration** — for each template, it defines a small custom
   element with a `getStubConfig()` that returns a fully pre-filled
   `type: custom:decluttering-card` (template name + flattened default variables), and
   pushes an entry describing it into the global `window.customCards` array — the
   same public array every custom card (Mushroom, button-card, etc.) uses to register
   itself with HA's picker.
3. **Native picker integration** — Home Assistant's own "Add Card" dialog reads
   `window.customCards`, so your templates appear right alongside the built-in cards.
   Click one, and it inserts the exact pre-filled stub — no manual YAML.
4. **Staying in sync** — the card re-registers whenever the dashboard is saved
   (listening for the `lovelace_updated` event), so adding, renaming, or editing a
   template updates the picker without a page reload.

No forking of Home Assistant's frontend and no monkey-patching — only the same public
extension points every other custom card relies on (`window.customCards` +
`customElements`).

## What it does (v1)

- Reads `decluttering_templates` from the current dashboard
- Registers each template into the native Add Card picker (name, description, live preview)
- Clicking a template inserts a **pre-filled** `custom:decluttering-card`
- Re-registers on `lovelace_updated` (dashboard saved)
- Bonus: an in-dashboard explorer list (variables, usage count, expandable raw YAML, "Copy YAML")

## Installation

### Option A — HACS (recommended)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=quincarter&repository=hass-decluttering-card-explorer&category=plugin)

1. Click the badge above (or, in HACS, go to **HACS → Frontend → ⋮ → Custom
   repositories** and add `https://github.com/quincarter/hass-decluttering-card-explorer`
   with category **Lovelace**).
2. Install **Decluttering Selector** from HACS.
3. HACS adds the module as a Lovelace resource automatically. If your dashboard is in
   **YAML mode**, add it yourself under **Settings → Dashboards → Resources**:

   ```yaml
   url: /hacsfiles/hass-decluttering-card-explorer/decluttering-selector.js
   type: module
   ```

4. Add the card to any dashboard that defines `decluttering_templates`:

   ```yaml
   type: custom:decluttering-selector
   ```

### Option B — Manual install

1. Download `dist/decluttering-selector.js` from the
   [latest release](https://github.com/quincarter/hass-decluttering-card-explorer/releases)
   (or build it yourself — see [Development](#development) below).
2. Copy it into your Home Assistant `config/www/` folder, e.g.
   `config/www/decluttering-selector.js`.
3. Add it as a Lovelace resource: **Settings → Dashboards → ⋮ → Resources → Add
   Resource**:

   ```yaml
   url: /local/decluttering-selector.js
   type: module
   ```

4. Add the card to any dashboard that defines `decluttering_templates`:

   ```yaml
   type: custom:decluttering-selector
   ```

5. Open **"Add Card"** on that dashboard — your templates now appear alongside the
   built-in cards, each with a live preview. Click one to insert a fully pre-filled
   `custom:decluttering-card`.

> **Requirement:** the real
> [`decluttering-card`](https://github.com/custom-cards/decluttering-card) resource
> must also be installed — the inserted stub references
> `type: custom:decluttering-card`, and your `decluttering_templates` already require
> it to work at all.

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
