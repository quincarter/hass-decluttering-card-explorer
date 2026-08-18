import type { LovelaceCardConfig } from 'custom-card-helpers';
import type { DeclutteringTemplate, DeclutteringTemplates, TemplateMeta } from './types';

const PLACEHOLDER_RE = /\[\[([a-zA-Z0-9_]+)\]\]/g;

export function safeTagName(name: string): string {
  const lowered = name.toLowerCase();
  const replaced = lowered.replace(/[^a-z0-9-]/g, '-');
  const collapsed = replaced.replace(/-+/g, '-');
  const trimmed = collapsed.replace(/^-+|-+$/g, '');
  if (trimmed === '') return trimmed;
  return /^[0-9]/.test(trimmed) ? `t-${trimmed}` : trimmed;
}

export function extractTemplates(config: {
  decluttering_templates?: DeclutteringTemplates;
}): DeclutteringTemplates {
  return config.decluttering_templates ?? {};
}

export class LovelaceUnavailableError extends Error {
  constructor(message = 'hass.lovelace.config is unavailable') {
    super(message);
    this.name = 'LovelaceUnavailableError';
  }
}

type HassWithLovelace = {
  lovelace?: {
    config?: { decluttering_templates?: DeclutteringTemplates };
  };
};

/**
 * Storage-mode and YAML-mode dashboards both expose decluttering_templates at
 * hass.lovelace.config, but hass.lovelace itself can be absent (e.g. before the
 * frontend has attached it, or in contexts where the caller must instead fall back
 * to the lovelace/config websocket command) — the caller, not this function, owns
 * that fallback decision.
 */
export function getDeclutteringTemplates(
  hass: HassWithLovelace | undefined | null
): DeclutteringTemplates {
  const config = hass?.lovelace?.config;
  if (!config) {
    throw new LovelaceUnavailableError();
  }
  return extractTemplates(config);
}

/**
 * `default` can be a flat object or an array of single-key objects (decluttering-card
 * accepts both). Flattening to a single map lets buildStubConfig and analyzeTemplates
 * share the same "what defaults exist" logic without duplicating the merge rules.
 */
function flattenDefault(
  templateDefault: DeclutteringTemplate['default']
): Record<string, unknown> {
  if (templateDefault === undefined) return {};
  if (Array.isArray(templateDefault)) {
    const merged: Record<string, unknown> = {};
    for (const entry of templateDefault) {
      Object.assign(merged, entry);
    }
    return merged;
  }
  if (typeof templateDefault !== 'object' || templateDefault === null) return {};
  return { ...templateDefault };
}

function mapToVariableArray(map: Record<string, unknown>): Array<Record<string, unknown>> {
  return Object.entries(map).map(([key, value]) => ({ [key]: value }));
}

export function buildStubConfig(
  name: string,
  template: DeclutteringTemplate
): LovelaceCardConfig {
  const flattened = flattenDefault(template.default);
  return {
    type: 'custom:decluttering-card',
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

export function analyzeTemplates(templates: DeclutteringTemplates): TemplateMeta[] {
  return Object.entries(templates).map(([name, template]) => {
    const flattenedDefaults = flattenDefault(template.default);
    const placeholders = findPlaceholders(template.card ?? template.element ?? {});
    const requiredVariables = placeholders.filter(
      (variableName) => !(variableName in flattenedDefaults)
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
