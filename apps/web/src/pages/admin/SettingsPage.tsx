import { useTranslation } from "react-i18next";
import { useUiPrefs } from "../../lib/uiPrefs";

export function SettingsPage() {
  const { t } = useTranslation();
  const [prefs, update] = useUiPrefs();

  return (
    <section className="admin-page settings-page">
      <div className="page-header">
        <h1>{t("settings")}</h1>
        <p className="hint">{t("settingsHint")}</p>
      </div>

      <div className="stack">
        <div className="card">
          <label className="row" style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={prefs.hamburgerNav}
              onChange={(event) => update({ hamburgerNav: event.target.checked })}
            />
            <strong>{t("prefHamburger")}</strong>
          </label>
          <p className="hint" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
            {t("prefHamburgerDesc")}
          </p>
        </div>

        <div className="card">
          <label className="row" style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={prefs.stackFormsMobile}
              onChange={(event) => update({ stackFormsMobile: event.target.checked })}
            />
            <strong>{t("prefStackForms")}</strong>
          </label>
          <p className="hint" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
            {t("prefStackFormsDesc")}
          </p>
        </div>
      </div>
    </section>
  );
}
