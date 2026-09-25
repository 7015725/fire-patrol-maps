import { Hono } from "hono";
import type { Db } from "../db/client.js";
import { buildFloorPayload } from "../lib/floor-payload.js";

export function floorsRoutes(getDb: () => Db) {
  const app = new Hono();

  app.get("/:id", async (c) => {
    const payload = await buildFloorPayload(getDb(), c.req.param("id"));
    if (!payload) {
      return c.json({ error: "楼层不存在" }, 404);
    }
    return c.json(payload);
  });

  return app;
}
