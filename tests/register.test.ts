import { describe, it, expect, beforeEach } from 'vitest';
import { makePreviewElement, registerTemplate, registerAll } from '../src/register';
import type { TemplateMeta } from '../src/types';

interface CustomCardEntry {
  type: string;
  name: string;
  description?: string;
  preview?: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var customCards: CustomCardEntry[] | undefined;
}

// HA's custom-card resolution does `customElements.get(stripCustomPrefix(type))`
// directly — no `hui-card-`/`hui-` prefix (that convention is only for HA's own
// built-in card types, a different code path). So the registered custom-element tag
// must be exactly the same string as the window.customCards `type` field.
function typeFor(meta: TemplateMeta): string {
  return `decluttering-card-${meta.safeName}`;
}

function tagFor(meta: TemplateMeta): string {
  return typeFor(meta);
}

function makeMeta(safeName: string, overrides: Partial<TemplateMeta> = {}): TemplateMeta {
  const name = overrides.name ?? `Template ${safeName}`;
  return {
    name,
    safeName,
    variableCount: overrides.variableCount ?? 2,
    requiredVariables: overrides.requiredVariables ?? [],
    stubConfig: overrides.stubConfig ?? {
      type: 'custom:decluttering-card',
      template: name,
      variables: [],
    },
  };
}

beforeEach(() => {
  window.customCards = [];
});

describe('makePreviewElement', () => {
  it('returns a class whose static getStubConfig resolves to meta.stubConfig', async () => {
    const meta = makeMeta('preview-stub');
    const tag = 'decluttering-card-preview-stub';
    const Cls = makePreviewElement(tag, meta) as unknown as {
      getStubConfig: () => Promise<unknown>;
    };
    const stub = await Cls.getStubConfig();
    expect(stub).toEqual(meta.stubConfig);
  });

  it('does not throw when render is invoked directly', () => {
    const meta = makeMeta('preview-render-direct');
    const tag = 'decluttering-card-preview-render-direct';
    const Cls = makePreviewElement(tag, meta);
    customElements.define(tag, Cls);
    const el = document.createElement(tag) as unknown as { render: () => unknown };
    expect(() => el.render()).not.toThrow();
  });

  it('does not throw when connected to the DOM and updated', async () => {
    const meta = makeMeta('preview-connect');
    const tag = 'decluttering-card-preview-connect';
    customElements.define(tag, makePreviewElement(tag, meta));
    const el = document.createElement(tag) as unknown as HTMLElement & {
      updateComplete?: Promise<unknown>;
    };
    expect(() => document.body.appendChild(el)).not.toThrow();
    if (el.updateComplete) {
      await expect(el.updateComplete).resolves.toBeTruthy();
    }
    document.body.removeChild(el);
  });
});

describe('registerTemplate', () => {
  it('defines the custom element tag when it does not already exist', () => {
    const meta = makeMeta('reg-define');
    registerTemplate(meta);
    expect(customElements.get(tagFor(meta))).toBeDefined();
  });

  it('defines the custom element at exactly the type string HA would resolve, independent of this test file\'s own tag formula', () => {
    // Deliberately does not use tagFor()/typeFor() — HA resolves a custom card type
    // as customElements.get(stripCustomPrefix(entry.type)) directly (no hui-card-
    // prefix), so this reads entry.type straight from window.customCards and checks
    // customElements against it, matching HA's real behavior rather than whatever
    // formula this test file happens to compute.
    const meta = makeMeta('reg-real-resolution');
    registerTemplate(meta);
    const entry = window.customCards!.find((c) => c.name === meta.name);
    expect(entry).toBeDefined();
    expect(customElements.get(entry!.type)).toBeDefined();
  });

  it('getStubConfig on the registered class returns exactly meta.stubConfig', async () => {
    const meta = makeMeta('reg-stub', {
      stubConfig: {
        type: 'custom:decluttering-card',
        template: 'Reg Stub',
        variables: [{ a: 1 }],
      },
    });
    registerTemplate(meta);
    const Cls = customElements.get(tagFor(meta)) as unknown as {
      getStubConfig: () => Promise<unknown>;
    };
    const stub = await Cls.getStubConfig();
    expect(stub).toEqual(meta.stubConfig);
  });

  it('adds a matching entry to window.customCards', () => {
    const meta = makeMeta('reg-cards', { name: 'My Cool Template' });
    registerTemplate(meta);
    const entry = window.customCards!.find((c) => c.type === typeFor(meta));
    expect(entry).toBeDefined();
    expect(entry?.name).toBe('My Cool Template');
    expect(entry?.preview).toBe(true);
  });

  it('creates window.customCards when it does not already exist', () => {
    delete (window as { customCards?: CustomCardEntry[] }).customCards;
    const meta = makeMeta('reg-create-array');
    registerTemplate(meta);
    expect(Array.isArray(window.customCards)).toBe(true);
    expect(window.customCards!.some((c) => c.type === typeFor(meta))).toBe(true);
  });

  it('does not throw and does not duplicate the customCards entry on repeated registration', () => {
    const meta = makeMeta('reg-idempotent');
    registerTemplate(meta);
    expect(() => registerTemplate(meta)).not.toThrow();
    const matches = window.customCards!.filter((c) => c.type === typeFor(meta));
    expect(matches).toHaveLength(1);
  });

  it('updates the customCards entry in place when re-registering the same template with changed data', () => {
    // Same `name` (the template's identity) across both calls — this is an edit, not
    // a rename-into-collision, so it must update in place rather than being skipped
    // by the collision guard (which keys off `name` differing for the same tag).
    const meta = makeMeta('reg-update', { name: 'Same Name', variableCount: 1 });
    registerTemplate(meta);
    const updated = { ...meta, variableCount: 5 };
    registerTemplate(updated);
    const matches = window.customCards!.filter((c) => c.type === typeFor(meta));
    expect(matches).toHaveLength(1);
    expect(matches[0].description).toContain('5');
  });

  it('does not redefine an existing custom element tag on repeated registration', () => {
    const meta = makeMeta('reg-no-redefine');
    registerTemplate(meta);
    const first = customElements.get(tagFor(meta));
    registerTemplate(meta);
    const second = customElements.get(tagFor(meta));
    expect(second).toBe(first);
  });
});

