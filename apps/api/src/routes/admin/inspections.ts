import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../../db/client.js";
import { features, inspectionRecords } from "../../db/schema.js";
import {
  requireAdmin,
  type AdminVariables,
} from "../../middleware/require-admin.js";

export type InspectionStatus = "ok" | "fault";

/** Current month in server local time, "YYYY-MM". */
export function currentMonth(): string {
  const now = new Date();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${now.getFullYear()}-${m}`;
}

const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "月份格式应为 YYYY-MM");

const markSchema = z.object({
  featureId: z.string().uuid(),
  /** Defaults to current month when omitted. */
  month: monthSchema.optional(),
  status: z.enum(["ok", "fault"]),
  note: z.string().max(2000).optional().nullable(),
});

const progressQuerySchema = z.object({
  month: monthSchema.optional(),
});

export type InspectionMarkPayload = {
  id: string;
  featureId: string;
  month: string;
  status: InspectionStatus;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toPayload(row: typeof inspectionRecords.$inferSelect): InspectionMarkPayload {
  return {
    id: row.id,
    featureId: row.featureId,
    month: row.month,
    status: row.status as InspectionStatus,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function adminInspectionsRoutes(getDb: () => Db) {
  const app = new Hono<{ Variables: AdminVariables }>();
  app.use("*", requireAdmin(getDb));

  /**
   * Mark a feature inspected for a month (upsert by feature+month).
   * fault requires a note.
   */
  app.post("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "JSON 请求数据无效" }, 400);
    }

    const parsed = markSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "请求数据无效", details: parsed.error.flatten() }, 400);
    }

    const { featureId, status } = parsed.data;
    const month = parsed.data.month ?? currentMonth();
    const note = parsed.data.note?.trim() ? parsed.data.note!.trim() : null;

    if (status === "fault" && !note) {
      return c.json({ error: "异常标记需要填写备注说明" }, 400);
    }

    const [feature] = await getDb()
      .select({ id: features.id })
      .from(features)
      .where(eq(features.id, featureId))
      .limit(1);
    if (!feature) {
      return c.json({ error: "设施不存在" }, 404);
    }

    const [existing] = await getDb()
      .select()
      .from(inspectionRecords)
      .where(
        and(
          eq(inspectionRecords.featureId, featureId),
          eq(inspectionRecords.month, month),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await getDb()
        .update(inspectionRecords)
        .set({ status, note, updatedAt: new Date() })
        .where(eq(inspectionRecords.id, existing.id))
        .returning();
      return c.json(toPayload(updated!));
    }

    const [created] = await getDb()
      .insert(inspectionRecords)
      .values({ featureId, month, status, note })
      .returning();
    return c.json(toPayload(created!), 201);
  });

  /** Clear a month's mark (back to uninspected). */
  app.delete("/:featureId", async (c) => {
    const featureId = c.req.param("featureId");
    const query = progressQuerySchema.safeParse(c.req.query());
    if (!query.success) {
      return c.json({ error: "月份格式应为 YYYY-MM" }, 400);
    }
    const month = query.data.month ?? currentMonth();

    const [row] = await getDb()
      .delete(inspectionRecords)
      .where(
        and(
          eq(inspectionRecords.featureId, featureId),
          eq(inspectionRecords.month, month),
        ),
      )
      .returning();
    if (!row) {
      return c.json({ error: "该设施本月暂无巡检记录" }, 404);
    }
    return c.json({ ok: true, id: row.id });
  });

  /** Monthly progress: inspected count / total features, plus fault list. */
  app.get("/progress", async (c) => {
    const query = progressQuerySchema.safeParse(c.req.query());
    if (!query.success) {
      return c.json({ error: "月份格式应为 YYYY-MM" }, 400);
    }
    const month = query.data.month ?? currentMonth();

    const allFeatures = await getDb().select({ id: features.id }).from(features);
    const total = allFeatures.length;

    const marks =
      total === 0
        ? []
        : await getDb()
            .select()
            .from(inspectionRecords)
            .where(
              and(
                eq(inspectionRecords.month, month),
                inArray(
                  inspectionRecords.featureId,
                  allFeatures.map((f) => f.id),
                ),
              ),
            );

    const inspectedIds = new Set(marks.map((m) => m.featureId));
    const faults = marks
      .filter((m) => m.status === "fault")
      .map((m) => toPayload(m));

    return c.json({
      month,
      total,
      inspected: inspectedIds.size,
      uninspected: total - inspectedIds.size,
      faults,
    });
  });

  return app;
}
