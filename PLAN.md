# Decluttering Explorer Card — Implementation Plan

> **Context for the implementer (Claude or any dev agent):** This is a **HACS custom Lovelace card** for Home Assistant, written in **TypeScript + Lit 3**, bundled with **Vite** into a single ES module. It is intended to be executed by a coding agent (e.g. Claude Code) on a different machine — there is **no Hermes/Hermes-specific tooling assumed**. Work the tasks sequentially; each task is independently verifiable. A real HA instance (or the dev mock in Phase 6) is needed only for final manual verification, not for the unit-testable logic.

**Goal:** Build a read-only Lovelace card that lists every `decluttering_templates` entry defined on the current dashboard, shows each template's variables/defaults, how many times it is used, expands to show the raw YAML, and offers a "Copy YAML" button — eliminating the need to dig through dashboard YAML by hand.

**Architecture:** A single bundled ES module registers one custom element `decluttering-explorer-card`. All UI state lives in **Preact signals** (`@preact/signals-core`) and is read reactively inside the Lit render via the official `@lit-labs/preact-signals` `SignalWatcher` mixin. A pure, unit-tested data layer reads the dashboard config (from `hass.lovelace.config`, falling back to the `lovelace/config` websocket), parses `decluttering_templates`, walks the card tree to count usages, and writes the results into the signals. **v1 is strictly read-only** — no writes to HA config.

**Tech Stack (pin to these; verify latest patch at install):**
- `lit@3.3.3`
- `@preact/signals-core@1.14.4`
- `@lit-labs/preact-signals@1.0.3` (provides `SignalWatcher`)
- `custom-card-helpers` (latest) — for `HomeAssistant`, `LovelaceCard`, `LovelaceConfig` types
- `js-yaml` (latest) — YAML serialization for the "Copy YAML" feature
- `vite@8.2.1` (dev/build), `typescript@latest`, `vitest@latest` (tests)

---

## Background (so the code makes sense)

`decluttering-card` (https://github.com/custom-cards/decluttering-card) lets users define reusable card templates in a `decluttering_templates` object at the **root of a dashboard's Lovelace config**. Shape:

```yaml
decluttering_templates:
  my_template:
    default:            # optional
      - icon: fire
    card:               # OR `element:` for picture-elements
      type: custom:button-card
      name: '[[name]]'
      icon: 'mdi:[[icon]]'
```

A template is *used* by a card of `type: custom:decluttering-card` with a `template:` field. The pain point: there is no UI to see what templates exist, their variables, or where they're used — you must read the dashboard YAML. This card fixes that.

**Two dashboard modes (both handled automatically):**
- **Storage mode** (UI-managed dashboards): `hass.lovelace.config` contains the live config.
- **YAML mode**: same object is available; `lovelace/config` websocket also returns it.
- **Cross-dashboard** (all dashboards) is **out of scope for v1** (that is Shape B / a future version).

---

## Project Structure

```
decluttering-explorer-card/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── hacs.json
├── info.md                      # HACS store listing
├── README.md                    # Install + dev instructions
├── src/
│   ├── decluttering-explorer-card.ts   # main element
│   ├── decluttering-explorer-card-editor.ts  # minimal config editor
│   ├── decluttering.ts          # PURE parse/count logic (unit-tested)
│   ├── lovelace.ts              # config fetch + signal population
│   ├── state.ts                 # Preact signals (single source of truth)
│   └── types.ts                 # local types
├── tests/
│   └── decluttering.test.ts     # Vitest unit tests (TDD)
└── dev/
    ├── index.html               # loads the card with a mock hass
    └── mock-hass.ts             # fake HomeAssistant object for fast iteration
```

---

## Phase 0 — Scaffold

### Task 1: `package.json`
**Objective:** Declare deps + scripts.

**Files:** Create `package.json`

```json
{
  "name": "decluttering-explorer-card",
  "version": "0.1.0",
  "description": "Lovelace card that explores your decluttering-card templates",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@lit-labs/preact-signals": "1.0.3",
    "@preact/signals-core": "1.14.4",
    "custom-card-helpers": "^1.9.0",
    "js-yaml": "^4.1.0",
    "lit": "3.3.3"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vite": "8.2.1",
    "vitest": "^2.1.0",
    "@types/js-yaml": "^4.0.9"
  }
}
```
**Step:** `npm install`
**Verify:** `npm install` exits 0; `node -e "require('lit/package.json')"` resolves.

### Task 2: `tsconfig.json`, `vite.config.ts`, `.gitignore`
**Files:** Create the three.

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2021", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src", "tests", "dev"]
}
```
Note: `experimentalDecorators: true` + `useDefineForClassFields: false` is the required combo for Lit decorators (`@property`, `@customElement`).

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    lib: {
      entry: 'src/decluttering-explorer-card.ts',
      formats: ['es'],
      fileName: () => 'decluttering-explorer-card.js',
    },
    minify: true,
  },
});
```
This produces a **single self-contained ES module** (`dist/decluttering-explorer-card.js`) with Lit + signals bundled in — exactly what HACS consumes.

