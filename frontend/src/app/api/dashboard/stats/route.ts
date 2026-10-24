import { NextResponse } from "next/server";
import { pool, initProjectsTable } from "@/lib/db";
import { getUserId } from "@/lib/project-access";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 MB";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export async function GET(req: Request) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }

    await initProjectsTable();

    // 1. Total projects count owned by user
    const projRes = await pool.query(
      `SELECT COUNT(*)::int as total_projects FROM projects WHERE owner_user_id = $1`,
      [userId]
    );
    const totalProjects = projRes.rows[0]?.total_projects || 0;

    // 2. Total papers and storage size occupied across all user's projects
    const papersRes = await pool.query(
      `SELECT 
         COUNT(*)::int as total_papers,
         COALESCE(SUM(p.file_size), 0)::bigint as total_bytes,
         COUNT(*) FILTER (WHERE p.analysis_status = 'analyzed')::int as total_analyzed
       FROM project_papers p
       JOIN projects pr ON pr.id = p.project_id
       WHERE pr.owner_user_id = $1`,
      [userId]
    );

    const totalPapers = papersRes.rows[0]?.total_papers || 0;
    const totalBytes = Number(papersRes.rows[0]?.total_bytes || 0);
    const totalAnalyzed = papersRes.rows[0]?.total_analyzed || 0;
    const totalStorageLabel = formatBytes(totalBytes);

    return NextResponse.json({
      success: true,
      totalProjects,
      totalPapers,
      totalAnalyzed,
      totalBytes,
      totalStorageLabel,
    });
  } catch (error) {
    console.error("GET /api/dashboard/stats error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
