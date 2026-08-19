# decluttering-selector

## 0.1.1

### Patch Changes

- Adopt Changesets for version management: `npm run changeset` to record a pending
  bump, `npm run version` to consume pending changesets into a `package.json` bump and
  `CHANGELOG.md` entry. Releasing to GitHub (tag + release with the built card
  attached, which is what HACS installs from) is documented in `CLAUDE.md` and
  `README.md`.

## 0.1.0

### Initial release

- Reads `decluttering_templates` off the current dashboard's Lovelace config
  (falling back to a `lovelace/config` websocket call when that config isn't
  attached to `hass` yet) and registers each template into Home Assistant's native
  "Add Card" picker via the public `window.customCards` array and `customElements`
  registry — no forking of the frontend, no monkey-patching.
- Clicking a registered template in the picker inserts a fully pre-filled
  `custom:decluttering-card` (template name + flattened default variables).
- Re-registers automatically on the `lovelace_updated` event, so adding, renaming, or
  editing a template updates the picker without a manual reload.
- Idempotent registration: safe to re-run without throwing, duplicating
  `window.customCards` entries, or re-defining an already-registered custom element;
  handles same-name edits and same-pass/cross-pass tag collisions correctly.
- On-dashboard status card: an optional `title`, a count of templates registered,
  and the list of template names found.
- `info.md` (HACS store listing) and an expanded `README.md` covering the
  architecture, HACS and manual install paths, a full usage walkthrough, and
  troubleshooting.
- 72 Vitest tests covering the pure template/config parsing logic
  (`src/decluttering.ts`), the registry/DOM wiring (`src/register.ts`), and the
  loader element (`src/decluttering-selector.ts`).
