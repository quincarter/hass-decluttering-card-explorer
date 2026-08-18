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
 * `custom-card-helpers`'s `HomeAssistant` type doesn't declare `lovelace` (it's a
 * frontend-only runtime field, not part of the public card-facing API surface), but
 * the real object always has it when rendered inside a dashboard.
 */
type HassWithLovelace = HomeAssistant & {
  lovelace?: {
    config?: { decluttering_templates?: DeclutteringTemplates };
  };
};

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

    if (typeof this.hass?.callWS === 'function') {
      const result = await this.hass.callWS<{
        decluttering_templates?: DeclutteringTemplates;
      }>({ type: 'lovelace/config' });
      return extractTemplates(result ?? {});
    }

    return {};
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
