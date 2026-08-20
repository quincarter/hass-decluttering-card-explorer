import { LitElement, html, nothing, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, LovelaceCardConfig, LovelaceConfig } from "custom-card-helpers";
import { fireEvent } from "custom-card-helpers";
import { getRegisteredMetas } from "./register";
import type { TemplateMeta } from "./types";

interface DeclutteringTemplatePickerConfig {
  type: string;
  template?: string;
  variables?: unknown;
}

interface DeclutteringCardElement extends HTMLElement {
  hass?: HomeAssistant;
  setConfig(config: unknown): void;
}

const CHILD_TAG = "decluttering-card";

@customElement("decluttering-template-picker-editor")
export class DeclutteringTemplatePickerEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  public lovelace?: LovelaceConfig;

  @state() private _filter = "";

  private _config: DeclutteringTemplatePickerConfig = {
    type: "custom:decluttering-template-picker",
  };

  // Keyed by template name so a preview child (and the fact it's already had
  // setConfig() called once) survives filter keystrokes and hass updates —
  // only a brand-new template name gets a fresh element + setConfig call.
  private _childCache = new Map<string, DeclutteringCardElement>();
  private _appliedConfigKey = new Map<string, string>();

  static styles = css`
    input[type="text"] {
      width: 100%;
      box-sizing: border-box;
      margin-bottom: 8px;
      padding: 8px;
      font-size: 14px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
      max-height: 480px;
      overflow-y: auto;
      padding: 2px;
    }
    .template-item {
      cursor: pointer;
      border: 2px solid var(--divider-color, #ccc);
      border-radius: 8px;
      overflow: hidden;
      background: var(--card-background-color, #fff);
    }
    .template-item:hover {
      border-color: var(--primary-color, #03a9f4);
    }
    .template-item.selected {
      border-color: var(--primary-color, #03a9f4);
      box-shadow: 0 0 0 1px var(--primary-color, #03a9f4);
    }
    .preview-box {
      position: relative;
      height: 140px;
      overflow: hidden;
      /* The real decluttering-card may itself contain clickable controls
         (toggles, buttons) — this is a thumbnail, not a live control, so
         clicks must fall through to the tile's own @click handler. */
      pointer-events: none;
      background: var(--secondary-background-color, #f5f5f5);
    }
    /* Scale the full-size card down to fit the thumbnail box, cropped by the
       box's overflow:hidden rather than resized precisely — an
       approximation, not a pixel-perfect fit, same spirit as HA's own
       Add Card picker previews. A single wide column gives the card enough
       room that a lighter 0.65 scale (vs. the old grid's cramped 0.5) still
       fits and stays legible. */
    .preview-box > * {
      display: block;
      width: 154%;
      transform: scale(0.65);
      transform-origin: top left;
    }
    .name-fallback {
      height: 140px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px;
      text-align: center;
      font-size: 13px;
      color: var(--secondary-text-color, #666);
    }
    .item-caption {
      padding: 6px 8px;
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      border-top: 1px solid var(--divider-color, #ccc);
    }
  `;

  public setConfig(config?: LovelaceCardConfig): void {
    this._config = (config as DeclutteringTemplatePickerConfig | undefined) ?? {
      type: "custom:decluttering-template-picker",
    };
  }

  private _handleFilterInput(event: Event): void {
    this._filter = (event.target as HTMLInputElement).value;
  }

  private _handleSelect(meta: TemplateMeta): void {
    try {
      fireEvent(this, "config-changed", {
        config: {
          type: "custom:decluttering-template-picker",
          template: meta.name,
          variables: (meta.stubConfig as { variables?: unknown }).variables,
        },
      });
    } catch (err) {
      // setConfig()/render() are the render-safety contract here; a click
      // handler throwing would only surface as a silently ignored click.
      console.error("decluttering-selector: template-picker-editor failed to apply selection", err);
    }
  }

  /**
   * Reused across re-renders (typing in the filter, hass updates) so the real
   * decluttering-card child's own Lit state isn't thrown away, and so setConfig()
   * — which is comparatively expensive — only runs once per template's stable
   * stubConfig rather than on every keystroke.
   */
  private _getPreviewChild(meta: TemplateMeta): DeclutteringCardElement | undefined {
    if (!customElements.get(CHILD_TAG)) return undefined;

    let child = this._childCache.get(meta.name);
    if (!child) {
      child = document.createElement(CHILD_TAG) as DeclutteringCardElement;
      this._childCache.set(meta.name, child);
    }

    const configKey = JSON.stringify(meta.stubConfig);
    if (this._appliedConfigKey.get(meta.name) !== configKey) {
      child.setConfig(meta.stubConfig);
      this._appliedConfigKey.set(meta.name, configKey);
    }

    if (this.hass) {
      child.hass = this.hass;
    }

    return child;
  }

  private _renderItem(meta: TemplateMeta) {
    const selected = this._config.template === meta.name;
    const child = this._getPreviewChild(meta);

    return html`
      <div
        class=${selected ? "template-item selected" : "template-item"}
        data-testid="template-item"
        data-template-name=${meta.name}
        @click=${() => this._handleSelect(meta)}
      >
        ${
          child
            ? html`<div class="preview-box">${child}</div>`
            : html`<div class="name-fallback">${meta.name}</div>`
        }
        <div class="item-caption">${meta.name}</div>
      </div>
    `;
  }

  protected render() {
    try {
      const metas = getRegisteredMetas();

      if (metas.length === 0) {
        return html`<div>
          No templates found — make sure the Decluttering Selector card is on this dashboard.
        </div>`;
      }

      const filterLower = this._filter.trim().toLowerCase();
      const visible = filterLower
        ? metas.filter((meta) => meta.name.toLowerCase().includes(filterLower))
        : metas;

      // Everything must live under one root element, not as sibling top-level
      // expressions in the returned template — lit-html child parts that sit
      // directly at a template's root (rather than nested inside a wrapping
      // element) don't reliably commit content in this project's happy-dom test
      // environment.
      return html`
        <div>
          <input
            type="text"
            data-testid="template-filter"
            placeholder="Filter templates…"
            .value=${this._filter}
            @input=${this._handleFilterInput}
          />
          ${
            visible.length === 0
              ? html`<div data-testid="no-matches">No templates match "${this._filter}".</div>`
              : html`<div class="grid">${visible.map((meta) => this._renderItem(meta))}</div>`
          }
        </div>
      `;
    } catch {
      return nothing;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "decluttering-template-picker-editor": DeclutteringTemplatePickerEditor;
  }
}
