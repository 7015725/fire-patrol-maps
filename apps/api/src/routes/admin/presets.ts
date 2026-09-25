import { eq, max } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../../db/client.js";
import { layerPresets } from "../../db/schema.js";
import {
  FEATURE_TYPES,
  isSystemPresetSlug,
  PRESET_SEEDS,
} from "../../lib/feature-types.js";
import {
  requireAdmin,
  type AdminVariables,
} from "../../middleware/require-admin.js";

const SYSTEM_SLUGS = new Set<string>(PRESET_SEEDS.map((p) => p.slug));

const nameSchema = z
  .string()
  .trim()
  .max(40, "名称最多 40 个字符")
  .nullable()
  .optional();

const patchSchema = z.object({
  featureTypes: z.array(z.enum(FEATURE_TYPES)).optional(),
  nameZh: nameSchema,
  nameEn: nameSchema,
});

const createSchema = z.object({
  nameZh: z.string().trim().min(1, "中文名称必填").max(40, "名称最多 40 个字符"),
  nameEn: z
    .string()
    .trim()
    .max(40, "名称最多 40 个字符")
    .optional()
    .default(""),
  featureTypes: z.array(z.enum(FEATURE_TYPES)).min(1, "至少选择一种设施类型"),
});

const presetShape = {
  id: layerPresets.id,
  slug: layerPresets.slug,
  nameZh: layerPresets.nameZh,
  nameEn: layerPresets.nameEn,
  featureTypes: layerPresets.featureTypes,
  sortOrder: layerPresets.sortOrder,
} as const;

export function adminPresetsRoutes(getDb: () => Db) {
  const app = new Hono<{ Variables: AdminVariables }>();
  app.use("*", requireAdmin(getDb));

  // Create a custom preset. Slug is server-generated (custom-<rand>),
  // never collides with system slugs. Appended to the end of sort order.
  app.post("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "JSON 请求数据无效" }, 400);
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "请求数据无效", details: parsed.error.flatten() }, 400);
    }

    const db = getDb();
    const [maxRow] = await db
      .select({ maxSort: max(layerPresets.sortOrder) })
      .from(layerPresets);
    const nextSort = (maxRow?.maxSort ?? -1) + 1;
    const slug =
      `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

    const [row] = await db
      .insert(layerPresets)
      .values({
        slug,
        nameZh: parsed.data.nameZh,
        nameEn: parsed.data.nameEn || null,
        featureTypes: [...parsed.data.featureTypes],
        sortOrder: nextSort,
      })
      .returning(presetShape);

    if (!row) {
      return c.json({ error: "创建预设失败" }, 500);
    }
    return c.json(row, 201);
  });

  // Update a preset: system presets accept name changes only (their lists
  // are code-owned via PRESET_SEEDS); custom presets accept name +
  // featureTypes changes. `all` is fully locked (not even renamable).
  app.patch("/:id", async (c) => {
    const id = c.req.param("id");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "JSON 请求数据无效" }, 400);
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "请求数据无效", details: parsed.error.flatten() }, 400);
    }

    const db = getDb();
    const [existing] = await db
      .select()
      .from(layerPresets)
      .where(eq(layerPresets.id, id))
      .limit(1);
    if (!existing) {
      return c.json({ error: "预设不存在" }, 404);
    }

    if (existing.slug === "all") {
      return c.json({ error: "“全部”预设锁定，不可修改" }, 403);
    }

    const patch: {
      featureTypes?: string[];
      nameZh?: string | null;
      nameEn?: string | null;
    } = {};
    if (parsed.data.nameZh !== undefined) patch.nameZh = parsed.data.nameZh;
    if (parsed.data.nameEn !== undefined) patch.nameEn = parsed.data.nameEn;

    if (parsed.data.featureTypes !== undefined) {
      if (isSystemPresetSlug(existing.slug)) {
        return c.json(
          { error: "系统预设的设施名单由版本管理，如需定制请新建预设" },
          403,
        );
      }
      patch.featureTypes = [...parsed.data.featureTypes];
    }

    if (Object.keys(patch).length === 0) {
      return c.json({ error: "没有可更新的字段" }, 400);
    }

    const [row] = await db
      .update(layerPresets)
      .set(patch)
      .where(eq(layerPresets.id, id))
      .returning(presetShape);

    if (!row) {
      return c.json({ error: "预设不存在" }, 404);
    }
    return c.json(row);
  });

  // Delete a custom preset. System presets (incl. `all`) are locked.
  app.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const db = getDb();
    const [existing] = await db
      .select({ id: layerPresets.id, slug: layerPresets.slug })
      .from(layerPresets)
      .where(eq(layerPresets.id, id))
      .limit(1);
    if (!existing) {
      return c.json({ error: "预设不存在" }, 404);
    }
    if (existing.slug === "all") {
      return c.json({ error: "“全部”预设锁定，不可删除" }, 403);
    }
    if (SYSTEM_SLUGS.has(existing.slug)) {
      return c.json({ error: "系统预设不可删除" }, 403);
    }

    await db.delete(layerPresets).where(eq(layerPresets.id, id));
    return c.json({ ok: true });
  });

  return app;
}
