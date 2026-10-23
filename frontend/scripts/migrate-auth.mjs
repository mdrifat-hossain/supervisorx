import { getMigrations } from "better-auth/db/migration";
import { auth, pool } from "../src/lib/auth.ts";

try {
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
  console.info("Better Auth PostgreSQL schema is up to date.");
} finally {
  await pool.end();
}
