import { NextResponse } from "next/server";
import { pool, initProjectsTable } from "@/lib/db";
import { getUserId, userOwnsProject } from "@/lib/project-access";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    await initProjectsTable();
    const { id } = await params;
    if (!(await userOwnsProject(userId, id))) return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    const result = await pool.query("SELECT * FROM projects WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, project: result.rows[0] });
  } catch (error) {
    console.error("GET /api/projects/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    await initProjectsTable();
    const { id } = await params;
    if (!(await userOwnsProject(userId, id))) return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    const body = await req.json();
    const { title, domain, description, color } = body;

    const existing = await pool.query("SELECT * FROM projects WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    const current = existing.rows[0];
    const newTitle = title !== undefined ? String(title).trim() : current.title;
    const newDomain =
      domain !== undefined ? String(domain).trim().toUpperCase() : current.domain;
    const newDesc =
      description !== undefined ? String(description).trim() : current.description;

    const validColors = ["primary", "tertiary", "emerald", "amber", "rose", "cyan"];
    const newColor =
      color !== undefined && validColors.includes(color) ? color : current.color;

    const query = `
      UPDATE projects
      SET title = $1, domain = $2, description = $3, color = $4, updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `;
    const result = await pool.query(query, [
      newTitle,
      newDomain,
      newDesc,
      newColor,
      id,
    ]);

    return NextResponse.json({ success: true, project: result.rows[0] });
  } catch (error) {
    console.error("PATCH /api/projects/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update project" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    await initProjectsTable();
    const { id } = await params;
    if (!(await userOwnsProject(userId, id))) return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    const result = await pool.query(
      "DELETE FROM projects WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error("DELETE /api/projects/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
