import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getUserId, userOwnsProject } from "@/lib/project-access";

const CANDIDATE_BACKEND_URLS = [
  process.env.BACKEND_URL,
  "http://backend:8000",
  "http://localhost:8000",
].filter(Boolean) as string[];

async function fetchFromBackend(endpoint: string, options: RequestInit) {
  let lastError: unknown = null;
  for (const base of CANDIDATE_BACKEND_URLS) {
    try {
      const res = await fetch(`${base}${endpoint}`, options);
      return res;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Could not reach Python backend service");
}

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

    // Direct deletion from PostgreSQL with pgvector cleanup
    await pool.query("DELETE FROM paper_vectors WHERE project_id = $1 AND (paper_id = $2 OR id = $2)", [id, paperId]);
    await pool.query("DELETE FROM paper_text_chunks WHERE project_id = $1 AND (paper_id = $2 OR id = $2)", [id, paperId]);
    await pool.query("DELETE FROM paper_visual_items WHERE project_id = $1 AND (paper_id = $2 OR id = $2)", [id, paperId]);
    await pool.query("DELETE FROM project_papers WHERE project_id = $1 AND (paper_id = $2 OR id = $2)", [id, paperId]);
    await pool.query(
      "UPDATE projects SET papers_count = (SELECT COUNT(*) FROM project_papers WHERE project_id = $1), updated_at = NOW() WHERE id = $1",
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
