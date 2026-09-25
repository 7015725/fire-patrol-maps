import { useTranslation } from "react-i18next";
import { colorForType } from "../lib/featureStyle";

export type LegendProps = {
  /** Feature types currently visible on the map */
  visibleTypes: string[];
  /** True when the floor has a plan but no features at all */
  emptyFeatures?: boolean;
};

export function Legend({ visibleTypes, emptyFeatures = false }: LegendProps) {
  const { t } = useTranslation();

  if (emptyFeatures) {
    return <p className="small muted">{t("emptyFeatures")}</p>;
  }

  if (visibleTypes.length === 0) {
    return null;
  }

  const sorted = [...visibleTypes].sort();

  return (
    <ul aria-label="Legend" className="legend">
      {sorted.map((type) => (
        <li key={type}>
          <span
            aria-hidden
            className="legend-dot"
            style={{ background: colorForType(type) }}
          />
          {t(`featureTypes.${type}`, { defaultValue: type })}
        </li>
      ))}
    </ul>
  );
}