describe('registerTemplate re-registration with changed data', () => {
  it('updates getStubConfig on the resolved class after re-registering the same template with a different stubConfig', async () => {
    const metaV1 = makeMeta('reg-stale-stub', {
      name: 'Stale Stub Template',
      stubConfig: {
        type: 'custom:decluttering-card',
        template: 'Stale Stub Template',
        variables: [{ a: 1 }],
      },
    });
    registerTemplate(metaV1);

    const metaV2: TemplateMeta = {
      ...metaV1,
      stubConfig: {
        type: 'custom:decluttering-card',
        template: 'Stale Stub Template',
        variables: [{ a: 2 }, { b: 'new' }],
      },
    };
    registerTemplate(metaV2);

    const Cls = customElements.get(tagFor(metaV1)) as unknown as {
      getStubConfig: () => Promise<unknown>;
    };
    const stub = await Cls.getStubConfig();
    expect(stub).toEqual(metaV2.stubConfig);
  });
});

describe('registerTemplate tag collisions', () => {
  it('skips the second registration entirely when two different templates sanitize to the same safeName', async () => {
    const collidingSafeName = 'collision-x';
    const metaFirst = makeMeta(collidingSafeName, {
      name: 'First Collider',
      stubConfig: {
        type: 'custom:decluttering-card',
        template: 'First Collider',
        variables: [{ a: 1 }],
      },
    });
    const metaSecond = makeMeta(collidingSafeName, {
      name: 'Second Collider',
      stubConfig: {
        type: 'custom:decluttering-card',
        template: 'Second Collider',
        variables: [{ b: 2 }],
      },
    });

    registerTemplate(metaFirst);
    registerTemplate(metaSecond);

    const matches = window.customCards!.filter((c) => c.type === typeFor(metaFirst));
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe('First Collider');

    const Cls = customElements.get(tagFor(metaFirst)) as unknown as {
      getStubConfig: () => Promise<unknown>;
    };
    const stub = await Cls.getStubConfig();
    expect(stub).toEqual(metaFirst.stubConfig);
  });
});

describe('registerAll', () => {
  it('registers each meta and returns the list of registered types', () => {
    const metas = [makeMeta('all-one'), makeMeta('all-two'), makeMeta('all-three')];
    const types = registerAll(metas);
    expect(types).toEqual(metas.map(typeFor));
    for (const meta of metas) {
      expect(customElements.get(tagFor(meta))).toBeDefined();
      expect(window.customCards!.some((c) => c.type === typeFor(meta))).toBe(true);
    }
  });

  it('returns an empty list for an empty input array', () => {
    expect(registerAll([])).toEqual([]);
  });
});

describe('registerAll tag reconciliation across passes', () => {
  it('releases a colliding tag\'s ownership when the owning template is absent from a later registerAll pass', async () => {
    const ownerMeta = makeMeta('reconcile-x', {
      name: 'Owner',
      stubConfig: {
        type: 'custom:decluttering-card',
        template: 'Owner',
        variables: [{ owner: 1 }],
      },
    });
    const loserMeta = makeMeta('reconcile-x', {
      name: 'Loser',
      stubConfig: {
        type: 'custom:decluttering-card',
        template: 'Loser',
        variables: [{ loser: 2 }],
      },
    });

    registerAll([ownerMeta, loserMeta]);

    let matches = window.customCards!.filter((c) => c.type === typeFor(ownerMeta));
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe('Owner');

    registerAll([loserMeta]);

    matches = window.customCards!.filter((c) => c.type === typeFor(loserMeta));
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe('Loser');

    const Cls = customElements.get(tagFor(loserMeta)) as unknown as {
      getStubConfig: () => Promise<unknown>;
    };
    const stub = await Cls.getStubConfig();
    expect(stub).toEqual(loserMeta.stubConfig);
  });
});
