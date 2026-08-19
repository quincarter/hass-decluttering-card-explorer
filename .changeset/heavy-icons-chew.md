---
"decluttering-selector": patch
---

Fix the version-bump GitHub Actions workflow crashing with "enableCompileCache is not a function" — @changesets/cli 3.x requires Node 22.1+, but the workflow was pinned to Node 20. Both workflows now use Node 24, and package.json declares an explicit engines.node requirement so this doesn't regress silently again.
  