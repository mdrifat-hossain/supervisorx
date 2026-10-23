import { NextResponse } from "next/server";
import { pool, initProjectsTable } from "@/lib/db";
import { getUserId, userOwnsProject } from "@/lib/project-access";

// GET /api/projects/[id]/chat/sessions - List all chat sessions for a project
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    await initProjectsTable();
    const { id: projectId } = await params;
    if (!(await userOwnsProject(userId, projectId))) return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });

    const res = await pool.query(
      `SELECT id, title, paper_count, created_at, updated_at
       FROM chat_sessions
       WHERE project_id = $1
       ORDER BY updated_at DESC`,
      [projectId]
    );

    const sessions = res.rows.map((row) => ({
      id: row.id,
      title: row.title,
      paperCount: row.paper_count || 0,
      timeLabel: new Date(row.updated_at).toLocaleDateString([], {
        month: "short",
        day: "numeric",
      }),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ success: true, sessions });
  } catch (error) {
    console.error("GET /api/projects/[id]/chat/sessions error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch chat sessions" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/chat/sessions - Create a new session
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    await initProjectsTable();
    const { id: projectId } = await params;
    if (!(await userOwnsProject(userId, projectId))) return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    const body = await req.json();
    const id = body.id || `session-${Date.now()}`;
    const title = body.title?.trim() || "New Research Inquiry";

    const res = await pool.query(
      `INSERT INTO chat_sessions (id, project_id, title, paper_count)
       VALUES ($1, $2, $3, 0)
       RETURNING id, title, paper_count, created_at, updated_at`,
      [id, projectId, title]
    );

    const row = res.rows[0];
    return NextResponse.json({
      success: true,
      session: {
        id: row.id,
        title: row.title,
        paperCount: row.paper_count,
        timeLabel: "Just now",
        isActive: true,
      },
    });
  } catch (error) {
    console.error("POST /api/projects/[id]/chat/sessions error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create chat session" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id]/chat/sessions - Rename a session
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    await initProjectsTable();
    const { id: projectId } = await params;
    if (!(await userOwnsProject(userId, projectId))) return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    const body = await req.json();
    const { sessionId, title, paperCount } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "sessionId is required" },
        { status: 400 }
      );
    }

    let query = `UPDATE chat_sessions SET updated_at = NOW()`;
    const values: (string | number)[] = [String(sessionId), projectId];

    if (title !== undefined) {
      values.push(String(title).trim());
      query += `, title = $${values.length}`;
    }
    if (paperCount !== undefined) {
      values.push(Number(paperCount));
      query += `, paper_count = $${values.length}`;
    }

    query += ` WHERE id = $1 AND project_id = $2 RETURNING *`;

    const res = await pool.query(query, values);
    if (res.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, session: res.rows[0] });
  } catch (error) {
    console.error("PATCH /api/projects/[id]/chat/sessions error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update session" },
      { status: 500 }
    );
  }
}