`.gitignore`: `node_modules/`, `dist/`.

---

## Phase 1 — Pure parse/count logic (TDD)

### Task 3: `src/types.ts`
**Objective:** Shared types.

```ts
import type { LovelaceConfig } from 'custom-card-helpers';

export interface DeclutteringTemplate {
  name: string;
  body: Record<string, unknown> | null; // the `card` or `element` config
  isElement: boolean;
  variables: string[];         // all [[var]] found in body
  defaults: string[];          // variable names that have a default
  requiredVariables: string[]; // variables WITHOUT a default
  usageCount: number;
  raw: unknown;                // original template object (for YAML export)
}

export interface CardConfig {
  type: string;
  title?: string;
}
```

### Task 4: `tests/decluttering.test.ts` (write FIRST — TDD)
**Objective:** Pin the parsing/counting behavior before implementing it.

```ts
import { describe, it, expect } from 'vitest';
import { parseTemplates, countUsages, extractVariables, extractDefaultVars } from '../src/decluttering';

const config = {
  decluttering_templates: {
    tpA: {
      default: [{ icon: 'fire' }],
      card: { type: 'custom:button-card', name: '[[name]]', icon: 'mdi:[[icon]]' },
    },
    tpB: {
      element: { type: 'icon', icon: '[[noDefault]]' },
    },
  },
  views: [
    {
      cards: [
        { type: 'custom:decluttering-card', template: 'tpA', variables: [{ name: 'x' }] },
        { type: 'vertical-stack', cards: [
          { type: 'custom:decluttering-card', template: 'tpA' },
        ]},
        { type: 'custom:button-card' },
      ],
      badges: [{ type: 'custom:decluttering-card', template: 'tpB' }],
    },
  ],
} as any;

describe('extractVariables', () => {
  it('finds [[var]] tokens', () => {
    expect(extractVariables({ a: '[[name]]', b: 'mdi:[[icon]]' }).sort()).toEqual(['icon', 'name']);
  });
});

describe('extractDefaultVars', () => {
  it('reads keys from default array-of-maps', () => {
    expect(extractDefaultVars([{ icon: 'fire' }, { foo: 'bar' }])).toEqual(['icon', 'foo']);
  });
});

describe('countUsages', () => {
  it('counts decluttering-card usages recursively', () => {
    const c = countUsages(config);
    expect(c.tpA).toBe(2);
    expect(c.tpB).toBe(1);
  });
});

describe('parseTemplates', () => {
  it('produces one entry per template with correct metadata', () => {
    const t = parseTemplates(config);
    const a = t.find(x => x.name === 'tpA')!;
    expect(a.variables.sort()).toEqual(['icon', 'name']);
    expect(a.defaults).toEqual(['icon']);
    expect(a.requiredVariables).toEqual(['name']);
    expect(a.usageCount).toBe(2);
    const b = t.find(x => x.name === 'tpB')!;
    expect(b.isElement).toBe(true);
    expect(b.requiredVariables).toEqual(['noDefault']);
  });
});
```

### Task 5: `src/decluttering.ts` (make tests pass)
**Objective:** Implement the pure logic.

