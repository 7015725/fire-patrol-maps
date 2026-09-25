import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((user) => {
        if (!cancelled && user) {
          navigate("/admin", { replace: true });
        }
      })
      .catch(() => {
        /* stay on login */
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.login(username.trim(), password);
      navigate("/admin", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errorLoad"));
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return <p className="loading">{t("loading")}</p>;
  }

  return (
    <main className="auth-shell">
      <section className="card auth-card">
        <span className="eyebrow">{t("appTitle")}</span>
        <h1>{t("login")}</h1>
        <form onSubmit={onSubmit} className="auth-form">
        <label className="label">
          <span>{t("username")}</span>
          <input
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="input"
          />
        </label>
        <label className="label">
          <span>{t("password")}</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input"
          />
        </label>
        {error ? (
          <p role="alert" className="error-text">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={submitting} className="btn btn-primary">
          {submitting ? t("loading") : t("login")}
        </button>
        </form>
      </section>
    </main>
  );
}
