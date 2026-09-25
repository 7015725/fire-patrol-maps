import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { Breadcrumb } from "../components/Breadcrumb";
import type { BuildingDetail } from "../types";

export function BuildingPage() {
  const params = useParams<{
    campusSlug: string;
    buildingSlug?: string;
    segmentSlug?: string;
  }>();
  const campusSlug = params.campusSlug ?? "";
  const buildingSlug = params.buildingSlug ?? params.segmentSlug ?? "";
  const { t } = useTranslation();
  const [building, setBuilding] = useState<BuildingDetail | null>(null);
  const [campusName, setCampusName] = useState<string>(campusSlug);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBuilding(null);
    setError(null);

    Promise.all([api.getCampus(campusSlug), api.getBuilding(campusSlug, buildingSlug)])
      .then(([campus, buildingData]) => {
        if (!cancelled) {
          setCampusName(campus.name);
          setBuilding(buildingData);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("errorLoad"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [campusSlug, buildingSlug, t]);

  if (error) {
    return <p role="alert" className="error-text">{error}</p>;
  }

  if (!building) {
    return <p className="loading">{t("loading")}</p>;
  }

  return (
    <section className="page-stack">
      <Breadcrumb
        items={[
          { label: campusName, to: `/${campusSlug}` },
          { label: building.name },
        ]}
      />
      <div className="page-heading">
        <span className="eyebrow">{t("buildings")}</span>
        <h1>{building.name}</h1>
      </div>
      <h2 className="section-title">{t("floors")}</h2>
      {building.floors.length === 0 ? (
        <p className="empty">{t("emptyFloors")}</p>
      ) : (
        <ul className="list navigation-grid">
          {building.floors.map((floor) => (
            <li key={floor.id} className="list-item navigation-card">
              <Link
                to={`/${campusSlug}/${building.slug}/${floor.slug}`}
                className="navigation-link"
              >
                <span>{floor.name}</span><span aria-hidden="true" className="navigation-arrow">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
