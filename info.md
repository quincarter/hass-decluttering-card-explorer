## Decluttering Selector

Add this card **once** to any dashboard that defines `decluttering_templates`. It
registers your [`decluttering-card`](https://github.com/custom-cards/decluttering-card)
templates into Home Assistant's native **"Add Card"** picker — so while you build a
dashboard, every template shows up as a selectable card with a live preview and
inserts fully pre-filled.

### What it does

- Reads `decluttering_templates` from the current dashboard
- Registers each template into the native Add Card picker (name, description, live preview)
- Clicking a template inserts a **pre-filled** `custom:decluttering-card`
- Re-registers automatically when the dashboard is saved (`lovelace_updated`)
- Bonus: an in-dashboard explorer list (variables, usage count, expandable raw YAML, "Copy YAML")

### Setup

1. Install via HACS (or copy `dist/decluttering-selector.js` into `/config/www/` manually).
2. Add it as a Lovelace `module` resource if HACS didn't do so automatically.
3. Add the card to any dashboard that uses `decluttering_templates`:

   ```yaml
   type: custom:decluttering-selector
   ```

4. Open **"Add Card"** — your templates now appear alongside the built-in cards, each
   with a live preview. Click one to insert a fully pre-filled
   `custom:decluttering-card`.

### Requirements

The real [`decluttering-card`](https://github.com/custom-cards/decluttering-card)
resource must also be installed — the inserted stub references
`type: custom:decluttering-card`, and your dashboard's `decluttering_templates`
already require it to work at all.
