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
