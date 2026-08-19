# Contributing

This covers working on `decluttering-selector` itself — building it, testing it
against a real Home Assistant instance, and cutting a release. For installing and
using the card, see [README.md](../README.md).

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

## Releasing

Versions are managed with [Changesets](https://github.com/changesets/changesets),
and releasing is automated by two GitHub Actions workflows — there's normally
nothing to run by hand.

While making a user-facing change, record it and commit the result alongside the
change. Write the summary as a release note, not a commit message — it's read
verbatim by users later:

```bash
npm run changeset   # interactive: pick patch/minor/major, write a short summary
```

Scripting it (no TUI prompt) — this is what the `release-note` Claude Code skill
uses under the hood:

```bash
node scripts/add-changeset.mjs --bump patch --summary "What changed, for a reader of the release notes."
```

From there:

1. **`.github/workflows/version-pr.yml`** watches `main` for pending changesets and
   keeps a **"Version Packages"** PR open/updated with the resulting `package.json`
   bump and `CHANGELOG.md` entry.
2. Merge that PR whenever you're ready to ship what's on it.
3. **`.github/workflows/release.yml`** notices the version bump land on `main`,
   builds the card, tags it `vX.Y.Z`, and publishes a GitHub Release with
   `dist/decluttering-selector.js` attached — using the matching `## X.Y.Z` section
   of `CHANGELOG.md` as the release notes, so the descriptions from step 1 are what
   people actually see on the release page.

**That release is what HACS actually installs from** — it downloads
`decluttering-selector.js` from the latest release's assets, not straight from the
repo tree, so nothing reaches HACS users until this pipeline runs end-to-end.

Nothing here talks to the npm registry — there's no package published there, only
GitHub tags/releases.

<details>
<summary>Doing it by hand (no CI)</summary>

```bash
npm run version   # bumps package.json + writes CHANGELOG.md from pending changesets
npm run build     # rebuild dist/decluttering-selector.js against the new version
```

Then commit the version bump, `CHANGELOG.md`, and rebuilt `dist/`, tag it, and push a
release:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
gh release create vX.Y.Z dist/decluttering-selector.js --title vX.Y.Z --generate-notes
```

</details>

## Claude Code Skills

This repo has one project-scoped Claude Code skill, in `.claude/skills/`:

- **`release-note`** — records a release-note-worthy change as a Changeset from a
  plain-language description, without needing the interactive `changeset add`
  prompt (which is a TUI and can't be driven by a script or an agent). Invoke it
  with a description, optionally prefixed with an explicit bump type (`patch:`,
  `minor:`, or `major:` — defaults to `patch` if omitted), e.g.:

  ```
  /release-note minor: registers templates from cross-dashboard config too
  ```

  It writes that description to a `.changeset/*.md` file via
  `node scripts/add-changeset.mjs` (see [Releasing](#releasing) above) — the exact
  text becomes both the `CHANGELOG.md` entry and, once merged and released, the
  published GitHub release notes for that version. It only records the changeset;
  cutting an actual release is a separate, explicit step it never takes on its own.

## Tech

TypeScript + Lit 3, bundled with Vite into a single ES module. Pure, unit-tested
logic handles template parsing and the custom-element/registry wiring.
