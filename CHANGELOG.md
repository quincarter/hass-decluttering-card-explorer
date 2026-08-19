# decluttering-selector

## 0.3.3

### Patch Changes

- 97c61fd: Document a tip in README.md: even with show_info off, the card can still claim a cell in a grid/sections dashboard. Use Home Assistant's own per-card Visibility setting to hide it from everyone if that's a problem, so it does its job without affecting your layout.

## 0.3.2

### Patch Changes

- 6fef776: Add screenshots to README.md showing the Add Card picker with live template previews, an example dashboard's decluttering_templates config, and the optional show_info status list.

## 0.3.1

### Patch Changes

- b165d7f: Clean up stale references in README.md and CONTRIBUTING.md, including an outdated project description that no longer matched what the card does.

## 0.3.0

### Minor Changes

- a98feae: The on-dashboard status list (title, template count, template names) is now hidden by default — this card's job is registering templates into the native Add Card picker, not adding a visible block to your dashboard. Add show_info: true to the card's config to see it again.

## 0.2.2

### Patch Changes

- 21cb2ac: Fix registered templates showing a permanent loading spinner instead of a live preview in the native Add Card picker. The custom element powering each preview was defined at the wrong tag (hui-card-<type>) — HA resolves custom card types as customElements.get(<type>) directly, with no hui-card- prefix (that convention only applies to HA's own built-in card types). The mismatched tag meant HA's lookup timed out after 2s and the resulting rejected promise left the picker's loading placeholder in place forever.

## 0.2.1

### Patch Changes

- ca1fac9: Fix templates never registering on non-default dashboards: hass.lovelace is never actually populated for a plain Lovelace card (it's frontend-panel-local state, not part of the real hass object), so the card was silently relying on its lovelace/config websocket fallback — which omitted url_path and therefore always fetched the instance's default dashboard's config instead of the one the card is actually on. The card now resolves and passes the current dashboard's url_path (cross-checked against hass.panels so a reverse-proxy path prefix isn't mistaken for it), with a narrow, logged fallback for pre-migration instances that only have the unnamed default dashboard.
- ca1fac9: Document the release-note Claude Code skill in .github/CONTRIBUTING.md, explaining what it does and how to invoke it alongside the existing Releasing instructions.

## 0.2.0

### Minor Changes

- ab76b33: Add a non-interactive changeset script (scripts/add-changeset.mjs) and a /release-note Claude Code skill that invokes it, so recording a release-note-worthy change no longer needs the interactive changeset prompt. release.yml now sources GitHub release notes from the matching CHANGELOG.md section instead of auto-generated commit notes, so these descriptions flow all the way through to the published release.

### Patch Changes

- fa14efe: Fix the version-bump GitHub Actions workflow crashing with "enableCompileCache is not a function" — @changesets/cli 3.x requires Node 22.1+, but the workflow was pinned to Node 20. Both workflows now use Node 24, and package.json declares an explicit engines.node requirement so this doesn't regress silently again.

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
