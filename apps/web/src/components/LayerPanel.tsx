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
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(10rem, 1fr))",
          gap: "0.35rem",
        }}
      >
        {allTypes.map((type) => {
          const checked = activeTypes.has(type);
          return (
            <li key={type}>
              <label
                className="row"
                style={{ cursor: "pointer", padding: "0.25rem 0" }}
              >
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
        style={{ padding: "0.85rem 1rem" }}
      >
        <h2 style={{ marginBottom: "0.65rem" }}>{t("layers")}</h2>
        {body}
      </aside>

      {/* Mobile: bottom sheet trigger + sheet */}
      <div className="layer-panel-mobile">
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            position: "fixed",
            /* When a feature popup is open, raise FAB above popup area */
            bottom: featureSelected ? "7.5rem" : "1rem",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 40,
            padding: "0.75rem 1.5rem",
            borderRadius: 999,
            border: "none",
            background: "#1e293b",
            color: "#fff",
            fontWeight: 600,
            boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
            cursor: "pointer",
          }}
        >
          {t("layers")}
        </button>
        {open ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("layers")}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 50,
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
            onClick={() => setOpen(false)}
          >
            <div
              style={{
                background: "#fff",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                padding: "1rem 1.25rem 1.5rem",
                maxHeight: "70vh",
                overflow: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.75rem",
                }}
              >
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

      <style>{`
        .layer-panel-mobile { display: none; }
        .layer-panel-desktop { display: block; }
        @media (max-width: 640px) {
          .layer-panel-mobile { display: block; }
          .layer-panel-desktop { display: none; }
        }
      `}</style>
    </>
  );
}
