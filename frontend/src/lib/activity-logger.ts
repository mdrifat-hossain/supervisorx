import { pool, initProjectsTable } from "@/lib/db";

export type ActivityType =
  | "chat_message"
  | "paper_download"
  | "paper_analysis"
  | "paper_search"
  | "probe_test";

export async function logProjectActivity(
  projectId: string,
  activityType: ActivityType,
  description?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await initProjectsTable();
    const id = `act-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    await pool.query(
      `INSERT INTO project_activities (id, project_id, activity_type, description, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [id, projectId, activityType, description || "", JSON.stringify(metadata || {})]
    );
  } catch (err) {
    console.error("Failed to log project activity:", err);
  }
}
