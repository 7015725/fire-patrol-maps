import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { featureMedia, features, floorPlans, floors, inspectionRecords } from "../db/schema.js";

/** Encode each path segment for `/api/uploads/...` URLs. */
export function planFileUrl(filePath: string): string {
  const encoded = filePath
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `/api/uploads/${encoded}`;
}

export type FeatureMediaPayload = {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
};

export type InspectionMarkPayload = {
  status: "ok" | "fault";
  note: string | null;
  month: string;
  updatedAt: Date;
};

export type FloorPayload = {
  id: string;
  name: string;
  slug: string;
  level: number;
  sortOrder: number;
  /** Current-month inspection state, derived server-side. */
  inspectionMonth: string;
  plan: null | {
    id: string;
    url: string;
    mimeType: string;
    width: number | null;
    height: number | null;
    uploadedAt: Date;
  };
  features: Array<{
    id: string;
    type: string;
    geometry: unknown;
    label: string | null;
    notes: string | null;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
    media: FeatureMediaPayload[];
    /** Null = uninspected this month. */
    inspection: InspectionMarkPayload | null;
  }>;
};

export async function buildFloorPayload(
  db: Db,
  floorId: string
): Promise<FloorPayload | null> {
  const [floor] = await db.select().from(floors).where(eq(floors.id, floorId)).limit(1);
  if (!floor) return null;

  const [plan] = await db
    .select()
    .from(floorPlans)
    .where(eq(floorPlans.floorId, floor.id))
    .limit(1);

  const featureRows = await db
    .select({
      id: features.id,
      type: features.type,
      geometry: features.geometry,
      label: features.label,
      notes: features.notes,
      sortOrder: features.sortOrder,
      createdAt: features.createdAt,
      updatedAt: features.updatedAt,
    })
    .from(features)
    .where(eq(features.floorId, floor.id))
    .orderBy(asc(features.sortOrder), asc(features.createdAt));

  const mediaByFeature = new Map<string, FeatureMediaPayload[]>();
  const inspectionByFeature = new Map<string, InspectionMarkPayload>();
  if (featureRows.length > 0) {
    const featureIds = featureRows.map((f) => f.id);
    const mediaRows = await db
      .select({
        id: featureMedia.id,
        featureId: featureMedia.featureId,
        filePath: featureMedia.filePath,
        mimeType: featureMedia.mimeType,
        sizeBytes: featureMedia.sizeBytes,
        createdAt: featureMedia.createdAt,
      })
      .from(featureMedia)
      .where(inArray(featureMedia.featureId, featureIds))
      .orderBy(asc(featureMedia.createdAt), asc(featureMedia.id));

    for (const row of mediaRows) {
      const item: FeatureMediaPayload = {
        id: row.id,
        url: planFileUrl(row.filePath),
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        createdAt: row.createdAt,
      };
      const list = mediaByFeature.get(row.featureId);
      if (list) {
        list.push(item);
      } else {
        mediaByFeature.set(row.featureId, [item]);
      }
    }

    // Current-month inspection marks for these features.
    const markRows = await db
      .select()
      .from(inspectionRecords)
      .where(
        and(
          eq(inspectionRecords.month, currentMonthKey()),
          inArray(inspectionRecords.featureId, featureIds),
        ),
      );
    for (const row of markRows) {
      inspectionByFeature.set(row.featureId, {
        status: row.status as "ok" | "fault",
        note: row.note,
        month: row.month,
        updatedAt: row.updatedAt,
      });
    }
  }

  return {
    id: floor.id,
    name: floor.name,
    slug: floor.slug,
    level: floor.level,
    sortOrder: floor.sortOrder,
    inspectionMonth: currentMonthKey(),
    plan: plan
      ? {
          id: plan.id,
          url: planFileUrl(plan.filePath),
          mimeType: plan.mimeType,
          width: plan.width,
          height: plan.height,
          uploadedAt: plan.uploadedAt,
        }
      : null,
    features: featureRows.map((f) => ({
      ...f,
      media: mediaByFeature.get(f.id) ?? [],
      inspection: inspectionByFeature.get(f.id) ?? null,
    })),
  };
}

/** Current month key, same rule as admin inspections route. */
function currentMonthKey(): string {
  const now = new Date();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${now.getFullYear()}-${m}`;
}
