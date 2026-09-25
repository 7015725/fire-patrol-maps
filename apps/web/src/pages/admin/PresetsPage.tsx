import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { FEATURE_TYPES, type LayerPreset } from "../../types";

export function PresetsPage() {
  const { t } = useTranslation();
  const [presets, setPresets] = useState<LayerPreset[] | null>(null);
  /** Local draft selections keyed by preset id */
  const [drafts, setDrafts] = useState<Record<string, Set<string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { presets: rows } = await api.getPresets();
    setPresets(rows);
    setDrafts(
      Object.fromEntries(rows.map((p) => [p.id, new Set(p.featureTypes)])),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    load().catch((err: unknown) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : t("errorLoad"));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [load, t]);

  function toggleType(presetId: string, type: string) {
    setDrafts((prev) => {
      const current = new Set(prev[presetId] ?? []);
      if (current.has(type)) current.delete(type);
      else current.add(type);
      return { ...prev, [presetId]: current };
    });
  }

  async function onSave(preset: LayerPreset) {
    const selected = drafts[preset.id];
    if (!selected) return;
    setBusyId(preset.id);
    setError(null);
    setSavedId(null);
    try {
      const featureTypes = FEATURE_TYPES.filter((ft) => selected.has(ft));
      const updated = await api.updatePreset(preset.id, { featureTypes });
      setPresets((prev) =>
        prev ? prev.map((p) => (p.id === updated.id ? updated : p)) : prev,
      );
      setDrafts((prev) => ({
        ...prev,
        [updated.id]: new Set(updated.featureTypes),
      }));
      setSavedId(updated.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errorLoad"));
    } finally {
      setBusyId(null);
    }
  }

  if (error && !presets) {
    return <p role="alert" className="error-text">{error}</p>;
  }

  if (!presets) {
    return <p className="loading">{t("loading")}</p>;
  }

  return (
    <section style={{ display: "grid", gap: "1rem" }}>
      <div className="page-header">
        <h1>{t("layerPresets")}</h1>
        <p className="hint">{t("presetsHint")}</p>
      </div>

      {error ? (
        <p role="alert" className="error-text">
          {error}
        </p>
      ) : null}

      <ul className="list">
        {presets.map((preset) => {
          const selected = drafts[preset.id] ?? new Set<string>();
          const busy = busyId === preset.id;
          return (
            <li key={preset.id} className="list-item" style={{ display: "grid", gap: "0.75rem" }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {t(`presets.${preset.slug}`, { defaultValue: preset.slug })}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#888" }}>/{preset.slug}</div>
                </div>
                <div className="row">
                  {savedId === preset.id ? (
                    <span className="success-text">{t("saved")}</span>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy || selected.size === 0}
                    onClick={() => onSave(preset)}
                    className="btn btn-primary"
                  >
                    {t("save")}
                  </button>
                </div>
              </div>
              <div style={gridStyle}>
                {FEATURE_TYPES.map((type) => {
                  const id = `${preset.id}-${type}`;
                  return (
                    <label key={type} htmlFor={id} className="row row-tight" style={{ cursor: "pointer" }}>
                      <input
                        id={id}
                        type="checkbox"
                        checked={selected.has(type)}
                        disabled={busy}
                        onChange={() => toggleType(preset.id, type)}
                      />
                      <span>{t(`featureTypes.${type}`)}</span>
                    </label>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
  gap: "0.35rem 0.75rem",
};
