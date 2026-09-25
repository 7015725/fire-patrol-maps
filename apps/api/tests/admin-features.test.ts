/**
 * Admin features CRUD + users + presets integration tests.
 *
 * Uses a temp SQLite file (no external DB).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app.js";
import { createDb, type Db } from "../src/db/client.js";
import { runMigrations } from "../src/db/migrate.js";
import { seed } from "../src/db/seed.js";
import {
  adminUsers,
  buildings,
  campuses,
  features,
  floors,
  layerPresets,
} from "../src/db/schema.js";
import { hashPassword } from "../src/lib/passwords.js";
import { makeTestSqlitePath } from "./test-db.js";

const SQLITE_PATH = makeTestSqlitePath("admin-features");

const TEST_USERNAME = "features-test-admin";
const TEST_PASSWORD = "features-test-password-99";

function cookieHeaderFromSetCookie(setCookie: string | null): string {
  if (!setCookie) throw new Error("expected Set-Cookie header");
  return setCookie.split(";")[0]!;
}

describe("admin features, users, and presets", () => {
  let db: Db;
  let app: ReturnType<typeof createApp>;
  let cookie: string;
  let userId: string;
  let floorId: string;
  let createdFeatureIds: string[] = [];
  let createdUserIds: string[] = [];
  let createdFloorIds: string[] = [];
  let createdBuildingIds: string[] = [];
  let evacuationPresetId: string;
  let originalEvacuationTypes: string[];

  beforeAll(async () => {
    runMigrations(SQLITE_PATH);
    db = createDb(SQLITE_PATH);
    await seed(db);

    const passwordHash = await hashPassword(TEST_PASSWORD);
    const existing = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, TEST_USERNAME))
      .limit(1);
    if (existing[0]) {
      await db
        .update(adminUsers)
        .set({ passwordHash, disabled: false })
        .where(eq(adminUsers.id, existing[0].id));
      userId = existing[0].id;
    } else {
      const [created] = await db
        .insert(adminUsers)
        .values({
          username: TEST_USERNAME,
          passwordHash,
          disabled: false,
        })
        .returning();
      userId = created.id;
    }

    const [campus] = await db
      .insert(campuses)
      .values({
        name: "Features Test Campus",
        slug: "features-test-campus",
        sortOrder: 0,
      })
      .returning();

    const [building] = await db
      .insert(buildings)
      .values({
        campusId: campus.id,
        name: "Features Test Hall",
        slug: "features-test-hall",
        sortOrder: 0,
      })
      .returning();
    createdBuildingIds.push(building.id);

    const [floor] = await db
      .insert(floors)
      .values({
        campusId: campus.id,
        buildingId: building.id,
        name: "Features Floor",
        slug: "features-floor",
        level: 1,
        sortOrder: 0,
      })
      .returning();
    floorId = floor.id;
    createdFloorIds.push(floor.id);

    const [evac] = await db
      .select()
      .from(layerPresets)
      .where(eq(layerPresets.slug, "evacuation"))
      .limit(1);
    if (!evac) throw new Error("expected seeded evacuation preset");
    evacuationPresetId = evac.id;
    originalEvacuationTypes = [...evac.featureTypes];

    app = createApp({ db });

    const login = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
    });
    expect(login.status).toBe(200);
    cookie = cookieHeaderFromSetCookie(login.headers.get("set-cookie"));
  });

  afterAll(async () => {
    for (const id of createdFeatureIds) {
      await db.delete(features).where(eq(features.id, id));
    }
    for (const id of createdFloorIds) {
      await db.delete(floors).where(eq(floors.id, id));
    }
    for (const id of createdBuildingIds) {
      await db.delete(buildings).where(eq(buildings.id, id));
    }
    for (const id of createdUserIds) {
      await db.delete(adminUsers).where(eq(adminUsers.id, id));
    }
    await db.delete(adminUsers).where(eq(adminUsers.username, TEST_USERNAME));
    if (evacuationPresetId && originalEvacuationTypes) {
      await db
        .update(layerPresets)
        .set({ featureTypes: originalEvacuationTypes })
        .where(eq(layerPresets.id, evacuationPresetId));
    }
  });

  it("rejects administrator passwords shorter than 12 characters", async () => {
    const create = await app.request("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ username: "weak-password-admin", password: "short" }),
    });
    expect(create.status).toBe(400);

    const update = await app.request(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ password: "short" }),
    });
    expect(update.status).toBe(400);
  });

  it("creates a point feature → 201", async () => {
    const res = await app.request("/api/admin/features", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        floorId,
        type: "exit",
        geometry: { type: "point", x: 0.25, y: 0.75 },
        label: "North exit",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      id: expect.any(String),
      floorId,
      type: "exit",
      geometry: { type: "point", x: 0.25, y: 0.75 },
      label: "North exit",
    });
    createdFeatureIds.push(body.id);

    const publicRes = await app.request(`/api/floors/${floorId}`);
    expect(publicRes.status).toBe(200);
    const publicBody = await publicRes.json();
    expect(
      publicBody.features.some((f: { id: string }) => f.id === body.id)
    ).toBe(true);
  });

  it("creates a polygon feature → 201", async () => {
    const res = await app.request("/api/admin/features", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        floorId,
        type: "safe_haven",
        geometry: {
          type: "polygon",
          points: [
            [0.1, 0.1],
            [0.4, 0.1],
            [0.4, 0.4],
            [0.1, 0.4],
          ],
        },
        notes: "Shelter area",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      id: expect.any(String),
      floorId,
      type: "safe_haven",
      geometry: {
        type: "polygon",
        points: [
          [0.1, 0.1],
          [0.4, 0.1],
          [0.4, 0.4],
          [0.1, 0.4],
        ],
      },
      notes: "Shelter area",
    });
    createdFeatureIds.push(body.id);
  });

  it("rejects bad geometry → 400", async () => {
    const res = await app.request("/api/admin/features", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        floorId,
        type: "exit",
        geometry: { type: "point", x: 1.5, y: 0.5 },
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("lists admin users", async () => {
    const res = await app.request("/api/admin/users", {
      method: "GET",
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.users)).toBe(true);
    expect(body.users.length).toBeGreaterThanOrEqual(1);
    const self = body.users.find((u: { username: string }) => u.username === TEST_USERNAME);
    expect(self).toMatchObject({
      id: expect.any(String),
      username: TEST_USERNAME,
      disabled: false,
    });
    expect(self).not.toHaveProperty("passwordHash");
  });

  it("patches a layer preset featureTypes", async () => {
    const nextTypes = ["exit", "first_aid"];
    const res = await app.request(`/api/admin/presets/${evacuationPresetId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ featureTypes: nextTypes }),
    });
    // Scheme A: system preset lists are version-managed, not admin-editable.
    expect(res.status).toBe(403);
  });

  it("renames a system preset without touching its list", async () => {
    const res = await app.request(`/api/admin/presets/${evacuationPresetId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ nameZh: "疏散改名", nameEn: "Evac Renamed" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      id: evacuationPresetId,
      slug: "evacuation",
      nameZh: "疏散改名",
      nameEn: "Evac Renamed",
    });

    const publicRes = await app.request("/api/presets");
    expect(publicRes.status).toBe(200);
    const publicBody = await publicRes.json();
    const evac = publicBody.presets.find((p: { id: string }) => p.id === evacuationPresetId);
    expect(evac.nameZh).toBe("疏散改名");
    expect(evac.featureTypes).toEqual(originalEvacuationTypes);

    // Restore names for other tests / seed state.
    await db
      .update(layerPresets)
      .set({ nameZh: null, nameEn: null })
      .where(eq(layerPresets.id, evacuationPresetId));
  });

  it("creates, edits, and deletes a custom preset", async () => {
    const create = await app.request("/api/admin/presets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        nameZh: "测试预设",
        nameEn: "Test Preset",
        featureTypes: ["exit", "first_aid"],
      }),
    });
    expect(create.status).toBe(201);
    const created = await create.json();
    expect(created.slug.startsWith("custom-")).toBe(true);
    expect(created).toMatchObject({
      nameZh: "测试预设",
      nameEn: "Test Preset",
      featureTypes: ["exit", "first_aid"],
    });

    const patch = await app.request(`/api/admin/presets/${created.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        nameZh: "测试预设改",
        featureTypes: ["exit"],
      }),
    });
    expect(patch.status).toBe(200);
    expect(await patch.json()).toMatchObject({
      nameZh: "测试预设改",
      featureTypes: ["exit"],
    });

    const del = await app.request(`/api/admin/presets/${created.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(del.status).toBe(200);
  });

  it("locks system presets and all against delete/rename-abuse", async () => {
    const [all] = await db
      .select()
      .from(layerPresets)
      .where(eq(layerPresets.slug, "all"))
      .limit(1);
    expect(all).toBeTruthy();

    const delAll = await app.request(`/api/admin/presets/${all!.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(delAll.status).toBe(403);

    const patchAll = await app.request(`/api/admin/presets/${all!.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ nameZh: "全部改" }),
    });
    expect(patchAll.status).toBe(403);

    const delSystem = await app.request(
      `/api/admin/presets/${evacuationPresetId}`,
      {
        method: "DELETE",
        headers: { Cookie: cookie },
      },
    );
    expect(delSystem.status).toBe(403);
  });

  it("supports feature patch/delete and user create", async () => {
    const create = await app.request("/api/admin/features", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        floorId,
        type: "hazard",
        geometry: { type: "point", x: 0.5, y: 0.5 },
      }),
    });
    expect(create.status).toBe(201);
    const feature = await create.json();
    createdFeatureIds.push(feature.id);

    const patch = await app.request(`/api/admin/features/${feature.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ label: "Wet floor", type: "hazard" }),
    });
    expect(patch.status).toBe(200);
    expect((await patch.json()).label).toBe("Wet floor");

    const del = await app.request(`/api/admin/features/${feature.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    expect(del.status).toBe(200);
    createdFeatureIds = createdFeatureIds.filter((id) => id !== feature.id);

    const userCreate = await app.request("/api/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        username: "features-created-admin",
        password: "temp-password-123",
      }),
    });
    expect(userCreate.status).toBe(201);
    const user = await userCreate.json();
    expect(user).toMatchObject({
      username: "features-created-admin",
      disabled: false,
    });
    expect(user).not.toHaveProperty("passwordHash");
    createdUserIds.push(user.id);

    const disable = await app.request(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ disabled: true }),
    });
    expect(disable.status).toBe(200);
    expect((await disable.json()).disabled).toBe(true);
  });

  it("rejects disabling the last enabled admin", async () => {
    const list = await app.request("/api/admin/users", {
      method: "GET",
      headers: { Cookie: cookie },
    });
    expect(list.status).toBe(200);
    const { users } = (await list.json()) as {
      users: { id: string; disabled: boolean }[];
    };
    const previouslyEnabledIds = users.filter((u) => !u.disabled).map((u) => u.id);

    try {
      // Temporarily disable every other enabled admin so userId is the sole remaining one.
      for (const id of previouslyEnabledIds) {
        if (id === userId) continue;
        const res = await app.request(`/api/admin/users/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookie,
          },
          body: JSON.stringify({ disabled: true }),
        });
        expect(res.status).toBe(200);
      }

      const sole = await app.request("/api/admin/users", {
        method: "GET",
        headers: { Cookie: cookie },
      });
      const soleUsers = ((await sole.json()) as { users: { id: string; disabled: boolean }[] })
        .users;
      expect(soleUsers.filter((u) => !u.disabled).map((u) => u.id)).toEqual([userId]);

      const lockout = await app.request(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({ disabled: true }),
      });
      expect(lockout.status).toBe(400);
      expect(await lockout.json()).toEqual({
        error: "不能禁用最后一名已启用的管理员",
      });
    } finally {
      for (const id of previouslyEnabledIds) {
        await db
          .update(adminUsers)
          .set({ disabled: false })
          .where(eq(adminUsers.id, id));
      }
    }
  });
});
