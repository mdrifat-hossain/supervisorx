import { NextResponse } from "next/server";
import { pool, initProjectsTable } from "@/lib/db";
import { getUserId } from "@/lib/project-access";

function formatTimeAgo(dateString?: string | Date | null): string {
  if (!dateString) return "Recently";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "Just now";
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

export async function GET(req: Request) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }

    await initProjectsTable();

    // Query only real projects owned by this user (up to 4 most recent)
    const projectsRes = await pool.query(
      `SELECT 
        id, 
        title, 
        domain, 
        description, 
        color, 
        papers_count, 
        created_at, 
        updated_at, 
        COALESCE(last_accessed_at, updated_at, created_at) AS last_accessed_at
      FROM projects 
      WHERE owner_user_id = $1 
      ORDER BY COALESCE(last_accessed_at, updated_at, created_at) DESC 
      LIMIT 4`,
      [userId]
    );

    const projectRows = projectsRes.rows;
    if (projectRows.length === 0) {
      return NextResponse.json({ success: true, projects: [] });
    }

    const projectIds = projectRows.map((p) => p.id);

    // Fetch latest activity for each of the projects
    const activitiesRes = await pool.query(
      `SELECT DISTINCT ON (project_id)
        id,
        project_id,
        activity_type,
        description,
        created_at
      FROM project_activities
      WHERE project_id = ANY($1)
      ORDER BY project_id, created_at DESC`,
      [projectIds]
    );

    const activityMap = new Map<string, { type: string; description: string; created_at: string }>();
    for (const act of activitiesRes.rows) {
      activityMap.set(act.project_id, {
        type: act.activity_type,
        description: act.description,
        created_at: act.created_at,
      });
    }

    const projects = projectRows.map((p) => {
      const act = activityMap.get(p.id) || null;
      return {
        id: p.id,
        title: p.title,
        domain: p.domain,
        description: p.description,
        color: p.color || "primary",
        papers_count: p.papers_count || 0,
        last_accessed_at: p.last_accessed_at,
        last_access_label: formatTimeAgo(p.last_accessed_at),
        latest_activity: act,
      };
    });

    return NextResponse.json({ success: true, projects });
  } catch (error) {
    console.error("GET /api/projects/recent error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch recent projects" },
      { status: 500 }
    );
  }
}
