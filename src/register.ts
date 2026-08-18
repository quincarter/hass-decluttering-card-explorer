import { LitElement, html } from 'lit';
import type { TemplateMeta } from './types';

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
        const name = typeof current?.name === 'string' && current.name.length > 0 ? current.name : 'Template';
        const variableCount = typeof current?.variableCount === 'number' ? current.variableCount : 0;
        return html`<div>${name} — ${variableCount} var(s)</div>`;
      } catch {
        return html`<div>Template</div>`;
      }
    }
  };
}

export function registerTemplate(meta: TemplateMeta): void {
  const type = `decluttering-card-${meta.safeName}`;
  const tag = `hui-card-${type}`;

  const owner = currentMetaByTag.get(tag);
  if (owner && owner.name !== meta.name) {
    // Tag already claimed by a different template name: sanitized-name collision,
    // skip entirely so the first registrant's picker entry isn't overwritten.
    return;
  }

  currentMetaByTag.set(tag, meta);

  if (!customElements.get(tag)) {
    customElements.define(tag, makePreviewElement(tag, meta));
  }

  if (!Array.isArray(window.customCards)) {
    window.customCards = [];
  }

  const entry: CustomCardEntry = {
    type,
    name: meta.name,
    description: `Insert a "${meta.name}" card (${meta.variableCount} var(s)) from your decluttering templates.`,
    preview: true,
  };

  const existingIndex = window.customCards.findIndex((c) => c.type === type);
  if (existingIndex === -1) {
    window.customCards.push(entry);
  } else {
    window.customCards[existingIndex] = entry;
  }
}

export function registerAll(metas: TemplateMeta[]): string[] {
  const namesInBatch = new Set(metas.map((m) => m.name));
  for (const [tag, owner] of currentMetaByTag) {
    if (!namesInBatch.has(owner.name)) {
      currentMetaByTag.delete(tag);
    }
  }

  const types: string[] = [];
  for (const meta of metas) {
    registerTemplate(meta);
    types.push(`decluttering-card-${meta.safeName}`);
  }
  return types;
}
