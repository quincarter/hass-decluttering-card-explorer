---
"decluttering-selector": patch
---

Fixed templates not showing up in Add Card when the Decluttering Selector card lives on a dashboard view/tab other than the one you currently have open. Home Assistant only builds the cards for whichever view tab is active, so a Decluttering Selector sitting on a different tab was never actually running — nothing registered until you clicked over to that tab at least once.

Registration now also happens once, automatically, from the dashboard's full saved configuration as soon as the page loads — which already includes every view, not just the active one — so your templates show up in Add Card no matter which tab you're on, without needing to visit the tab the card is placed on first. The existing per-card behavior is unchanged and keeps working the same way alongside this.
