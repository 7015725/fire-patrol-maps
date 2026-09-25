export type HierarchyMode = "full" | "no_buildings" | "single_map";

export type CampusSummary = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  hierarchyMode: HierarchyMode;
};

export type BuildingSummary = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
};

export type FloorSummary = {
  id: string;
  name: string;
  slug: string;
  level: number;
  sortOrder: number;
};

export type CampusDetail = CampusSummary & {
  buildings: BuildingSummary[];
  floors: FloorSummary[];
  mapFloorId?: string | null;
};

export type BuildingDetail = BuildingSummary & {
  floors: FloorSummary[];
};

export type CampusesResponse = {
  campuses: CampusSummary[];
};

/** Mirrors apps/api/src/lib/feature-types.ts FEATURE_TYPES */
export const FEATURE_TYPES = [
  "fire_extinguisher",
  "fire_hydrant",
  "extinguisher_hydrant_combo",
  "exit",
  "assembly_point",
  "safe_haven",
  "fire_alarm_pull",
  "electrical_fire_controller",
  "gas_suppression_controller",
  "water_gong",
  "aed",
  "first_aid",
  "eye_wash",
  "safety_shower",
  "spill_kit",
  "emergency_phone",
  "water_shutoff",
  "gas_shutoff",
  "electrical_panel",
  "loto_isolation",
  "roof_access",
  "hvac",
  "hazard",
  "chemical_storage",
  "flammable_storage",
  "high_pressure",
  "co_detector",
  "smoke_detector",
  "confined_space",
  "sds_station",
  "room_label",
  "elevator_lobby",
  "freight_elevator",
] as const;

export type FeatureType = (typeof FEATURE_TYPES)[number];

export type PointGeometry = {
  type: "point";
  x: number;
  y: number;
};

export type PolygonGeometry = {
  type: "polygon";
  points: [number, number][];
};

export type CircleGeometry = {
  type: "circle";
  x: number;
  y: number;
  /** Radius as a fraction of plan width. */
  r: number;
};

export type FeatureGeometry = PointGeometry | PolygonGeometry | CircleGeometry;

export type FeatureMedia = {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type InspectionMark = {
  status: "ok" | "fault";
  note: string | null;
  month: string;
  updatedAt: string;
};

export type MapFeature = {
  id: string;
  type: string;
  geometry: FeatureGeometry | unknown;
  label: string | null;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  /** Present on floor detail payloads; omitted from create/patch responses. */
  media?: FeatureMedia[];
  /** Null = uninspected this month. Present on floor detail payloads. */
  inspection?: InspectionMark | null;
};

export type FloorPlan = {
  id: string;
  url: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  uploadedAt: string;
};

export type FloorDetail = FloorSummary & {
  plan: FloorPlan | null;
  features: MapFeature[];
  /** Current-month key, e.g. "2026-09". */
  inspectionMonth?: string;
};

export type LayerPreset = {
  id: string;
  slug: string;
  /** Admin custom display name (Chinese). Null = fall back to i18n presets.<slug>. */
  nameZh: string | null;
  /** Admin custom display name (English). Null = fall back to i18n presets.<slug>. */
  nameEn: string | null;
  featureTypes: string[];
  sortOrder: number;
};

export type InspectionProgress = {
  month: string;
  total: number;
  inspected: number;
  uninspected: number;
  faults: Array<{
    id: string;
    featureId: string;
    month: string;
    status: "ok" | "fault";
    note: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type PresetsResponse = {
  presets: LayerPreset[];
};
