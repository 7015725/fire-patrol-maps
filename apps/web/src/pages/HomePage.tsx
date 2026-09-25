import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import type { CampusSummary } from "../types";

export function HomePage() {
  const { t } = useTranslation();
  const [campuses, setCampuses] = useState<CampusSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getCampuses()
      .then((data) => {
        if (!cancelled) setCampuses(data.campuses);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("errorLoad"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (error) {
    return <p role="alert" className="error-text">{error}</p>;
  }

  if (!campuses) {
    return <p className="loading">{t("loading")}</p>;
  }

  return (
    <section className="page-stack landing-page">
      <div className="page-heading page-heading-hero">
        <span className="eyebrow">{t("appTitle")}</span>
        <h1>{t("campuses")}</h1>
        <p className="hero-summary">{t("campusCount", { count: campuses.length })}</p>
      </div>
      {campuses.length === 0 ? (
        <p className="empty">{t("emptyCampuses")}</p>
      ) : (
        <ul className="list navigation-grid">
          {campuses.map((campus) => (
            <li key={campus.id} className="list-item navigation-card">
              <Link to={`/${campus.slug}`} className="navigation-link">
                <span className="navigation-link-title">
                  <span className="navigation-link-kicker">{t("campuses")}</span>
                  <span>{campus.name}</span>
                </span>
                <span aria-hidden="true" className="navigation-arrow">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
