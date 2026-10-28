import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function getUserId(request: Request): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (session?.user?.id) return session.user.id;
  } catch {
    // fallback below
  }

  // Resilient fallback: lookup session token directly from postgres if auth.api.getSession failed to parse
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(/(?:__Secure-)?better-auth\.session_token=([^;]+)/);
    if (match && match[1]) {
      const raw = decodeURIComponent(match[1]);
      const token = raw.split(".")[0];
      const res = await pool.query(
        `SELECT "userId" FROM session WHERE (token = $1 OR token = $2) AND "expiresAt" > NOW() LIMIT 1`,
        [token, raw]
      );
      if (res.rows.length > 0) {
        return res.rows[0].userId;
      }
    }
  } catch (err) {
    console.warn("Fallback getUserId error:", err);
  }

  return null;
}

export async function userOwnsProject(userId: string, projectId: string): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM projects WHERE id = $1 AND owner_user_id = $2 LIMIT 1",
    [projectId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}
