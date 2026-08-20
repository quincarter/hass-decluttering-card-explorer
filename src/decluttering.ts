import type { LovelaceCardConfig } from "custom-card-helpers";
import type { DeclutteringTemplate, DeclutteringTemplates, TemplateMeta } from "./types";

const PLACEHOLDER_RE = /\[\[([a-zA-Z0-9_]+)\]\]/g;

export function safeTagName(name: string): string {
  const lowered = name.toLowerCase();
  const replaced = lowered.replace(/[^a-z0-9-]/g, "-");
  const collapsed = replaced.replace(/-+/g, "-");
  const trimmed = collapsed.replace(/^-+|-+$/g, "");
  if (trimmed === "") return trimmed;
  return /^[0-9]/.test(trimmed) ? `t-${trimmed}` : trimmed;
}

export function extractTemplates(config: {
  decluttering_templates?: DeclutteringTemplates;
}): DeclutteringTemplates {
  return config.decluttering_templates ?? {};
}

export class LovelaceUnavailableError extends Error {
  constructor(message = "hass.lovelace.config is unavailable") {
    super(message);
    this.name = "LovelaceUnavailableError";
  }
}

type RawLovelaceConfig = { decluttering_templates?: DeclutteringTemplates; views?: unknown[] };

type HassWithLovelace = {
  lovelace?: {
    config?: RawLovelaceConfig;
  };
};

/**
 * Shared by getDeclutteringTemplates and resolveDashboardConfig so the
 * hass?.lovelace?.config null-check/throw lives in exactly one place — the former
 * wants just the extracted templates map, the latter wants the raw config (it also
 * reads `views` off it), but both need the same "is the primary path even usable"
 * decision.
 */
function getRawLovelaceConfig(hass: HassWithLovelace | undefined | null): RawLovelaceConfig {
  const config = hass?.lovelace?.config;
  if (!config) {
    throw new LovelaceUnavailableError();
  }
  return config;
}

/**
 * Storage-mode and YAML-mode dashboards both expose decluttering_templates at
 * hass.lovelace.config, but hass.lovelace itself can be absent (e.g. before the
 * frontend has attached it, or in contexts where the caller must instead fall back
 * to the lovelace/config websocket command) — the caller, not this function, owns
 * that fallback decision.
 */
export function getDeclutteringTemplates(
  hass: HassWithLovelace | undefined | null,
): DeclutteringTemplates {
  return extractTemplates(getRawLovelaceConfig(hass));
}

/**
 * `default` can be a flat object or an array of single-key objects (decluttering-card
 * accepts both). Flattening to a single map lets buildStubConfig and analyzeTemplates
 * share the same "what defaults exist" logic without duplicating the merge rules.
 */
function flattenDefault(templateDefault: DeclutteringTemplate["default"]): Record<string, unknown> {
  if (templateDefault === undefined) return {};
  if (Array.isArray(templateDefault)) {
    const merged: Record<string, unknown> = {};
    for (const entry of templateDefault) {
      Object.assign(merged, entry);
    }
    return merged;
  }
  if (typeof templateDefault !== "object" || templateDefault === null) return {};
  return { ...templateDefault };
}

function mapToVariableArray(map: Record<string, unknown>): Array<Record<string, unknown>> {
  return Object.entries(map).map(([key, value]) => ({ [key]: value }));
}

export function buildStubConfig(name: string, template: DeclutteringTemplate): LovelaceCardConfig {
  const flattened = flattenDefault(template.default);
  return {
    type: "custom:decluttering-card",
    template: name,
    variables: mapToVariableArray(flattened),
  } as LovelaceCardConfig;
}

function findPlaceholders(templateBody: unknown): string[] {
  const serialized = JSON.stringify(templateBody ?? {});
  const found: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((match = PLACEHOLDER_RE.exec(serialized)) !== null) {
    const variableName = match[1];
    if (!seen.has(variableName)) {
      seen.add(variableName);
      found.push(variableName);
    }
  }
  return found;
}

type HassWithCallWS = HassWithLovelace & {
  callWS?: <T>(msg: { type: string } & Record<string, unknown>) => Promise<T>;
};

/**
 * `hass.lovelace` is never actually populated on the `hass` object a plain
 * Lovelace card element receives (see getDeclutteringTemplates' comment above), so
 * the primary attempt here almost always falls through to the `lovelace/config`
 * websocket call in practice — but it's kept first since some contexts genuinely do
 * have it. Returns the *raw* dashboard config object (not narrowed to just
 * decluttering_templates) so callers can also read `views` off it, e.g. to locate a
 * `custom:decluttering-selector` card via findDeclutteringSelectorConfig below.
 */
