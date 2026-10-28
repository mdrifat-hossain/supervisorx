import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUserId, userOwnsProject } from "@/lib/project-access";
import { fetchFromBackend } from "@/lib/backend-api";

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

    const apiKey = process.env.INTERNAL_API_KEY;
    const backendRes = await fetchFromBackend(
      `/api/projects/${encodeURIComponent(id)}/papers/${encodeURIComponent(paperId)}/analysis`,
      {
        headers: {
          "X-Internal-Api-Key": apiKey || "",
          "X-User-Id": userId,
        },
      }
    );

    if (backendRes.ok) {
      const data = await backendRes.json();
      return NextResponse.json(data);
    }

    return NextResponse.json({ success: false, error: "Analysis details not found" }, { status: 404 });
  } catch (error: unknown) {
    console.error("GET paper details error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const { removePrivateObject } = await import("@/lib/supabase-storage");

    // Fetch storage info before deletion
    const selectRes = await pool.query(
      `SELECT id, paper_id, storage_bucket, storage_path, primary_category 
       FROM project_papers 
       WHERE project_id = $1 AND (paper_id = $2 OR id = $2)`,
      [id, paperId]
    );

    for (const row of selectRes.rows) {
      if (row.storage_bucket && row.storage_path) {
        // Only delete file from Supabase Storage if no other project is using this same file
        const otherRefCheck = await pool.query(
          "SELECT COUNT(*) AS count FROM project_papers WHERE storage_path = $1 AND project_id != $2",
          [row.storage_path, id]
        );
        const isReferencedElsewhere = Number(otherRefCheck.rows[0]?.count || 0) > 0;

        if (!isReferencedElsewhere) {
          try {
            await removePrivateObject(row.storage_bucket, row.storage_path);
            if (row.primary_category === "Generated Report" && row.storage_path.endsWith(".pdf")) {
              const docxPath = row.storage_path.replace(/\.pdf$/i, ".docx");
              await removePrivateObject(row.storage_bucket, docxPath).catch(() => {});
            }
          } catch (storageErr) {
            console.warn("Failed to remove object from Supabase Storage:", storageErr);
          }
        }
      }
    }

    // Direct deletion from PostgreSQL with full cascade cleanup of analyzed information
    await pool.query("DELETE FROM paper_vectors WHERE project_id = $1 AND (paper_id = $2 OR id = $2)", [id, paperId]);
    await pool.query("DELETE FROM paper_text_chunks WHERE project_id = $1 AND (paper_id = $2 OR id = $2)", [id, paperId]);
    await pool.query("DELETE FROM paper_visual_items WHERE project_id = $1 AND (paper_id = $2 OR id = $2)", [id, paperId]);
    await pool.query("DELETE FROM paper_processing_jobs WHERE project_id = $1 AND (paper_id = $2 OR id = $2)", [id, paperId]);
    await pool.query("DELETE FROM project_papers WHERE project_id = $1 AND (paper_id = $2 OR id = $2)", [id, paperId]);
    await pool.query(
      `UPDATE projects 
       SET papers_count = (SELECT COUNT(*) FROM project_papers WHERE project_id = $1 AND (primary_category IS NULL OR primary_category != 'Generated Report')), 
           updated_at = NOW() 
       WHERE id = $1`,
      [id]
    );

    return NextResponse.json({ success: true, deleted_paper_id: paperId });
  } catch (error: unknown) {
    console.error("DELETE paper error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete paper" },
      { status: 500 }
    );
  }
}
