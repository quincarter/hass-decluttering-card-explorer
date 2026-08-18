import type { LovelaceCardConfig } from 'custom-card-helpers';

/** A single `decluttering_templates` entry, in either of decluttering-card's two accepted shapes. */
export interface DeclutteringTemplate {
  /** Card-mode template: the config to stamp out, with `[[var]]` placeholders. */
  card?: Record<string, unknown>;
  /** Element-mode template (picture-elements `element:` usage) instead of `card`. */
  element?: Record<string, unknown>;
  /** Default variable values, applied when a usage doesn't override them. */
  default?: Array<Record<string, unknown>> | Record<string, unknown>;
  /** Explicit list of variable names the template expects (rarely present; usually inferred). */
  variables?: string[];
  /** Entity ids referenced by the template, for HA's entity-usage tracking. */
  entities?: string[];
}

/** The `decluttering_templates` map as it appears on a dashboard's Lovelace config. */
export type DeclutteringTemplates = Record<string, DeclutteringTemplate>;

/** Derived, render-ready metadata for one template, used to build picker entries. */
export interface TemplateMeta {
  /** The template's key in `decluttering_templates`. */
  name: string;
  /** `name` sanitized into a valid custom-element tag suffix. */
  safeName: string;
  /** Count of distinct `[[placeholder]]` variables found in the template body. */
  variableCount: number;
  /** Variables referenced in the template body that have no entry in `default`. */
  requiredVariables: string[];
  /** The pre-filled `custom:decluttering-card` config the picker should insert. */
  stubConfig: LovelaceCardConfig;
}
