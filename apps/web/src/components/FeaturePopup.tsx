import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MapFeature } from "../types";
import { colorForType, inspectionBadge, inspectionBadgeColor } from "../lib/featureStyle";
import { mediaKind } from "../lib/media";

export type FeaturePopupProps = {
  feature: MapFeature | null;
  onClose: () => void;
  /** Current-month key for the inspection section header. */
  inspectionMonth?: string | null;
  /** Show inspection section (admin inspection mode). */
  inspectionMode?: boolean;
  /** Mark ok/fault. Throw string message on validation error. */
  onMarkInspection?: (feature: MapFeature, status: "ok" | "fault", note: string) => Promise<void>;
  /** Clear back to uninspected. */
  onClearInspection?: (feature: MapFeature) => Promise<void>;
};

export function FeaturePopup({
  feature,
  onClose,
  inspectionMonth = null,
  inspectionMode = false,
  onMarkInspection,
  onClearInspection,
}: FeaturePopupProps) {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  if (!feature) return null;

  const color = colorForType(feature.type);
  const media = feature.media ?? [];
  const badge = inspectionBadge(feature.inspection);
  const badgeColor = inspectionBadgeColor(feature.inspection);
  const showInspection = inspectionMode && onMarkInspection;

  async function mark(status: "ok" | "fault") {
    if (!onMarkInspection) return;
    if (status === "fault" && note.trim().length === 0) {
      setMarkError(t("inspectionNoteRequired"));
      return;
    }
    setMarking(true);
    setMarkError(null);
    try {
      await onMarkInspection(feature!, status, note.trim());
      setNote("");
    } catch (err: unknown) {
      setMarkError(err instanceof Error ? err.message : t("errorSave"));
    } finally {
      setMarking(false);
    }
  }

  async function clear() {
    if (!onClearInspection) return;
    setMarking(true);
    setMarkError(null);
    try {
      await onClearInspection(feature!);
    } catch (err: unknown) {
      setMarkError(err instanceof Error ? err.message : t("errorSave"));
    } finally {
      setMarking(false);
    }
  }

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
      {showInspection ? (
        <div style={{ marginTop: "0.65rem", borderTop: "1px solid #e2e2e5", paddingTop: "0.5rem" }}>
          <p style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: badgeColor,
              }}
            />
            <strong className="small">
              {inspectionMonth ? `${inspectionMonth} ` : ""}{t(`inspection.${badge}`)}
            </strong>
          </p>
          {feature.inspection?.note ? (
            <p className="small muted" style={{ margin: "0.25rem 0 0" }}>
              {feature.inspection.note}
            </p>
          ) : null}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={t("inspectionNotePlaceholder")}
            className="input"
            style={{ marginTop: "0.4rem", resize: "vertical" }}
            disabled={marking}
          />
          {markError ? (
            <p role="alert" className="error-text small" style={{ margin: "0.25rem 0 0" }}>
              {markError}
            </p>
          ) : null}
          <div className="row row-tight" style={{ marginTop: "0.4rem" }}>
            <button
              type="button"
              onClick={() => void mark("ok")}
              disabled={marking}
              className="btn btn-sm btn-primary"
            >
              {t("inspectionMarkOk")}
            </button>
            <button
              type="button"
              onClick={() => void mark("fault")}
              disabled={marking}
              className="btn btn-sm btn-danger"
            >
              {t("inspectionMarkFault")}
            </button>
            {feature.inspection && onClearInspection ? (
              <button
                type="button"
                onClick={() => void clear()}
                disabled={marking}
                className="btn btn-sm btn-ghost"
              >
                {t("inspectionClear")}
              </button>
            ) : null}
          </div>
        </div>
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
