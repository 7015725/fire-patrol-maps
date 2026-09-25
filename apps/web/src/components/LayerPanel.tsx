import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { LayerPreset } from "../types";
import { FEATURE_TYPES } from "../types";
import { colorForType, presetDisplayName } from "../lib/featureStyle";

export type LayerPanelProps = {
  presets: LayerPreset[];
  activeTypes: Set<string>;
  activePresetSlug: string | null;
  onApplyPreset: (slug: string) => void;
  onToggleType: (type: string) => void;
  allTypes?: readonly string[];
  /** When true, shift the mobile FAB so it does not cover FeaturePopup close. */
  featureSelected?: boolean;
};

export function LayerPanel({
  presets,
  activeTypes,
  activePresetSlug,
  onApplyPreset,
  onToggleType,
  allTypes = FEATURE_TYPES,
  featureSelected = false,
}: LayerPanelProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const body = (
    <>
      <div className="preset-chips" style={{ marginBottom: "0.75rem" }}>
        {presets.map((preset) => {
          const active = activePresetSlug === preset.slug;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyPreset(preset.slug)}
              aria-pressed={active}
              className={active ? "preset-chip active" : "preset-chip"}
            >
              {presetDisplayName(preset, i18n.language, t)}
            </button>
          );
        })}
      </div>
      <ul className="layer-list">
        {allTypes.map((type) => {
          const checked = activeTypes.has(type);
          return (
            <li key={type}>
              <label className="row layer-option">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleType(type)}
                />
                <span
                  aria-hidden
                  className="legend-dot"
                  style={{ background: colorForType(type) }}
                />
                <span>{t(`featureTypes.${type}`, { defaultValue: type })}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </>
  );

  return (
    <>
      {/* Desktop / wide: inline panel */}
      <aside
        aria-label={t("layers")}
        className="layer-panel-desktop popover layer-panel"
      >
        <h2 className="layer-title">{t("layers")}</h2>
        {body}
      </aside>

      {/* Mobile: bottom sheet trigger + sheet */}
      <div className="layer-panel-mobile">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`layer-fab${featureSelected ? " is-raised" : ""}`}
        >
          {t("layers")}
        </button>
        {open ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("layers")}
            className="layer-mobile-backdrop"
            onClick={() => setOpen(false)}
          >
            <div
              className="layer-sheet"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="layer-sheet-header">
                <h2>{t("layers")}</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="btn btn-ghost btn-sm"
                >
                  ×
                </button>
              </div>
              {body}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
