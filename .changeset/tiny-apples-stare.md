---
"decluttering-selector": minor
---

Add a non-interactive changeset script (scripts/add-changeset.mjs) and a /release-note Claude Code skill that invokes it, so recording a release-note-worthy change no longer needs the interactive changeset prompt. release.yml now sources GitHub release notes from the matching CHANGELOG.md section instead of auto-generated commit notes, so these descriptions flow all the way through to the published release.
  