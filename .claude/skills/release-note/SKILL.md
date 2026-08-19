---
name: release-note
description: Record a release-note-worthy change to decluttering-selector as a Changeset, from a plain-language description, without the interactive `changeset add` prompt (which can't run non-interactively). Use whenever a user-facing change is made to this repo and needs to be recorded for the next release — the description becomes both the CHANGELOG.md entry and, eventually, the published GitHub release notes for that version.
---

You are recording a Changeset for the `decluttering-selector` repo so the change is
included in the next version bump and release.

## What to do

1. The skill's `args` is a plain-language description of what changed, optionally
   prefixed with an explicit bump type (`patch`, `minor`, or `major`) — e.g.
   `minor: registers templates from cross-dashboard config too`. If no bump type is
   given, infer one:
   - `patch` — bug fixes, docs, internal refactors, tooling (the default; use this
     unless the change clearly warrants more).
   - `minor` — a new user-facing capability that doesn't break existing configs.
   - `major` — a breaking change to the card's config shape or behavior (rare, and
     this package is pre-1.0, so reserve it for something that would genuinely
     surprise an existing user).
     If you're unsure, use `patch` rather than guessing upward.
2. Write the description as you would a CHANGELOG entry: a complete sentence (or a
   couple of short ones), specific about what changed and why it matters to someone
   reading release notes — not a commit-message fragment. This text is read verbatim
   by users later; don't reference this conversation or internal task names.
3. Run, from the repo root:

   ```bash
   node scripts/add-changeset.mjs --bump <patch|minor|major> --summary "<description>"
   ```

4. Report back the path of the `.changeset/*.md` file that was created (the script
   prints it). Do not run `npm run version`, tag, or create a release yourself —
   recording the changeset is the whole job here; cutting a release is a separate,
   explicit action (see `CLAUDE.md`'s "Versioning & releases" section) that needs the
   user's direct go-ahead.
