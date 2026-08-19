---
"decluttering-selector": patch
---

Fix templates never registering on non-default dashboards: hass.lovelace is never actually populated for a plain Lovelace card (it's frontend-panel-local state, not part of the real hass object), so the card was silently relying on its lovelace/config websocket fallback — which omitted url_path and therefore always fetched the instance's default dashboard's config instead of the one the card is actually on. The card now resolves and passes the current dashboard's url_path (cross-checked against hass.panels so a reverse-proxy path prefix isn't mistaken for it), with a narrow, logged fallback for pre-migration instances that only have the unnamed default dashboard.
  