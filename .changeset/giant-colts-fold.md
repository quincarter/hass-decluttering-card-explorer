---
"decluttering-selector": minor
---

Added a `dedicated_picker` option and a new "Decluttering: Choose a Template" card to the Add Card picker.

- **Default behavior is unchanged** — Add Card still shows one "Decluttering: `<template name>`" entry per template.
- **New opt-in mode** — set `dedicated_picker: true` on the Decluttering Selector card to replace all of those per-template entries with a single "Decluttering: Choose a Template" entry instead, sorted to the top of the picker's community-cards list regardless of what else is installed.
- **Searchable, live-previewed editor** — that single entry's own editor shows a filterable grid of every template on the dashboard, each with a real live preview of the card it would insert, so you can find one without scrolling a row per template.
