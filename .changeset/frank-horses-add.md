---
"decluttering-selector": patch
---

Fix registered templates showing a permanent loading spinner instead of a live preview in the native Add Card picker. The custom element powering each preview was defined at the wrong tag (hui-card-<type>) — HA resolves custom card types as customElements.get(<type>) directly, with no hui-card- prefix (that convention only applies to HA's own built-in card types). The mismatched tag meant HA's lookup timed out after 2s and the resulting rejected promise left the picker's loading placeholder in place forever.
  