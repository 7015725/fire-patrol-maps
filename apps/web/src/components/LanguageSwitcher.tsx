import { useTranslation } from "react-i18next";
import { setLocale, SUPPORTED_LOCALES, type SupportedLocale } from "../i18n";

const LOCALE_LABELS: Record<SupportedLocale, string> = {
  zh: "简体中文",
  en: "English",
};

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = (SUPPORTED_LOCALES as readonly string[]).includes(i18n.language)
    ? (i18n.language as SupportedLocale)
    : "en";

  return (
    <select
      className="lang-select"
      value={current}
      onChange={(e) => setLocale(e.target.value as SupportedLocale)}
      aria-label="Language"
    >
      {SUPPORTED_LOCALES.map((locale) => (
        <option key={locale} value={locale}>
          {LOCALE_LABELS[locale]}
        </option>
      ))}
    </select>
  );
}
