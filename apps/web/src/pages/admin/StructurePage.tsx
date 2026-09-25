import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, type HierarchyMode } from "../../api/client";
import type { BuildingSummary, CampusSummary, FloorSummary } from "../../types";

type CampusNode = CampusSummary & {
  buildings: (BuildingSummary & { floors: FloorSummary[] })[];
  floors: FloorSummary[];
  mapFloorId?: string | null;
};

const HIERARCHY_OPTIONS: { value: HierarchyMode; labelKey: string }[] = [
  { value: "full", labelKey: "hierarchyModeFull" },
  { value: "no_buildings", labelKey: "hierarchyModeNoBuildings" },
  { value: "single_map", labelKey: "hierarchyModeSingleMap" },
];

export function StructurePage() {
  const { t } = useTranslation();
  const [tree, setTree] = useState<CampusNode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newCampusName, setNewCampusName] = useState("");
  const [newCampusMode, setNewCampusMode] = useState<HierarchyMode>("full");
  const [newBuildingName, setNewBuildingName] = useState<Record<string, string>>({});
  const [newFloorName, setNewFloorName] = useState<Record<string, string>>({});
  const [newFloorLevel, setNewFloorLevel] = useState<Record<string, string>>({});
  const [expandedCampuses, setExpandedCampuses] = useState<Set<string>>(new Set());
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setError(null);
    const { campuses } = await api.getCampuses();
    const nodes: CampusNode[] = await Promise.all(
      campuses.map(async (campus) => {
        const detail = await api.getCampus(campus.slug);
        if (detail.hierarchyMode === "full") {
          const buildings = await Promise.all(
            detail.buildings.map(async (building) => {
              const b = await api.getBuilding(campus.slug, building.slug);
              return { ...building, floors: b.floors };
            }),
          );
          return {
            ...campus,
            hierarchyMode: detail.hierarchyMode,
            buildings,
            floors: [],
            mapFloorId: null,
          };
        }
        return {
          ...campus,
          hierarchyMode: detail.hierarchyMode,
          buildings: [],
          floors: detail.floors ?? [],
          mapFloorId: detail.mapFloorId,
        };
      }),
    );
    setTree(nodes);
    setExpandedCampuses((prev) => {
      if (prev.size > 0) return prev;
      return new Set(nodes.map((c) => c.id));
    });
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

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errorLoad"));
    } finally {
      setBusy(false);
    }
  }

  function toggleCampus(id: string) {
    setExpandedCampuses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleBuilding(id: string) {
    setExpandedBuildings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onCreateCampus(e: FormEvent) {
    e.preventDefault();
    const name = newCampusName.trim();
    if (!name) return;
    await withBusy(async () => {
      await api.createCampus({ name, hierarchyMode: newCampusMode });
      setNewCampusName("");
      setNewCampusMode("full");
    });
  }

  async function onRenameCampus(id: string, current: string) {
    const name = window.prompt(t("name"), current)?.trim();
    if (!name || name === current) return;
    await withBusy(async () => {
      await api.updateCampus(id, { name });
    });
  }

  async function onChangeMode(id: string, current: HierarchyMode, next: HierarchyMode) {
    if (next === current) return;
    await withBusy(async () => {
      await api.updateCampus(id, { hierarchyMode: next });
    });
  }

  async function onDeleteCampus(id: string, name: string) {
    if (!window.confirm(`${t("delete")} “${name}”?`)) return;
    await withBusy(async () => {
      await api.deleteCampus(id);
    });
  }

  async function onCreateBuilding(e: FormEvent, campusId: string) {
    e.preventDefault();
    const name = (newBuildingName[campusId] ?? "").trim();
    if (!name) return;
    await withBusy(async () => {
      await api.createBuilding({ campusId, name });
      setNewBuildingName((prev) => ({ ...prev, [campusId]: "" }));
      setExpandedCampuses((prev) => new Set(prev).add(campusId));
    });
  }

  async function onRenameBuilding(id: string, current: string) {
    const name = window.prompt(t("name"), current)?.trim();
    if (!name || name === current) return;
    await withBusy(async () => {
      await api.updateBuilding(id, { name });
    });
  }

  async function onDeleteBuilding(id: string, name: string) {
    if (!window.confirm(`${t("delete")} “${name}”?`)) return;
    await withBusy(async () => {
      await api.deleteBuilding(id);
    });
  }

  async function onCreateFloor(
    e: FormEvent,
    parentKey: string,
    opts: { buildingId?: string; campusId?: string },
  ) {
    e.preventDefault();
    const name = (newFloorName[parentKey] ?? "").trim();
    if (!name) return;
    const levelRaw = (newFloorLevel[parentKey] ?? "").trim();
    const level = levelRaw === "" ? undefined : Number(levelRaw);
    await withBusy(async () => {
      await api.createFloor({
        ...opts,
        name,
        level: level !== undefined && Number.isFinite(level) ? level : undefined,
      });
      setNewFloorName((prev) => ({ ...prev, [parentKey]: "" }));
      setNewFloorLevel((prev) => ({ ...prev, [parentKey]: "" }));
      if (opts.buildingId) {
        setExpandedBuildings((prev) => new Set(prev).add(opts.buildingId!));
      }
    });
  }

  async function onRenameFloor(id: string, current: string) {
    const name = window.prompt(t("name"), current)?.trim();
    if (!name || name === current) return;
    await withBusy(async () => {
      await api.updateFloor(id, { name });
    });
  }

  async function onDeleteFloor(id: string, name: string) {
    if (!window.confirm(`${t("delete")} “${name}”?`)) return;
    await withBusy(async () => {
      await api.deleteFloor(id);
    });
  }

  function floorRow(floor: FloorSummary, allowDelete: boolean) {
    return (
      <li key={floor.id} className="list-item">
        <span style={{ fontSize: "0.9rem" }}>
          {floor.name}
          <span style={metaStyle}>
            /{floor.slug} · L{floor.level}
          </span>
        </span>
        <div className="row">
          <Link
            to={`/admin/floors/${floor.id}?inspect=1`}
            className="btn btn-primary btn-sm"
          >
            {t("startInspection")}
          </Link>
          <Link to={`/admin/floors/${floor.id}`} className="btn btn-sm">
            {t("editMap")}
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => onRenameFloor(floor.id, floor.name)}
            className="btn btn-sm"
          >
            {t("rename")}
          </button>
          {allowDelete ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onDeleteFloor(floor.id, floor.name)}
              className="btn btn-sm btn-danger"
            >
              {t("delete")}
            </button>
          ) : null}
        </div>
      </li>
    );
  }

  function floorForm(parentKey: string, onSubmit: (e: FormEvent) => void) {
    return (
      <form onSubmit={onSubmit} className="row" style={{ marginBottom: "0.5rem" }}>
        <input
          value={newFloorName[parentKey] ?? ""}
          onChange={(e) =>
            setNewFloorName((prev) => ({
              ...prev,
              [parentKey]: e.target.value,
            }))
          }
          placeholder={t("addFloor")}
          disabled={busy}
          className="input grow"
        />
        <input
          value={newFloorLevel[parentKey] ?? ""}
          onChange={(e) =>
            setNewFloorLevel((prev) => ({
              ...prev,
              [parentKey]: e.target.value,
            }))
          }
          placeholder={t("level")}
          inputMode="numeric"
          disabled={busy}
          className="input"
          style={{ maxWidth: 80 }}
        />
        <button
          type="submit"
          disabled={busy || !(newFloorName[parentKey] ?? "").trim()}
          className="btn btn-primary"
        >
          {t("add")}
        </button>
      </form>
    );
  }

  if (error && !tree) {
    return <p role="alert" className="error-text">{error}</p>;
  }

  if (!tree) {
    return <p className="loading">{t("loading")}</p>;
  }

  return (
    <section className="admin-page">
      <div className="page-header">
        <h1>{t("structure")}</h1>
        <p className="hint">
          {t("structureHint")}
        </p>
      </div>

      {error ? (
        <p role="alert" className="error-text">
          {error}
        </p>
      ) : null}

      <form onSubmit={onCreateCampus} className="row">
        <input
          value={newCampusName}
          onChange={(e) => setNewCampusName(e.target.value)}
          placeholder={t("addCampus")}
          disabled={busy}
          className="input grow"
        />
        <select
          value={newCampusMode}
          onChange={(e) => setNewCampusMode(e.target.value as HierarchyMode)}
          disabled={busy}
          className="select"
          style={{ flex: "0 1 14rem", maxWidth: "100%" }}
          aria-label={t("hierarchyMode")}
        >
          {HIERARCHY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.labelKey)}
            </option>
          ))}
        </select>
        <button type="submit" disabled={busy || !newCampusName.trim()} className="btn btn-primary">
          {t("add")}
        </button>
      </form>

      <ul className="list">
        {tree.map((campus) => {
          const campusOpen = expandedCampuses.has(campus.id);
          const mode = campus.hierarchyMode;
          return (
            <li key={campus.id} className="list-item">
              <div className="row">
                <button
                  type="button"
                  onClick={() => toggleCampus(campus.id)}
                  style={toggleStyle}
                  aria-expanded={campusOpen}
                >
                  {campusOpen ? "▾" : "▸"} {campus.name}
                  <span style={metaStyle}>/{campus.slug}</span>
                </button>
                <div className="row">
                  <select
                    value={mode}
                    disabled={busy}
                    onChange={(e) =>
                      onChangeMode(campus.id, mode, e.target.value as HierarchyMode)
                    }
                    className="select"
                    style={{ flex: "0 1 auto", minWidth: 140, maxWidth: 200 }}
                    aria-label={t("hierarchyMode")}
                  >
                    {HIERARCHY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(opt.labelKey)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onRenameCampus(campus.id, campus.name)}
                    className="btn btn-sm"
                  >
                    {t("rename")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDeleteCampus(campus.id, campus.name)}
                    className="btn btn-sm btn-danger"
                  >
                    {t("delete")}
                  </button>
                </div>
              </div>

              {campusOpen ? (
                <div style={{ marginTop: "0.75rem", paddingLeft: "0.5rem" }}>
                  {mode === "single_map" ? (
                    <div>
                      <div style={sectionLabelStyle}>{t("siteMap")}</div>
                      {campus.floors[0] || campus.mapFloorId ? (
                        <ul className="list">
                          {floorRow(
                            campus.floors[0] ?? {
                              id: campus.mapFloorId!,
                              name: t("siteMap"),
                              slug: "map",
                              level: 0,
                              sortOrder: 0,
                            },
                            false,
                          )}
                        </ul>
                      ) : (
                        <p style={{ fontSize: "0.85rem", color: "#666" }}>{t("emptyPlan")}</p>
                      )}
                    </div>
                  ) : null}

                  {mode === "no_buildings" ? (
                    <div>
                      <div style={sectionLabelStyle}>{t("floors")}</div>
                      {floorForm(campus.id, (e) =>
                        onCreateFloor(e, campus.id, { campusId: campus.id }),
                      )}
                      <ul className="list">
                        {campus.floors.map((floor) => floorRow(floor, true))}
                        {campus.floors.length === 0 ? (
                          <li style={{ fontSize: "0.85rem", color: "#666" }}>{t("emptyFloors")}</li>
                        ) : null}
                      </ul>
                    </div>
                  ) : null}

                  {mode === "full" ? (
                    <>
                      <div style={sectionLabelStyle}>{t("buildings")}</div>
                      <form
                        onSubmit={(e) => onCreateBuilding(e, campus.id)}
                        className="row"
                        style={{ marginBottom: "0.5rem" }}
                      >
                        <input
                          value={newBuildingName[campus.id] ?? ""}
                          onChange={(e) =>
                            setNewBuildingName((prev) => ({
                              ...prev,
                              [campus.id]: e.target.value,
                            }))
                          }
                          placeholder={t("addBuilding")}
                          disabled={busy}
                          className="input grow"
                        />
                        <button
                          type="submit"
                          disabled={busy || !(newBuildingName[campus.id] ?? "").trim()}
                          className="btn btn-primary"
                        >
                          {t("add")}
                        </button>
                      </form>

                      <ul className="list">
                        {campus.buildings.map((building) => {
                          const buildingOpen = expandedBuildings.has(building.id);
                          return (
                            <li key={building.id} className="list-item">
                              <div className="row">
                                <button
                                  type="button"
                                  onClick={() => toggleBuilding(building.id)}
                                  style={toggleStyle}
                                  aria-expanded={buildingOpen}
                                >
                                  {buildingOpen ? "▾" : "▸"} {building.name}
                                  <span style={metaStyle}>/{building.slug}</span>
                                </button>
                                <div className="row">
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => onRenameBuilding(building.id, building.name)}
                                    className="btn btn-sm"
                                  >
                                    {t("rename")}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => onDeleteBuilding(building.id, building.name)}
                                    className="btn btn-sm btn-danger"
                                  >
                                    {t("delete")}
                                  </button>
                                </div>
                              </div>

                              {buildingOpen ? (
                                <div style={{ marginTop: "0.6rem", paddingLeft: "0.35rem" }}>
                                  <div style={sectionLabelStyle}>{t("floors")}</div>
                                  {floorForm(building.id, (e) =>
                                    onCreateFloor(e, building.id, {
                                      buildingId: building.id,
                                    }),
                                  )}
                                  <ul className="list">
                                    {building.floors.map((floor) => floorRow(floor, true))}
                                    {building.floors.length === 0 ? (
                                      <li style={{ fontSize: "0.85rem", color: "#666" }}>
                                        {t("emptyFloors")}
                                      </li>
                                    ) : null}
                                  </ul>
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                        {campus.buildings.length === 0 ? (
                          <li style={{ fontSize: "0.85rem", color: "#666" }}>
                            {t("emptyBuildings")}
                          </li>
                        ) : null}
                      </ul>
                    </>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const toggleStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "0.95rem",
  textAlign: "left",
  padding: 0,
};

const metaStyle: CSSProperties = {
  fontWeight: 400,
  color: "var(--text-3)",
  fontSize: "0.8rem",
  marginLeft: 6,
};

const sectionLabelStyle: CSSProperties = {
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--text-2)",
  marginBottom: 6,
};
