import {
  analyzeTemplates,
  extractTemplates,
  findDeclutteringSelectorConfig,
  resolveDashboardConfig,
} from "./decluttering";
import { registerAll, registerTemplatePickerCard } from "./register";
import type { DeclutteringTemplates } from "./types";

type HassLike = {
  panels?: Record<string, { component_name?: string } | undefined>;
  lovelace?: { config?: { decluttering_templates?: DeclutteringTemplates } };
  callWS?: <T>(msg: { type: string } & Record<string, unknown>) => Promise<T>;
  connection?: {
    subscribeEvents?: (cb: () => void, event: string) => Promise<() => void>;
  };
};

/**
 * The `lovelace/config` WS command does a flat lookup keyed by `url_path`; omitting
 * it doesn't mean "current dashboard" — it always resolves to the instance's
 * built-in default dashboard. So the card has to determine which dashboard it's
 * actually being viewed on itself. `window.location.pathname`'s first segment is
 * usually the dashboard's `url_path`, but under a reverse-proxy path prefix that
 * segment could be something else — cross-checking against `hass.panels` (every
 * Lovelace dashboard panel, default or custom, has `component_name === 'lovelace'`)
 * finds the real one regardless of leading path segments.
 */
export function getCurrentDashboardUrlPath(hass: HassLike | undefined): string | undefined {
  const segments = window.location.pathname.split("/").filter(Boolean);
  for (const segment of segments) {
    if (hass?.panels?.[segment]?.component_name === "lovelace") {
      return segment;
    }
  }
  return segments[0];
}

// `document.querySelector("home-assistant")?.hass` is a real (if undocumented)
// pattern other custom cards rely on for view-independent access to `hass` — HA
// dispatches no global "hass ready/changed" event, so this is only usable as a
// one-time bootstrap read, not a live-update source. Ongoing updates instead flow
// through `hass.connection.subscribeEvents('lovelace_updated', ...)` below, the same
// public API the per-instance loader card already uses.
const MAX_ATTEMPTS = 10;
const RETRY_INTERVAL_MS = 200;

let initialized = false;
let subscribed = false;

async function runRegistration(hass: HassLike): Promise<void> {
  const urlPath = getCurrentDashboardUrlPath(hass);
  const config = await resolveDashboardConfig(hass, urlPath);
  const loaderConfig = findDeclutteringSelectorConfig(config);
  // Strictly opt-in: nothing on this dashboard asked to be registered, so do
  // nothing — matches the per-instance loader card's own scoping.
  if (!loaderConfig) return;

  const metas = analyzeTemplates(extractTemplates(config));
  registerAll(metas, { registerCards: loaderConfig.dedicated_picker !== true });
  registerTemplatePickerCard(loaderConfig.dedicated_picker === true);
}

function subscribeToUpdates(hass: HassLike): void {
  if (subscribed) return;
  const subscribeEvents = hass.connection?.subscribeEvents;
  if (typeof subscribeEvents !== "function") return;
  subscribed = true;
  subscribeEvents(() => {
    void runRegistration(hass).catch(() => {
      // best-effort re-registration; a failed dashboard-save re-read shouldn't
      // throw into HA's event-dispatch machinery
    });
  }, "lovelace_updated").catch(() => {
    subscribed = false;
  });
}

async function bootstrap(hass: HassLike): Promise<void> {
  try {
    await runRegistration(hass);
  } catch {
    // Never throw — this runs unattended at module load, with no per-instance
    // render/try-catch guard anywhere above it in the call stack.
  }
  try {
    subscribeToUpdates(hass);
  } catch {
    // Subscription setup is best-effort too.
  }
}

function pollForHass(root: Element & { hass?: unknown }, attempt: number): void {
  const hass = root.hass as HassLike | undefined;
  if (hass) {
    void bootstrap(hass);
    return;
  }
  if (attempt >= MAX_ATTEMPTS) return;
  setTimeout(() => pollForHass(root, attempt + 1), RETRY_INTERVAL_MS);
}

/**
 * Entry point, called once at module load (see `decluttering-selector.ts`). Reads
 * the *full* dashboard config (every view, since it's static data) independent of
 * whether a `decluttering-selector` loader card instance is actually mounted —
 * HA's Lovelace panel only ever constructs the currently active view's cards, so a
 * loader card on a non-active view/tab would otherwise never run its registration
 * logic until that tab is visited.
 */
export function initGlobalRegistration(): void {
  if (initialized) return;
  initialized = true;

  const root = document.querySelector("home-assistant") as (Element & { hass?: unknown }) | null;
  if (!root) return;

  const hass = root.hass as HassLike | undefined;
  if (hass) {
    void bootstrap(hass);
    return;
  }

  setTimeout(() => pollForHass(root, 1), RETRY_INTERVAL_MS);
}