```ts
import type { LovelaceConfig } from 'custom-card-helpers';
import type { DeclutteringTemplate } from './types';

const VAR_RE = /\[\[([^\]]+?)\]\]/g;

export function extractVariables(body: unknown): string[] {
  const json = JSON.stringify(body ?? {});
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  VAR_RE.lastIndex = 0;
  while ((m = VAR_RE.exec(json)) !== null) found.add(m[1].trim());
  return [...found];
}

export function extractDefaultVars(defaults: unknown): string[] {
  if (!Array.isArray(defaults)) return [];
  const names: string[] = [];
  for (const entry of defaults) {
    if (entry && typeof entry === 'object') {
      names.push(...Object.keys(entry as Record<string, unknown>));
    }
  }
  return names;
}

export function countUsages(config: LovelaceConfig): Record<string, number> {
  const counts: Record<string, number> = {};
  const walk = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.type === 'custom:decluttering-card' && typeof node.template === 'string') {
      counts[node.template] = (counts[node.template] ?? 0) + 1;
    }
    for (const key of ['cards', 'badges', 'sections', 'elements', 'card']) {
      if (node[key]) walk(node[key]);
    }
  };
  walk((config as any).views);
  return counts;
}

export function parseTemplates(config: LovelaceConfig): DeclutteringTemplate[] {
  const raw = (config as any)?.decluttering_templates ?? {};
  const counts = countUsages(config);
  return Object.entries(raw)
    .map(([name, tpl]: [string, any]) => {
      const body = tpl?.card ?? tpl?.element ?? null;
      const isElement = !!tpl?.element && !tpl?.card;
      const variables = extractVariables(body);
      const defaults = extractDefaultVars(tpl?.default);
      return {
        name,
        body,
        isElement,
        variables,
        defaults,
        requiredVariables: variables.filter(v => !defaults.includes(v)),
        usageCount: counts[name] ?? 0,
        raw: tpl,
      } as DeclutteringTemplate;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
```

### Task 6: Run tests
**Run:** `npm run test`
**Expected:** all 4 describe blocks pass (6 assertions).

---

## Phase 2 — Lovelace data layer + signals

### Task 7: `src/state.ts`
**Objective:** Single source of truth as Preact signals.

```ts
import { signal } from '@preact/signals-core';
import type { DeclutteringTemplate } from './types';

export const templatesSignal = signal<DeclutteringTemplate[]>([]);
export const loadingSignal = signal(false);
export const errorSignal = signal<string | null>(null);
export const expandedSignal = signal<Set<string>>(new Set());
```

### Task 8: `src/lovelace.ts`
**Objective:** Fetch current dashboard config, parse into signals, live-refresh on save.

```ts
import type { HomeAssistant, LovelaceConfig } from 'custom-card-helpers';
import { parseTemplates } from './decluttering';
import { templatesSignal, loadingSignal, errorSignal } from './state';

let unsub: (() => void) | null = null;

export async function loadTemplates(hass: HomeAssistant): Promise<void> {
  loadingSignal.value = true;
  errorSignal.value = null;
  try {
    const config = await getDashboardConfig(hass);
    templatesSignal.value = parseTemplates(config);
  } catch (e) {
    errorSignal.value = (e as Error).message ?? String(e);
  } finally {
    loadingSignal.value = false;
  }
}

async function getDashboardConfig(hass: HomeAssistant): Promise<LovelaceConfig> {
  // Live object for the currently-viewed dashboard (storage + yaml modes).
  const ll = (hass as any).lovelace;
  if (ll?.config) return ll.config as LovelaceConfig;
  // WS fallback; returns default dashboard when url_path omitted. Read-only, no admin needed.
  return (await hass.callWS({ type: 'lovelace/config' } as any)) as LovelaceConfig;
}

export async function subscribeLovelaceUpdates(hass: HomeAssistant): Promise<void> {
  if (unsub) { (await unsub)(); unsub = null; }
  // `lovelace_updated` fires on dashboard save → re-read.
  unsub = await hass.connection.subscribeEvents(
    () => void loadTemplates(hass),
    'lovelace_updated',
  );
}
```

---

## Phase 3 — Card UI (Lit 3 + SignalWatcher)

### Task 9: `src/decluttering-explorer-card.ts`
**Objective:** The custom element. Reads signals reactively via `SignalWatcher`.

