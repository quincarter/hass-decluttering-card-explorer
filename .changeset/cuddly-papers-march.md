---
"decluttering-selector": patch
---

Fixed templates not showing up in Add Card when the Decluttering Selector card lives on a dashboard view/tab other than the one you currently have open.

- **Root cause** — Home Assistant only builds the cards for whichever view tab is active, so a Decluttering Selector sitting on a different tab was never actually running until you clicked over to it at least once.
- **Fix** — registration now also runs once, automatically, from the dashboard's full saved configuration as soon as the page loads, which already includes every view and not just the active one, so templates show up in Add Card no matter which tab you're on.
- Existing per-card registration is unchanged and keeps working the same way alongside this.
