import { useTranslation } from "react-i18next";
import type { MapFeature } from "../types";
import { colorForType } from "../lib/featureStyle";
import { mediaKind } from "../lib/media";

export type FeaturePopupProps = {
  feature: MapFeature | null;
  onClose: () => void;
};

export function FeaturePopup({ feature, onClose }: FeaturePopupProps) {
  const { t } = useTranslation();

  if (!feature) return null;

  const color = colorForType(feature.type);
  const media = feature.media ?? [];

  return (
    <div
      role="dialog"
      aria-label={feature.label || t(`featureTypes.${feature.type}`)}
      className="popover feature-popup"
      style={{
        /* Positioning: bottom-sheet placement inside the relative map wrapper */
        position: "absolute",
        left: "0.75rem",
        right: "0.75rem",
        bottom: "0.75rem",
        /* Above Layers FAB (z-index 40) so close control is not covered on mobile */
        zIndex: 45,
        maxWidth: 420,
        margin: "0 auto",
        maxHeight: "min(60vh, 480px)",
        overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
        <div className="row">
          <span
            aria-hidden
            className="legend-dot"
            style={{ background: color }}
          />
          <strong className="badge">
            {t(`featureTypes.${feature.type}`, { defaultValue: feature.type })}
          </strong>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="btn btn-ghost btn-sm"
        >
          ×
        </button>
      </div>
      {feature.label ? (
        <p style={{ margin: "0.5rem 0 0" }}>
          <span className="small muted">{t("label")}: </span>
          {feature.label}
        </p>
      ) : null}
      {feature.notes ? (
        <p style={{ margin: "0.35rem 0 0" }}>
          <span className="small muted">{t("notes")}: </span>
          {feature.notes}
        </p>
      ) : null}
      {media.length > 0 ? (
        <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.65rem" }}>
          {media.map((item) =>
            mediaKind(item.mimeType) === "video" ? (
              <video
                key={item.id}
                src={item.url}
                controls
                preload="metadata"
                style={{ maxWidth: "100%", borderRadius: 8 }}
              />
            ) : (
              <img
                key={item.id}
                src={item.url}
                alt=""
                style={{ maxWidth: "100%", borderRadius: 8 }}
              />
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
