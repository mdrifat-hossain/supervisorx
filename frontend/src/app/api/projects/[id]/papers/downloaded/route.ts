import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUserId, userOwnsProject } from "@/lib/project-access";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    const { id } = await params;
    if (!(await userOwnsProject(userId, id))) return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    const result = await pool.query(
      "SELECT paper_id FROM project_papers WHERE project_id = $1 AND storage_path IS NOT NULL ORDER BY downloaded_at DESC",
      [id]
    );
    return NextResponse.json({ success: true, downloaded_ids: result.rows.map((row) => row.paper_id) });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        downloaded_ids: [],
        error: error instanceof Error ? error.message : "Error fetching downloaded papers",
      },
      { status: 500 }
    );
  }
}
