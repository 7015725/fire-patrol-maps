import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Db } from "../../db/client.js";
import { floorPlans, floors } from "../../db/schema.js";
import { env } from "../../lib/env.js";
import { planFileUrl } from "../../lib/floor-payload.js";
import { readPlanDimensions } from "../../lib/plan-dimensions.js";
import {
  requireAdmin,
  type AdminVariables,
} from "../../middleware/require-admin.js";

const ALLOWED_MIME = new Set(["image/svg+xml", "image/png", "image/jpeg"]);

const EXT_BY_MIME: Record<string, string> = {
  "image/svg+xml": ".svg",
  "image/png": ".png",
  "image/jpeg": ".jpg",
};

const MIME_BY_EXT: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export function adminPlansRoutes(getDb: () => Db, uploadDir: string) {
  const app = new Hono<{ Variables: AdminVariables }>();
  app.use("*", requireAdmin(getDb));

  app.post("/:id/plan", async (c) => {
    const floorId = c.req.param("id");
    const db = getDb();

    const [floor] = await db
      .select({ id: floors.id })
      .from(floors)
      .where(eq(floors.id, floorId))
      .limit(1);
    if (!floor) {
      return c.json({ error: "楼层不存在" }, 404);
    }

    const contentLength = c.req.header("content-length");
    if (contentLength) {
      const n = Number(contentLength);
      if (Number.isFinite(n) && n > env.MAX_UPLOAD_BYTES) {
        return c.json({ error: "文件过大" }, 413);
      }
    }

    let body: Record<string, unknown>;
    try {
      body = await c.req.parseBody({ all: true });
    } catch {
      return c.json({ error: "表单数据无效" }, 400);
    }

    const file = body["file"];
    if (!(file instanceof File)) {
      return c.json({ error: "缺少文件字段 file" }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > env.MAX_UPLOAD_BYTES) {
      return c.json({ error: "文件过大" }, 413);
    }
    if (buffer.byteLength === 0) {
      return c.json({ error: "文件内容为空" }, 400);
    }

    const mimeType = resolveMimeType(file);
    if (!mimeType || !ALLOWED_MIME.has(mimeType)) {
      return c.json(
        { error: "不支持的文件类型，仅支持 image/svg+xml、image/png、image/jpeg" },
        400
      );
    }
    const dims = readPlanDimensions(buffer, mimeType);

    const ext = EXT_BY_MIME[mimeType] ?? ".bin";
    const filename = `${randomUUID()}${ext}`;
    // Store relative path with forward slashes for URL serving
    const relativePath = `${floorId}/${filename}`;
    const absoluteDir = path.join(uploadDir, floorId);
    const absolutePath = path.join(absoluteDir, filename);

    // Write new file first so a failed DB update never leaves the row pointing
    // at a deleted path. Unlink the previous file only after DB succeeds.
    await fs.mkdir(absoluteDir, { recursive: true });
    await fs.writeFile(absolutePath, buffer);

    const [existing] = await db
      .select()
      .from(floorPlans)
      .where(eq(floorPlans.floorId, floorId))
      .limit(1);

    let plan;
    try {
      if (existing) {
        const [updated] = await db
          .update(floorPlans)
          .set({
            filePath: relativePath,
            mimeType,
            width: dims?.width ?? null,
            height: dims?.height ?? null,
            uploadedAt: new Date(),
          })
          .where(eq(floorPlans.floorId, floorId))
          .returning();
        plan = updated;
      } else {
        const [inserted] = await db
          .insert(floorPlans)
          .values({
            floorId,
            filePath: relativePath,
            mimeType,
            width: dims?.width ?? null,
            height: dims?.height ?? null,
          })
          .returning();
        plan = inserted;
      }
    } catch (err) {
      // DB failed after write — remove the orphan new file
      await fs.unlink(absolutePath).catch(() => undefined);
      throw err;
    }

    if (existing) {
      const oldAbs = path.join(uploadDir, ...existing.filePath.split("/"));
      if (oldAbs !== absolutePath) {
        await fs.unlink(oldAbs).catch(() => undefined);
      }
    }

    return c.json(
      {
        id: plan.id,
        floorId: plan.floorId,
        filePath: plan.filePath,
        mimeType: plan.mimeType,
        width: plan.width,
        height: plan.height,
        uploadedAt: plan.uploadedAt,
        url: planFileUrl(plan.filePath),
      },
      201
    );
  });

  return app;
}

function resolveMimeType(file: File): string | null {
  const type = (file.type || "").toLowerCase().trim();
  if (ALLOWED_MIME.has(type)) return type;

  // Fallback: extension when browser omits type
  const name = file.name || "";
  const ext = path.extname(name).toLowerCase();
  return MIME_BY_EXT[ext] ?? null;
}
