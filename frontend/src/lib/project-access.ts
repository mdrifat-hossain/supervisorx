import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function getUserId(request: Request): Promise<string | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user?.id ?? null;
}

export async function userOwnsProject(userId: string, projectId: string): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM projects WHERE id = $1 AND owner_user_id = $2 LIMIT 1",
    [projectId, userId]
  );
  return result.rowCount === 1;
}
