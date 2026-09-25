import { sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { adminUsers } from "../db/schema.js";
import { env } from "./env.js";
import { hashPassword, MIN_ADMIN_PASSWORD_LENGTH } from "./passwords.js";

/**
 * Create the first admin from env when the table is empty.
 * No-op if any user exists, or if either bootstrap env var is empty.
 */
export async function bootstrapAdmin(db: Db): Promise<void> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(adminUsers);
  if ((row?.count ?? 0) > 0) {
    return;
  }

  const username = env.ADMIN_BOOTSTRAP_USERNAME.trim();
  const password = env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "No administrator exists. Set ADMIN_BOOTSTRAP_USERNAME and ADMIN_BOOTSTRAP_PASSWORD before first startup.",
    );
  }
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH || password === "changeme") {
    throw new Error(
      `ADMIN_BOOTSTRAP_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters and not a known default.`,
    );
  }

  const passwordHash = await hashPassword(password);
  await db.insert(adminUsers).values({
    username,
    passwordHash,
  });
}
