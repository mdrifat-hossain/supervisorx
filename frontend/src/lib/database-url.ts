export function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL or SUPABASE_DATABASE_URL is required");

  const url = new URL(value);
  const poolerHost = process.env.SUPABASE_DB_POOLER_HOST;
  if (poolerHost && url.hostname.startsWith("db.") && url.hostname.endsWith(".supabase.co")) {
    const projectRef = process.env.SUPABASE_URL
      ? new URL(process.env.SUPABASE_URL).hostname.split(".")[0]
      : "";
    if (!projectRef) throw new Error("SUPABASE_URL is required when using the Supabase pooler");
    url.hostname = poolerHost;
    url.port = "5432";
    url.username = `postgres.${projectRef}`;
  }
  return url.toString();
}