export async function resolveDashboardConfig(
  hass: HassWithCallWS | undefined | null,
  urlPath: string | undefined,
): Promise<RawLovelaceConfig> {
  try {
    getDeclutteringTemplates(hass);
    return getRawLovelaceConfig(hass);
  } catch (err) {
    if (!(err instanceof LovelaceUnavailableError)) throw err;
    // hass.lovelace.config genuinely unavailable in this context — fall through
    // to the lovelace/config websocket path below, per getDeclutteringTemplates'
    // own doc comment: the caller owns that fallback decision.
  }

  if (typeof hass?.callWS !== "function") return {};

  try {
    const result = await hass.callWS<RawLovelaceConfig>({
      type: "lovelace/config",
      url_path: urlPath,
    });
    return result ?? {};
  } catch (err) {
    // Pre-migration instances may only have the unnamed default dashboard
    // (url_path omitted entirely), not one registered under "lovelace" yet.
    // Only retry that specific, narrow case — retrying for any other url_path
    // would silently re-fetch the wrong (default) dashboard's config.
    const code = (err as { code?: string } | undefined)?.code;
    if (urlPath === "lovelace" && code === "config_not_found") {
      console.warn(
        'decluttering-selector: no dashboard registered at url_path "lovelace"; falling back ' +
          "to the instance's unnamed default dashboard config (pre-migration HA instance). " +
          "If this isn't the dashboard you're viewing, its templates won't be registered.",
      );
      const result = await hass.callWS<RawLovelaceConfig>({ type: "lovelace/config" });
      return result ?? {};
    }
    throw err;
  }
}

type DeclutteringSelectorFoundConfig = Record<string, unknown>;

function findInCardsArray(
  cards: unknown,
  visited: Set<object>,
): DeclutteringSelectorFoundConfig | undefined {
  if (!Array.isArray(cards)) return undefined;
  if (visited.has(cards)) return undefined;
  visited.add(cards);
  for (const card of cards) {
    const found = findInCard(card, visited);
    if (found) return found;
  }
  return undefined;
}

function findInCard(
  card: unknown,
  visited: Set<object>,
): DeclutteringSelectorFoundConfig | undefined {
  if (typeof card !== "object" || card === null) return undefined;
  if (visited.has(card)) return undefined;
  visited.add(card);
  const record = card as Record<string, unknown>;
  if (record.type === "custom:decluttering-selector") {
    const { type: _type, ...rest } = record;
    return rest;
  }
  return findInCardsArray(record.cards, visited);
}

/**
 * Scans every view (cards, badges, nested stack cards at arbitrary depth, and
 * sections[].cards for sections-view dashboards) for the first
 * `custom:decluttering-selector` card, used by the global bootstrap to decide
 * whether/how to register — malformed or missing `views` must never throw here since
 * this runs unattended at module load, with no per-instance render guard around it.
 * A `visited` set of already-descended-into object references guards against
 * circular configs (e.g. a stack card whose own `cards` array contains itself or an
 * ancestor) degrading to "no further match found" there instead of recursing forever.
 */
export function findDeclutteringSelectorConfig(config: {
  views?: unknown[];
}): DeclutteringSelectorFoundConfig | undefined {
  const views = config?.views;
  if (!Array.isArray(views)) return undefined;

  const visited = new Set<object>();

  for (const view of views) {
    if (typeof view !== "object" || view === null) continue;
    if (visited.has(view)) continue;
    visited.add(view);
    const record = view as Record<string, unknown>;

    const fromCards = findInCardsArray(record.cards, visited);
    if (fromCards) return fromCards;

    const fromBadges = findInCardsArray(record.badges, visited);
    if (fromBadges) return fromBadges;

    if (Array.isArray(record.sections) && !visited.has(record.sections)) {
      visited.add(record.sections);
      for (const section of record.sections) {
        if (typeof section !== "object" || section === null) continue;
        if (visited.has(section)) continue;
        visited.add(section);
        const fromSectionCards = findInCardsArray(
          (section as Record<string, unknown>).cards,
          visited,
        );
        if (fromSectionCards) return fromSectionCards;
      }
    }
  }

  return undefined;
}

export function analyzeTemplates(templates: DeclutteringTemplates): TemplateMeta[] {
  return Object.entries(templates).map(([name, template]) => {
    const flattenedDefaults = flattenDefault(template.default);
    const placeholders = findPlaceholders(template.card ?? template.element ?? {});
    const requiredVariables = placeholders.filter(
      (variableName) => !(variableName in flattenedDefaults),
    );

    return {
      name,
      safeName: safeTagName(name),
      variableCount: placeholders.length,
      requiredVariables,
      stubConfig: buildStubConfig(name, template),
    };
  });
}
