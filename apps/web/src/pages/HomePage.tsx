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
    <section>
      <h1>{t("campuses")}</h1>
      {campuses.length === 0 ? (
        <p className="empty">{t("emptyCampuses")}</p>
      ) : (
        <ul className="list">
          {campuses.map((campus) => (
            <li key={campus.id} className="list-item">
              <Link to={`/${campus.slug}`}>{campus.name}</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
