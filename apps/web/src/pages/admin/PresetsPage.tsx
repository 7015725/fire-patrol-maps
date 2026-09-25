import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { FEATURE_TYPES, type LayerPreset } from "../../types";
import { presetDisplayName } from "../../lib/featureStyle";

/** Slugs shipped with the app. `all` is fully locked; the rest are renamable. */
const SYSTEM_SLUGS = new Set([
  "all",
  "evacuation",
  "fire_response",
  "medical",
  "spill_chemical",
  "utilities",
  "hazards",
  "rooms",
]);

export function PresetsPage() {
  const { t, i18n } = useTranslation();
  const [presets, setPresets] = useState<LayerPreset[] | null>(null);
  /** Local draft selections keyed by preset id */
  const [drafts, setDrafts] = useState<Record<string, Set<string>>>({});
  /** Local draft names keyed by preset id */
  const [nameDrafts, setNameDrafts] = useState<
    Record<string, { nameZh: string; nameEn: string }>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  // New-preset form
  const [newZh, setNewZh] = useState("");
  const [newEn, setNewEn] = useState("");
  const [newTypes, setNewTypes] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const { presets: rows } = await api.getPresets();
    setPresets(rows);
    setDrafts(
      Object.fromEntries(rows.map((p) => [p.id, new Set(p.featureTypes)])),
    );
    setNameDrafts(
      Object.fromEntries(
        rows.map((p) => [
          p.id,
          { nameZh: p.nameZh ?? "", nameEn: p.nameEn ?? "" },
        ]),
      ),
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

  function setNameDraft(
    presetId: string,
    field: "nameZh" | "nameEn",
    value: string,
  ) {
    setNameDrafts((prev) => ({
      ...prev,
      [presetId]: {
        nameZh: prev[presetId]?.nameZh ?? "",
        nameEn: prev[presetId]?.nameEn ?? "",
        [field]: value,
      },
    }));
  }

  function toggleNewType(type: string) {
    setNewTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  async function onSave(preset: LayerPreset) {
    const selected = drafts[preset.id];
    const names = nameDrafts[preset.id];
    if (!selected) return;
    const lockedAll = preset.slug === "all";
    const isSystem = SYSTEM_SLUGS.has(preset.slug);
    if (lockedAll) return;
    setBusyId(preset.id);
    setError(null);
    setSavedId(null);
    try {
      const input: {
        featureTypes?: string[];
        nameZh?: string | null;
        nameEn?: string | null;
      } = {};
      // System presets: names only (lists are version-managed).
      if (!isSystem) {
        input.featureTypes = FEATURE_TYPES.filter((ft) => selected.has(ft));
      }
      if (names) {
        const zh = names.nameZh.trim();
        const en = names.nameEn.trim();
        if (zh !== (preset.nameZh ?? "")) input.nameZh = zh || null;
        if (en !== (preset.nameEn ?? "")) input.nameEn = en || null;
      }
      if (Object.keys(input).length === 0) return;
      const updated = await api.updatePreset(preset.id, input);
      setPresets((prev) =>
        prev ? prev.map((p) => (p.id === updated.id ? updated : p)) : prev,
      );
      setDrafts((prev) => ({
        ...prev,
        [updated.id]: new Set(updated.featureTypes),
      }));
      setNameDrafts((prev) => ({
        ...prev,
        [updated.id]: {
          nameZh: updated.nameZh ?? "",
          nameEn: updated.nameEn ?? "",
        },
      }));
      setSavedId(updated.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errorLoad"));
    } finally {
      setBusyId(null);
    }
  }

  async function onCreate() {
    const zh = newZh.trim();
    if (!zh) {
      setError(t("presetNameRequired"));
      return;
    }
    const featureTypes = FEATURE_TYPES.filter((ft) => newTypes.has(ft));
    if (featureTypes.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const created = await api.createPreset({
        nameZh: zh,
        nameEn: newEn.trim() || undefined,
        featureTypes,
      });
      setPresets((prev) => (prev ? [...prev, created] : [created]));
      setDrafts((prev) => ({
        ...prev,
        [created.id]: new Set(created.featureTypes),
      }));
      setNameDrafts((prev) => ({
        ...prev,
        [created.id]: {
          nameZh: created.nameZh ?? "",
          nameEn: created.nameEn ?? "",
        },
      }));
      setNewZh("");
      setNewEn("");
      setNewTypes(new Set());
      setSavedId(created.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("presetCreateFailed"));
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(preset: LayerPreset) {
    if (preset.slug === "all" || SYSTEM_SLUGS.has(preset.slug)) return;
    if (!window.confirm(t("deletePresetConfirm"))) return;
    setBusyId(preset.id);
    setError(null);
    try {
      await api.deletePreset(preset.id);
      setPresets((prev) => (prev ? prev.filter((p) => p.id !== preset.id) : prev));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[preset.id];
        return next;
      });
      setNameDrafts((prev) => {
        const next = { ...prev };
        delete next[preset.id];
        return next;
      });
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

      <div className="list-item" style={{ display: "grid", gap: "0.75rem" }}>
        <div style={{ fontWeight: 700 }}>{t("newPreset")}</div>
        <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
          <label className="row row-tight">
            <span>{t("presetNameZh")}</span>
            <input
              type="text"
              value={newZh}
              maxLength={40}
              onChange={(e) => setNewZh(e.target.value)}
              style={{ minWidth: "10rem" }}
            />
          </label>
          <label className="row row-tight">
            <span>{t("presetNameEn")}</span>
            <input
              type="text"
              value={newEn}
              maxLength={40}
              onChange={(e) => setNewEn(e.target.value)}
              style={{ minWidth: "10rem" }}
            />
          </label>
          <button
            type="button"
            disabled={creating || !newZh.trim() || newTypes.size === 0}
            onClick={onCreate}
            className="btn btn-primary"
          >
            {t("add")}
          </button>
        </div>
        <div style={gridStyle}>
          {FEATURE_TYPES.map((type) => {
            const id = `new-${type}`;
            return (
              <label key={type} htmlFor={id} className="row row-tight" style={{ cursor: "pointer" }}>
                <input
                  id={id}
                  type="checkbox"
                  checked={newTypes.has(type)}
                  disabled={creating}
                  onChange={() => toggleNewType(type)}
                />
                <span>{t(`featureTypes.${type}`)}</span>
              </label>
            );
          })}
        </div>
      </div>

      <ul className="list">
        {presets.map((preset) => {
          const selected = drafts[preset.id] ?? new Set<string>();
          const names = nameDrafts[preset.id] ?? { nameZh: "", nameEn: "" };
          const busy = busyId === preset.id;
          const lockedAll = preset.slug === "all";
          const isSystem = SYSTEM_SLUGS.has(preset.slug);
          return (
            <li key={preset.id} className="list-item" style={{ display: "grid", gap: "0.75rem" }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {presetDisplayName(preset, i18n.language, t)}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#888" }}>
                    /{preset.slug}
                    {lockedAll ? ` · ${t("presetLockedAll")}` : isSystem ? ` · ${t("presetLocked")}` : null}
                  </div>
                </div>
                <div className="row">
                  {savedId === preset.id ? (
                    <span className="success-text">{t("saved")}</span>
                  ) : null}
                  {!lockedAll && !isSystem ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDelete(preset)}
                      className="btn btn-ghost"
                    >
                      {t("delete")}
                    </button>
                  ) : null}
                  {!lockedAll ? (
                    <button
                      type="button"
                      disabled={busy || (!isSystem && selected.size === 0)}
                      onClick={() => onSave(preset)}
                      className="btn btn-primary"
                    >
                      {t("save")}
                    </button>
                  ) : null}
                </div>
              </div>
              {!lockedAll ? (
                <div className="row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                  <label className="row row-tight">
                    <span>{t("presetNameZh")}</span>
                    <input
                      type="text"
                      value={names.nameZh}
                      maxLength={40}
                      disabled={busy}
                      onChange={(e) => setNameDraft(preset.id, "nameZh", e.target.value)}
                      style={{ minWidth: "10rem" }}
                    />
                  </label>
                  <label className="row row-tight">
                    <span>{t("presetNameEn")}</span>
                    <input
                      type="text"
                      value={names.nameEn}
                      maxLength={40}
                      disabled={busy}
                      onChange={(e) => setNameDraft(preset.id, "nameEn", e.target.value)}
                      style={{ minWidth: "10rem" }}
                    />
                  </label>
                </div>
              ) : null}
              {isSystem && !lockedAll ? (
                <p className="hint" style={{ margin: 0 }}>
                  {t("presetSystemListLocked")}
                </p>
              ) : null}
              {!isSystem ? (
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
              ) : null}
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
