import { LitElement, html } from "lit";
import type { TemplateMeta } from "./types";

interface CustomCardEntry {
  type: string;
  name: string;
  description?: string;
  preview?: boolean;
}

declare global {
  interface Window {
    customCards?: CustomCardEntry[];
  }
}

// Keyed by custom-element tag so a defined class (which can only ever be defined
// once) always reads the current meta at call time instead of closing over the
// meta it was first defined with.
const currentMetaByTag = new Map<string, TemplateMeta>();

export function makePreviewElement(tag: string, meta: TemplateMeta): typeof LitElement {
  if (!currentMetaByTag.has(tag)) {
    currentMetaByTag.set(tag, meta);
  }

  return class DeclutteringPreviewElement extends LitElement {
    static async getStubConfig(): Promise<unknown> {
      return (currentMetaByTag.get(tag) ?? meta).stubConfig;
    }

    render() {
      try {
        const current = currentMetaByTag.get(tag) ?? meta;
        const name =
          typeof current?.name === "string" && current.name.length > 0 ? current.name : "Template";
        const variableCount =
          typeof current?.variableCount === "number" ? current.variableCount : 0;
        return html`<div>${name} — ${variableCount} var(s)</div>`;
      } catch {
        return html`<div>Template</div>`;
      }
    }
  };
}

export function registerTemplate(
  meta: TemplateMeta,
  options?: { registerCard?: boolean }
): void {
  const registerCard = options?.registerCard ?? true;
  const type = `decluttering-card-${meta.safeName}`;
  // HA's custom-card resolution (getLovelaceElementClass) does
  // `customElements.get(stripCustomPrefix(config.type))` directly — no `hui-card-`
  // or `hui-` prefix. That prefix convention only applies to HA's own built-in card
  // types (resolved via a completely different `hui-${type}-card` code path), never
  // to `window.customCards`-registered types. The tag must match `type` exactly.
  const tag = type;

  const owner = currentMetaByTag.get(tag);
  if (owner && owner.name !== meta.name) {
    // Tag already claimed by a different template name: sanitized-name collision,
    // skip entirely so the first registrant's picker entry isn't overwritten.
    return;
  }

  // Bookkeeping (currentMetaByTag) and the custom-element definition are needed by
  // getRegisteredMetas() and the picker's stub-config resolution respectively even
  // when the per-template window.customCards entry is suppressed (dedicated-picker
  // mode) — only the customCards entry itself is mode-dependent below.
  currentMetaByTag.set(tag, meta);

  if (!customElements.get(tag)) {
    customElements.define(tag, makePreviewElement(tag, meta));
  }

  if (!Array.isArray(window.customCards)) {
    window.customCards = [];
  }

  const existingIndex = window.customCards.findIndex((c) => c.type === type);

  if (!registerCard) {
    if (existingIndex !== -1) {
      window.customCards.splice(existingIndex, 1);
    }
    return;
  }

  const entry: CustomCardEntry = {
    type,
    // HA's Add Card picker has no per-entry category/group field — every
    // window.customCards entry flattens alphabetically into one "Community cards"
    // list. Prefixing the name clusters all decluttering templates together there
    // instead of scattering them under each template's own name.
    name: `Decluttering: ${meta.name}`,
    description: `Insert a "${meta.name}" card (${meta.variableCount} var(s)) from your decluttering templates.`,
    preview: true,
  };

  if (existingIndex === -1) {
    window.customCards.push(entry);
  } else {
    window.customCards[existingIndex] = entry;
  }
}

export function getRegisteredMetas(): TemplateMeta[] {
  return [...currentMetaByTag.values()];
}

/**
 * Idempotently adds (`register: true`) or removes (`register: false`) the single
 * "dedicated picker" wrapper entry in window.customCards. Symmetric and explicit —
 * no default — so decluttering-selector.ts can toggle it cleanly whenever its
 * `dedicated_picker` config flag changes, without ever leaking a stale entry behind.
 *
 * The name is deliberately prefixed with a literal "0 " (distinct from the
 * "Decluttering: " clustering prefix used by per-template entries): the native
 * picker's "Community cards" list is sorted alphabetically across every installed
 * custom card, and a leading digit sorts before both upper- and lower-case ASCII
 * letters, guaranteeing this entry lands first regardless of what else is installed.
 */
export function registerTemplatePickerCard(register: boolean): void {
  if (!Array.isArray(window.customCards)) {
    window.customCards = [];
  }

  const type = "decluttering-template-picker";
  const existingIndex = window.customCards.findIndex((c) => c.type === type);

  if (!register) {
    if (existingIndex !== -1) {
      window.customCards.splice(existingIndex, 1);
    }
    return;
  }

  if (existingIndex !== -1) {
    return;
  }

  const entry: CustomCardEntry = {
    type,
    name: "0 Decluttering: Choose a Template",
    description: "Opens a template chooser to pick from your decluttering templates.",
    preview: true,
  };

  window.customCards.push(entry);
}

export function registerAll(
  metas: TemplateMeta[],
  options?: { registerCards?: boolean }
): string[] {
  const registerCards = options?.registerCards ?? true;
  const namesInBatch = new Set(metas.map((m) => m.name));
  for (const [tag, owner] of currentMetaByTag) {
    if (!namesInBatch.has(owner.name)) {
      currentMetaByTag.delete(tag);
      if (Array.isArray(window.customCards)) {
        const staleIndex = window.customCards.findIndex((c) => c.type === tag);
        if (staleIndex !== -1) {
          window.customCards.splice(staleIndex, 1);
        }
      }
    }
  }

  const types: string[] = [];
  for (const meta of metas) {
    registerTemplate(meta, { registerCard: registerCards });
    types.push(`decluttering-card-${meta.safeName}`);
  }
  return types;
}
