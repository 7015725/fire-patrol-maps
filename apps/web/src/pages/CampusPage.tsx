import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { Breadcrumb } from "../components/Breadcrumb";
import type { CampusDetail } from "../types";
import { SingleMapPage } from "./FloorMapPage";

export function CampusPage() {
  const { campusSlug = "" } = useParams<{ campusSlug: string }>();
  const { t } = useTranslation();
  const [campus, setCampus] = useState<CampusDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCampus(null);
    setError(null);
    api
      .getCampus(campusSlug)
      .then((data) => {
        if (!cancelled) setCampus(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("errorLoad"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [campusSlug, t]);

  if (error) {
    return <p role="alert" className="error-text">{error}</p>;
  }

  if (!campus) {
    return <p className="loading">{t("loading")}</p>;
  }

  if (campus.hierarchyMode === "single_map") {
    const floorId = campus.mapFloorId ?? campus.floors[0]?.id;
    if (!floorId) {
      return (
        <section>
          <Breadcrumb items={[{ label: campus.name }]} />
          <h1>{campus.name}</h1>
          <p className="empty">{t("emptyPlan")}</p>
        </section>
      );
    }
    return (
      <SingleMapPage
        campusSlug={campus.slug}
        campusName={campus.name}
        floorId={floorId}
      />
    );
  }

  if (campus.hierarchyMode === "no_buildings") {
    return (
      <section className="page-stack">
        <Breadcrumb items={[{ label: campus.name }]} />
        <div className="page-heading">
          <span className="eyebrow">{t("campuses")}</span>
          <h1>{campus.name}</h1>
        </div>
        <h2 className="section-title">{t("floors")}</h2>
        {campus.floors.length === 0 ? (
          <p className="empty">{t("emptyFloors")}</p>
        ) : (
          <ul className="list navigation-grid">
            {campus.floors.map((floor) => (
              <li key={floor.id} className="list-item navigation-card">
                <Link to={`/${campus.slug}/${floor.slug}`} className="navigation-link">
                  <span>{floor.name}</span><span aria-hidden="true" className="navigation-arrow">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  // full
  return (
    <section className="page-stack">
      <Breadcrumb items={[{ label: campus.name }]} />
      <div className="page-heading">
        <span className="eyebrow">{t("campuses")}</span>
        <h1>{campus.name}</h1>
      </div>
      <h2 className="section-title">{t("buildings")}</h2>
      {campus.buildings.length === 0 ? (
        <p className="empty">{t("emptyBuildings")}</p>
      ) : (
        <ul className="list navigation-grid">
          {campus.buildings.map((building) => (
            <li key={building.id} className="list-item navigation-card">
              <Link to={`/${campus.slug}/${building.slug}`} className="navigation-link">
                <span>{building.name}</span><span aria-hidden="true" className="navigation-arrow">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
