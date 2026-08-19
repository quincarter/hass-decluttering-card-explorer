import { LitElement, html, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HomeAssistant } from 'custom-card-helpers';
import {
  extractTemplates,
  analyzeTemplates,
  getDeclutteringTemplates,
  LovelaceUnavailableError,
} from './decluttering';
import { registerAll } from './register';
import type { DeclutteringTemplates, TemplateMeta } from './types';

interface DeclutteringSelectorConfig {
  title?: string;
}

/**
 * `hass.lovelace` is NOT part of the real `HomeAssistant` object for card elements —
 * it's tracked as component-local state in HA frontend's `ha-panel-lovelace`, and
 * only ever passed down as a *separate* `.lovelace` property to view/editor
 * elements, never merged onto `hass`. This type (and the `getDeclutteringTemplates`
 * primary-path lookup that uses it) exists only as a best-effort check for
 * environments where something else happens to have set it; the `lovelace/config`
 * WS call below — with an explicit `url_path` — is the actual reliable path.
 */
type HassWithLovelace = HomeAssistant & {
  lovelace?: {
    config?: { decluttering_templates?: DeclutteringTemplates };
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
export function getCurrentDashboardUrlPath(hass: HassWithLovelace | undefined): string | undefined {
  const segments = window.location.pathname.split('/').filter(Boolean);
  for (const segment of segments) {
    if (hass?.panels?.[segment]?.component_name === 'lovelace') {
      return segment;
    }
  }
  return segments[0];
}

@customElement('decluttering-selector')
export class DeclutteringSelector extends LitElement {
  @property({ attribute: false }) public hass?: HassWithLovelace;

  @state() private _metas: TemplateMeta[] = [];

  private _config: DeclutteringSelectorConfig = {};
  private _subscribedToUpdates = false;
  private _unsubscribe?: () => void;

  static async getStubConfig(): Promise<{ type: string }> {
    return { type: 'custom:decluttering-selector' };
  }

  public setConfig(config?: DeclutteringSelectorConfig): void {
    this._config = config ?? {};
  }

  protected updated(changedProperties: PropertyValues): void {
    if (changedProperties.has('hass')) {
      void this._register();
      this._subscribeToUpdates();
    }
  }

  private _subscribeToUpdates(): void {
    if (this._subscribedToUpdates) return;
    try {
      const connection = this.hass?.connection as
        | { subscribeEvents?: (cb: () => void, event: string) => Promise<() => void> }
        | undefined;
      if (!connection?.subscribeEvents) return;
      this._subscribedToUpdates = true;
      connection.subscribeEvents(() => {
        void this._register();
      }, 'lovelace_updated').then((unsubscribe) => {
        this._unsubscribe = unsubscribe;
      }).catch(() => {
        this._subscribedToUpdates = false;
      });
    } catch {
      this._subscribedToUpdates = false;
    }
  }

  public disconnectedCallback(): void {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = undefined;
    }
    super.disconnectedCallback();
  }

  private async _resolveTemplates(): Promise<DeclutteringTemplates> {
    try {
      return getDeclutteringTemplates(this.hass);
    } catch (err) {
      if (!(err instanceof LovelaceUnavailableError)) throw err;
    }

    if (typeof this.hass?.callWS !== 'function') return {};

    const urlPath = getCurrentDashboardUrlPath(this.hass);

    try {
      const result = await this.hass.callWS<{
        decluttering_templates?: DeclutteringTemplates;
      }>({ type: 'lovelace/config', url_path: urlPath });
      return extractTemplates(result ?? {});
    } catch (err) {
      // Pre-migration instances may only have the unnamed default dashboard
      // (url_path omitted entirely), not one registered under "lovelace" yet.
      // Only retry that specific, narrow case — retrying for any other url_path
      // would silently re-fetch the wrong (default) dashboard's config.
      const code = (err as { code?: string } | undefined)?.code;
      if (urlPath === 'lovelace' && code === 'config_not_found') {
        console.warn(
          'decluttering-selector: no dashboard registered at url_path "lovelace"; falling back ' +
            "to the instance's unnamed default dashboard config (pre-migration HA instance). " +
            "If this isn't the dashboard you're viewing, its templates won't be registered."
        );
        const result = await this.hass.callWS<{
          decluttering_templates?: DeclutteringTemplates;
        }>({ type: 'lovelace/config' });
        return extractTemplates(result ?? {});
      }
      throw err;
    }
  }

  private async _register(): Promise<void> {
    try {
      const templates = await this._resolveTemplates();
      const metas = analyzeTemplates(templates);
      registerAll(metas);
      this._metas = metas;
    } catch (err) {
      console.error('decluttering-selector: failed to register templates', err);
      this._metas = [];
    }
  }

  protected render() {
    try {
      const count = this._metas.length;
      const title = this._config.title;
      return html`
        <div>
          ${title ? html`<h3>${title}</h3>` : null}
          <p>${count} template${count === 1 ? '' : 's'} registered into Add Card</p>
          <ul>
            ${this._metas.map((meta) => html`<li>${meta.name}</li>`)}
          </ul>
        </div>
      `;
    } catch {
      return html`<div>decluttering-selector</div>`;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'decluttering-selector': DeclutteringSelector;
  }
}
