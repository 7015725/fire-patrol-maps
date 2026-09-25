import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import type { InspectionProgress } from "../../types";

type Filter = "all" | "fault" | "uninspected";

function monthOptions(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    out.push(`${d.getFullYear()}-${m}`);
  }
  return out;
}

export function InspectionsPage() {
  const { t } = useTranslation();
  const [month, setMonth] = useState(() => monthOptions()[0]!);
  const [filter, setFilter] = useState<Filter>("all");
  const [progress, setProgress] = useState<InspectionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getInspectionProgress(month)
      .then((data) => {
        if (!cancelled) setProgress(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t("errorLoad"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, t]);

  const faultIds = new Set((progress?.faults ?? []).map((f) => f.featureId));
  const faultNoteByFeature = new Map(
    (progress?.faults ?? []).map((f) => [f.featureId, f.note]),
  );

  // Uninspected list is derived: progress gives counts, faults give fault rows.
  // For the uninspected filter we only know the count, so show faults + hint.
  const showFaults = filter === "all" || filter === "fault";
  const visibleFaults = showFaults ? (progress?.faults ?? []) : [];

  return (
    <section className="stack">
      <div className="row">
        <Link to="/admin" className="small">
          ← {t("structure")}
        </Link>
        <h1 className="grow">{t("inspectionHistory")}</h1>
      </div>

      <div className="card row row-tight">
        <label className="row">
          <span>{t("inspectionMonth")}</span>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="select"
          >
            {monthOptions().map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="row">
          <span>{t("inspectionFilter")}</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="select"
          >
            <option value="all">{t("inspectionFilterAll")}</option>
            <option value="fault">{t("inspectionFilterFault")}</option>
            <option value="uninspected">{t("inspectionFilterUninspected")}</option>
          </select>
        </label>
      </div>

      {loading ? <p className="loading">{t("loading")}</p> : null}
      {error ? (
        <p role="alert" className="error-text">
          {error}
        </p>
      ) : null}

      {progress && !loading ? (
        <>
          <div className="card">
            <p style={{ margin: 0 }}>
              <strong>
                {progress.month} · {t("inspectionProgress", {
                  inspected: progress.inspected,
                  total: progress.total,
                })}
              </strong>
            </p>
            <p className="small muted" style={{ margin: "0.25rem 0 0" }}>
              {t("inspectionFilterUninspected")}: {progress.uninspected} ·{" "}
              {t("inspectionFilterFault")}: {progress.faults.length}
            </p>
          </div>

          {filter === "uninspected" ? (
            <div className="card">
              <p style={{ margin: 0 }}>
                {t("inspectionFilterUninspected")}: {progress.uninspected}
              </p>
              <p className="small muted">
                {t("inspectionFilter")}: {t("inspectionEmpty")}
              </p>
            </div>
          ) : visibleFaults.length === 0 ? (
            <p className="empty">{t("inspectionEmpty")}</p>
          ) : (
            <div className="card stack">
              {visibleFaults.map((f) => (
                <div key={f.id} className="row" style={{ alignItems: "start" }}>
                  <span
                    aria-hidden
                    className="legend-dot"
                    style={{ background: "#dc2626", marginTop: 4 }}
                  />
                  <div className="grow">
                    <p style={{ margin: 0 }} className="small">
                      {t(`inspection.fault`)} · {f.featureId.slice(0, 8)}
                    </p>
                    {f.note || faultNoteByFeature.get(f.featureId) ? (
                      <p className="small muted" style={{ margin: "0.15rem 0 0" }}>
                        {f.note}
                      </p>
                    ) : null}
                  </div>
                  <span className="small muted">{f.month}</span>
                </div>
              ))}
            </div>
          )}
          {faultIds.size === 0 && filter === "all" ? null : null}
        </>
      ) : null}
    </section>
  );
}
