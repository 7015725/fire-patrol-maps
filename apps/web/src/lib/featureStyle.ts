import type { InspectionMark, LayerPreset } from "../types";

/** Stable colors for feature types (public map + legend). */
export const FEATURE_TYPE_COLORS: Record<string, string> = {
  exit: "#16a34a",
  assembly_point: "#15803d",
  safe_haven: "#2563eb",
  fire_extinguisher: "#dc2626",
  fire_hydrant: "#991b1b",
  fire_alarm_pull: "#b91c1c",
  electrical_fire_controller: "#f59e0b",
  gas_suppression_controller: "#7e22ce",
  water_gong: "#0369a1",
  aed: "#be123c",
  first_aid: "#e11d48",
  eye_wash: "#0891b2",
  safety_shower: "#0e7490",
  spill_kit: "#7c3aed",
  emergency_phone: "#4f46e5",
  water_shutoff: "#0284c7",
  gas_shutoff: "#b45309",
  electrical_panel: "#eab308",
  loto_isolation: "#a16207",
  roof_access: "#0d9488",
  hvac: "#075985",
  hazard: "#ea580c",
  chemical_storage: "#9333ea",
  flammable_storage: "#f97316",
  high_pressure: "#c026d3",
  co_detector: "#ca8a04",
  smoke_detector: "#57534e",
  confined_space: "#9a3412",
  sds_station: "#6d28d9",
  room_label: "#64748b",
  elevator_lobby: "#8b5cf6",
  freight_elevator: "#78716c",
};

export function colorForType(type: string): string {
  return FEATURE_TYPE_COLORS[type] ?? "#64748b";
}

/**
 * Display name for a layer preset.
 * Admin custom names (nameZh / nameEn) win; otherwise fall back to the
 * i18n presets.<slug> catalog; custom slugs without a name show the slug.
 */
export function presetDisplayName(
  preset: LayerPreset,
  lang: string,
  t: (key: string, opts?: { defaultValue?: string }) => string,
): string {
  const custom = lang.startsWith("zh") ? preset.nameZh : preset.nameEn;
  if (custom && custom.trim().length > 0) return custom;
  // Cross-language fallback: a name in either language beats the slug.
  const other = lang.startsWith("zh") ? preset.nameEn : preset.nameZh;
  if (other && other.trim().length > 0) return other;
  return t(`presets.${preset.slug}`, { defaultValue: preset.slug });
}

/** Inspection states shown only in inspection mode. */
export type InspectionBadge = "uninspected" | "ok" | "fault";

export function inspectionBadge(mark?: InspectionMark | null): InspectionBadge {
  if (!mark) return "uninspected";
  return mark.status === "fault" ? "fault" : "ok";
}

/** Badge colors: grey = uninspected, green = ok, red = fault. */
export const INSPECTION_BADGE_COLORS: Record<InspectionBadge, string> = {
  uninspected: "#9ca3af",
  ok: "#16a34a",
  fault: "#dc2626",
};

export function inspectionBadgeColor(mark?: InspectionMark | null): string {
  return INSPECTION_BADGE_COLORS[inspectionBadge(mark)];
}
