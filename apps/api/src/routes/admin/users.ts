import { and, asc, eq, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../../db/client.js";
import { adminUsers } from "../../db/schema.js";
import { hashPassword } from "../../lib/passwords.js";
import {
  requireAdmin,
  type AdminVariables,
} from "../../middleware/require-admin.js";

const createSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const patchSchema = z.object({
  disabled: z.boolean().optional(),
  password: z.string().min(1).optional(),
});

function publicAdminUser(user: {
  id: string;
  username: string;
  disabled: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    username: user.username,
    disabled: user.disabled,
    createdAt: user.createdAt,
  };
}

export function adminUsersRoutes(getDb: () => Db) {
  const app = new Hono<{ Variables: AdminVariables }>();
  app.use("*", requireAdmin(getDb));

  app.get("/", async (c) => {
    const rows = await getDb()
      .select({
        id: adminUsers.id,
        username: adminUsers.username,
        disabled: adminUsers.disabled,
        createdAt: adminUsers.createdAt,
      })
      .from(adminUsers)
      .orderBy(asc(adminUsers.username));

    return c.json({ users: rows });
  });

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

    const { username, password } = parsed.data;
    const passwordHash = await hashPassword(password);

    try {
      const [row] = await getDb()
        .insert(adminUsers)
        .values({
          username,
          passwordHash,
          disabled: false,
        })
        .returning({
          id: adminUsers.id,
          username: adminUsers.username,
          disabled: adminUsers.disabled,
          createdAt: adminUsers.createdAt,
        });
      return c.json(publicAdminUser(row), 201);
    } catch (err) {
      if (isUniqueViolation(err)) {
        return c.json({ error: "用户名已存在" }, 409);
      }
      throw err;
    }
  });

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

    if (parsed.data.disabled === undefined && parsed.data.password === undefined) {
      return c.json({ error: "没有需要更新的字段" }, 400);
    }

    const db = getDb();

    // Reject disabling the last remaining enabled admin (avoid total lockout).
    if (parsed.data.disabled === true) {
      const [target] = await db
        .select({ id: adminUsers.id, disabled: adminUsers.disabled })
        .from(adminUsers)
        .where(eq(adminUsers.id, id))
        .limit(1);

      if (!target) {
        return c.json({ error: "用户不存在" }, 404);
      }

      if (!target.disabled) {
        const [row] = await db
          .select({ count: sql<number>`count(*)` })
          .from(adminUsers)
          .where(and(eq(adminUsers.disabled, false), ne(adminUsers.id, id)));
        if ((row?.count ?? 0) === 0) {
          return c.json(
            { error: "不能禁用最后一名已启用的管理员" },
            400,
          );
        }
      }
    }

    const updates: Partial<{ disabled: boolean; passwordHash: string }> = {};
    if (parsed.data.disabled !== undefined) {
      updates.disabled = parsed.data.disabled;
    }
    if (parsed.data.password !== undefined) {
      updates.passwordHash = await hashPassword(parsed.data.password);
    }

    const [row] = await db
      .update(adminUsers)
      .set(updates)
      .where(eq(adminUsers.id, id))
      .returning({
        id: adminUsers.id,
        username: adminUsers.username,
        disabled: adminUsers.disabled,
        createdAt: adminUsers.createdAt,
      });

    if (!row) {
      return c.json({ error: "用户不存在" }, 404);
    }
    return c.json(publicAdminUser(row));
  });

  return app;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  );
}