```ts
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import yaml from 'js-yaml';
import type { HomeAssistant, LovelaceCard } from 'custom-card-helpers';
import {
  templatesSignal, loadingSignal, errorSignal, expandedSignal,
} from './state';
import { loadTemplates, subscribeLovelaceUpdates } from './lovelace';
import type { CardConfig, DeclutteringTemplate } from './types';
import './decluttering-explorer-card-editor';

@customElement('decluttering-explorer-card')
export class DeclutteringExplorerCard extends SignalWatcher(LitElement) implements LovelaceCard {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public _config!: CardConfig;
  private _subscribed = false;

  public setConfig(config: CardConfig): void {
    this._config = config;
  }

  public static async getStubConfig(): Promise<CardConfig> {
    return { type: 'custom:decluttering-explorer-card' };
  }

  // HA editor registration (optional but recommended):
  public static getConfigElement(): HTMLElement {
    return document.createElement('decluttering-explorer-card-editor');
  }

  public getCardSize(): number {
    return Math.max(1, templatesSignal.value.length * 2 + 2);
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this._ensureLoaded();
  }

  public updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    if (changed.has('hass')) this._ensureLoaded();
  }

  private _ensureLoaded(): void {
    if (this.hass && !this._subscribed) {
      this._subscribed = true;
      void loadTemplates(this.hass);
      void subscribeLovelaceUpdates(this.hass);
    }
  }

  private _toggle(name: string): void {
    const next = new Set(expandedSignal.value);
    if (next.has(name)) next.delete(name); else next.add(name);
    expandedSignal.value = next;
  }

  private _copy(tpl: DeclutteringTemplate): void {
    navigator.clipboard?.writeText(yaml.dump(tpl.raw));
  }

  render() {
    if (errorSignal.value) {
      return html`<ha-card><p class="error">Error: ${errorSignal.value}</p></ha-card>`;
    }
    if (loadingSignal.value) {
      return html`<ha-card><p>Loading templates…</p></ha-card>`;
    }
    const templates = templatesSignal.value;
    if (!templates.length) {
      return html`<ha-card><p>No decluttering templates defined on this dashboard.</p></ha-card>`;
    }
    return html`
      <ha-card>
        <div class="header">
          <h2>${this._config?.title ?? 'Decluttering Templates'}</h2>
          <button @click=${() => loadTemplates(this.hass)}>Refresh</button>
        </div>
        <ul>
          ${templates.map(t => html`
            <li>
              <div class="row" @click=${() => this._toggle(t.name)}>
                <span class="name">${t.name}</span>
                <span class="badge">${t.usageCount} used</span>
                <span class="vars">${t.requiredVariables.length
                  ? `needs: ${t.requiredVariables.join(', ')}`
                  : 'no required vars'}</span>
              </div>
              ${expandedSignal.value.has(t.name) ? html`
                <pre>${yaml.dump(t.raw)}</pre>
                <button @click=${() => this._copy(t)}>Copy YAML</button>
              ` : nothing}
            </li>`)}
        </ul>
      </ha-card>`;
  }

  static styles = css`
    :host { display: block; }
    ha-card { padding: 12px 16px; }
    .header { display: flex; justify-content: space-between; align-items: center; }
    .header h2 { margin: 0; font-size: 1.1rem; }
    ul { list-style: none; margin: 8px 0 0; padding: 0; }
    li { border-top: 1px solid var(--divider-color, #eee); padding: 8px 0; }
    .row { display: flex; gap: 12px; align-items: center; cursor: pointer; }
    .name { font-weight: 600; }
    .badge { background: var(--primary-color, #03a9f4); color: #fff; border-radius: 10px; padding: 1px 8px; font-size: .8rem; }
    .vars { color: var(--secondary-text-color, #666); font-size: .85rem; }
    pre { background: var(--code-background-color, #f5f5f5); padding: 8px; border-radius: 4px; overflow: auto; max-height: 320px; }
    .error { color: var(--error-color, red); }
    button { cursor: pointer; }
  `;
}
```

### Task 10: `src/decluttering-explorer-card-editor.ts`
**Objective:** Minimal editor so the card is configurable in the UI editor.

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import type { HomeAssistant, LovelaceCardEditor } from 'custom-card-helpers';
import type { CardConfig } from './types';

@customElement('decluttering-explorer-card-editor')
export class DeclutteringExplorerCardEditor extends SignalWatcher(LitElement) implements LovelaceCardEditor {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: CardConfig;

  public setConfig(config: CardConfig): void {
    this._config = config;
  }

  private _change(ev: Event): void {
    const value = (ev.target as HTMLInputElement).value;
    this._config = { ...this._config, title: value };
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
  }

  render() {
    return html`
      <ha-textfield
        label="Card title"
        .value=${this._config?.title ?? ''}
        @change=${this._change}
      ></ha-textfield>`;
  }

  static styles = css`ha-textfield { width: 100%; }`;
}
```

---

## Phase 4 — HACS packaging

### Task 11: `hacs.json`
```json
{
  "name": "Decluttering Explorer Card",
  "render_readme": true,
  "filename": "dist/decluttering-explorer-card.js"
}
```

### Task 12: `info.md` (HACS store listing)
Include: short description, features (list templates, variables/defaults, usage count, expand + copy YAML, live refresh), and install steps:
1. Add this repo to HACS as a custom repository (category: Lovelace).
2. Install "Decluttering Explorer Card".
3. Add the card to a dashboard: `type: custom:decluttering-explorer-card`.

### Task 13: `README.md`
Same as `info.md` plus the **Development** section:
- `npm install`
- `npm run dev` → open `dev/index.html` with the mock hass (fast UI iteration)
- `npm run test` → unit tests
- `npm run build` → outputs `dist/decluttering-explorer-card.js`
- To test against real HA: build, copy `dist/decluttering-explorer-card.js` to HA `/config/www/`, add as a `module` resource, add the card.

---

## Phase 5 — Dev environment + verification

### Task 14: `dev/index.html` + `dev/mock-hass.ts`
**Objective:** Iterate on the UI without a live HA.

`dev/index.html`:
```html
<!doctype html>
<html><head><meta charset="utf-8"><title>Dev</title>
  <script type="module" src="../src/decluttering-explorer-card.ts"></script>
</head><body>
  <decluttering-explorer-card id="card"></decluttering-explorer-card>
  <script type="module" src="./mock-hass.ts"></script>
</body></html>
```

`dev/mock-hass.ts` — construct a fake `HomeAssistant` whose `lovelace.config` is a sample dashboard with `decluttering_templates` + usages, and a no-op `callWS`/`connection.subscribeEvents`. Then:
```ts
const card = document.getElementById('card') as any;
card.hass = mockHass;
card.setConfig({ type: 'custom:decluttering-explorer-card', title: 'Demo' });
```

### Task 15: Build + manual verification
**Run:** `npm run build`
**Verify:** `dist/decluttering-explorer-card.js` exists and is a single bundled ESM (no external imports of `lit`).
**Manual (real HA or full mock):** place the card; confirm it lists templates, shows usage counts, expands YAML, and Copy works. Confirm Refresh + live update after editing a template in the raw config editor.

---

## Phase 6 — Polish + commit

### Task 16: Final cleanup
- Ensure `npm run test` green and `npm run build` succeeds.
- Add a short `LICENSE` (MIT) if publishing to HACS.
- Commit per phase with clear messages (`feat: ...`, `test: ...`, `build: ...`).

---

## Risks / Tradeoffs / Open Questions
- **Strategy-based views** (e.g. `view_layout`, `panel` with `strategy`) are not recursed in v1 — the walk covers `views[].cards/badges/sections/elements` and nested stacks, which covers the vast majority. Expand `countUsages` if needed.
- **`hass.lovelace.config`** is the preferred read path; the `lovelace/config` WS call is the fallback. Both are read-only and need no admin. If a future HA version changes `hass.lovelace` shape, the WS fallback keeps it working.
- **v1 is read-only by design.** The "Copy YAML" button delivers the visual-authoring value without touching HA's config-save API (which requires admin and is the risky part). Direct in-card editing/saving is a deliberate v2.
- **Cross-dashboard discovery** (Shape B) is intentionally excluded; `lovelace/dashboards/list` + per-dashboard `lovelace/config?url_path=` is the path for that later version.
- Pinned dep versions are current as of plan authoring; run `npm outdated` and bump if a newer compatible release exists.
