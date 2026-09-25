import { Link, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Layout() {
  const { t } = useTranslation();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-left">
          <Link to="/" className="brand">
            {t("appTitle")}
          </Link>
        </div>
        <div className="topbar-right">
          <LanguageSwitcher />
          <Link to="/admin" className="nav-link">
            {t("admin")}
          </Link>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
