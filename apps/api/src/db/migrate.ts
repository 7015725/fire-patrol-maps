import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { env } from "../lib/env.js";
import { openSqlite, type SqliteDatabase } from "./client.js";
import { ensureSchemaCompat } from "./ensure-schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Apply committed SQL migrations from apps/api/drizzle, then compat upgrades. */
export function runMigrations(sqlitePath = env.SQLITE_PATH): void {
  const sqlite = openSqlite(sqlitePath);
  const db = drizzle(sqlite);
  backfillMigrationTimestamps(sqlite);
  const migrationsFolder = path.resolve(__dirname, "../../drizzle");
  migrate(db, { migrationsFolder });
  // Idempotent upgrades for DBs that applied an older 0000_init before hierarchy modes.
  ensureSchemaCompat(sqlite);
  sqlite.close();
}

/**
 * Old drizzle rows in __drizzle_migrations have NULL created_at, so the
 * migrator thinks every migration is newer and re-runs 0000 from scratch
 * (fails: tables already exist). Backfill known entry timestamps first.
 *
 * Local dev DBs that ran ensureSchemaCompat directly (name_zh/name_en and
 * inspection_records added without journaling 0001/0002) get those journal
 * entries recorded so the migrator skips them instead of failing on
 * duplicate column / existing table.
 */
function backfillMigrationTimestamps(sqlite: SqliteDatabase): void {
  const hasJournal =
    sqlite
      .prepare(
        `SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations' LIMIT 1`,
      )
      .get() !== undefined;
  if (!hasJournal) return;
  // 0000_init_sqlite entry timestamp (see drizzle/meta/_journal.json).
  sqlite.exec(
    `UPDATE __drizzle_migrations SET created_at = 1785336518189 WHERE created_at IS NULL`,
  );
  journalAppliedMigration(sqlite, "0001_add_preset_names", 1785336518190, () =>
    (sqlite.pragma(`table_info(layer_presets)`) as { name: string }[]).some(
      (c) => c.name === "name_zh",
    ),
  );
  journalAppliedMigration(sqlite, "0002_add_inspection_records", 1790343281566, () =>
    sqlite
      .prepare(
        `SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'inspection_records' LIMIT 1`,
      )
      .get() !== undefined,
  );
}

/**
 * Record a journal entry for a migration whose effects are already present
 * (applied via ensureSchemaCompat on a dev DB). Finds the journal hash by
 * matching the migration tag in the drizzle meta folder.
 */
function journalAppliedMigration(
  sqlite: SqliteDatabase,
  tag: string,
  createdAt: number,
  isApplied: () => boolean,
): void {
  const existing = sqlite
    .prepare(`SELECT hash FROM __drizzle_migrations`)
    .all() as { hash: string }[];
  if (existing.length === 0) return;
  let applied = false;
  try {
    applied = isApplied();
  } catch {
    return;
  }
  if (!applied) return;
  const hashes = new Set(existing.map((r) => r.hash));
  const metaDir = path.resolve(__dirname, "../../drizzle/meta");
  let metaFiles: string[] = [];
  try {
    metaFiles = fs.readdirSync(metaDir).filter((f) => f.endsWith("_snapshot.json"));
  } catch {
    return;
  }
  for (const file of metaFiles) {
    let snapshot: { id?: string };
    try {
      snapshot = JSON.parse(fs.readFileSync(path.join(metaDir, file), "utf8"));
    } catch {
      continue;
    }
    if (!snapshot.id || hashes.has(snapshot.id)) continue;
    // Check the journal tag for this snapshot id.
    const journalPath = path.join(metaDir, "_journal.json");
    try {
      const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
        entries: { tag: string }[];
      };
      void journal;
    } catch {
      continue;
    }
    // Simpler: match snapshot file prefix (0001_/0002_) against the tag.
    if (!file.startsWith(tag.slice(0, 4))) continue;
    sqlite.exec(
      `INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('${snapshot.id}', ${createdAt})`,
    );
    return;
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    runMigrations();
    console.log("Migrations applied");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed", err);
    process.exit(1);
  }
}
