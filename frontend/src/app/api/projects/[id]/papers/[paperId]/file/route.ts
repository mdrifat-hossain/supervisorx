import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUserId, userOwnsProject } from "@/lib/project-access";
import { createPrivatePdfUrl } from "@/lib/supabase-storage";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; paperId: string }> }
) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    const { id, paperId } = await params;
    if (!(await userOwnsProject(userId, id))) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }
    const result = await pool.query(
      "SELECT storage_bucket, storage_path FROM project_papers WHERE project_id = $1 AND paper_id = $2",
      [id, paperId]
    );
    if (!result.rows[0]?.storage_bucket || !result.rows[0]?.storage_path) {
      return NextResponse.json({ success: false, error: "PDF not found" }, { status: 404 });
    }
    const url = await createPrivatePdfUrl(result.rows[0].storage_bucket, result.rows[0].storage_path);
    return NextResponse.redirect(url, { status: 307 });
  } catch (error) {
    console.error("GET project PDF error:", error);
    return NextResponse.json({ success: false, error: "Could not retrieve PDF" }, { status: 500 });
  }
}
