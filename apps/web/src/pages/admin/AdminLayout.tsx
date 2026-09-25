import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, type AdminUser } from "../../api/client";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useHamburgerNav } from "../../lib/uiPrefs";

export function AdminLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const burger = useHamburgerNav();

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((me) => {
        if (cancelled) return;
        if (!me) {
          navigate("/admin/login", { replace: true });
          return;
        }
        setUser(me);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("errorLoad"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, t]);

  async function onLogout() {
    try {
      await api.logout();
    } catch {
      /* still leave admin */
    }
    navigate("/admin/login", { replace: true });
  }

  if (loading) {
    return (
      <div className="shell">
        <p className="loading">{t("loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="shell">
        <p role="alert" className="error-text" style={{ padding: "1.25rem" }}>
          {error}
        </p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={`shell admin-shell${burger.open ? " nav-open" : ""}`}>
      <header className="topbar admin-topbar">
        <div className="topbar-left">
          <Link to="/admin" className="brand">
            {t("admin")}
          </Link>
        </div>
        <div className="topbar-right">
          <span className="admin-user">{user.username}</span>
          <LanguageSwitcher />
          <button type="button" onClick={onLogout} className="btn btn-ghost btn-sm">
            {t("logout")}
          </button>
          {burger.enabled && (
            <button
              type="button"
              className="hamburger-btn"
              aria-label={t("menu")}
              aria-expanded={burger.open}
              onClick={burger.toggle}
            >
              ☰
            </button>
          )}
        </div>
      </header>
      <main className="main main-admin" onClick={burger.close}>
        <div className="admin-workspace">
          <nav className="nav admin-sidebar" onClick={burger.close}>
            <NavLink
              to="/admin"
              end
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {t("structure")}
            </NavLink>
            <NavLink
              to="/admin/users"
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {t("users")}
            </NavLink>
            <NavLink
              to="/admin/presets"
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {t("layerPresets")}
            </NavLink>
            <NavLink
              to="/admin/inspections"
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {t("inspectionHistory")}
            </NavLink>
            <NavLink
              to="/admin/settings"
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {t("settings")}
            </NavLink>
            <Link to="/" className="nav-link">
              {t("publicView")}
            </Link>
          </nav>
          <div className="admin-content">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
