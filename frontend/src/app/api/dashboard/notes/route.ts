import { NextResponse } from "next/server";
import { pool, initProjectsTable } from "@/lib/db";
import { getUserId } from "@/lib/project-access";

export async function GET(req: Request) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }

    await initProjectsTable();

    // Query user notes ordered by is_pinned DESC, then created_at DESC
    const existing = await pool.query(
      `SELECT * FROM sticky_notes WHERE user_id = $1 ORDER BY is_pinned DESC, created_at DESC`,
      [userId]
    );

    return NextResponse.json({ success: true, notes: existing.rows });
  } catch (error) {
    console.error("GET /api/dashboard/notes error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }

    await initProjectsTable();

    const body = await req.json();
    const {
      title,
      description = "",
      category = "Active Note",
      color_type = "amber",
      status = "Active",
      is_pinned = false,
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
    }

    const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const insertRes = await pool.query(
      `INSERT INTO sticky_notes (id, user_id, title, description, category, color_type, status, is_pinned, pinned_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $8 = TRUE THEN NOW() ELSE NULL END, NOW(), NOW())
       RETURNING *`,
      [
        noteId,
        userId,
        title.trim(),
        description.trim(),
        category.trim() || "Active Note",
        color_type || "amber",
        status.trim() || "Active",
        Boolean(is_pinned),
      ]
    );

    return NextResponse.json({ success: true, note: insertRes.rows[0] });
  } catch (error) {
    console.error("POST /api/dashboard/notes error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }

    await initProjectsTable();

    const body = await req.json();
    const { id, is_pinned, title, description, category, color_type, status } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Note ID is required" }, { status: 400 });
    }

    // Build update query dynamically
    const updates: string[] = ["updated_at = NOW()"];
    const values: any[] = [];
    let idx = 1;

    if (typeof is_pinned === "boolean") {
      updates.push(`is_pinned = $${idx}`);
      values.push(is_pinned);
      idx++;
      if (is_pinned) {
        updates.push(`pinned_at = NOW()`);
      } else {
        updates.push(`pinned_at = NULL`);
      }
    }

    if (typeof title === "string" && title.trim()) {
      updates.push(`title = $${idx}`);
      values.push(title.trim());
      idx++;
    }

    if (typeof description === "string") {
      updates.push(`description = $${idx}`);
      values.push(description.trim());
      idx++;
    }

    if (typeof category === "string" && category.trim()) {
      updates.push(`category = $${idx}`);
      values.push(category.trim());
      idx++;
    }

    if (typeof color_type === "string") {
      updates.push(`color_type = $${idx}`);
      values.push(color_type);
      idx++;
    }

    if (typeof status === "string" && status.trim()) {
      updates.push(`status = $${idx}`);
      values.push(status.trim());
      idx++;
    }

    values.push(id, userId);
    const updateSql = `
      UPDATE sticky_notes
      SET ${updates.join(", ")}
      WHERE id = $${idx} AND user_id = $${idx + 1}
      RETURNING *
    `;

    const updateRes = await pool.query(updateSql, values);
    if (updateRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Note not found or permission denied" }, { status: 404 });
    }

    return NextResponse.json({ success: true, note: updateRes.rows[0] });
  } catch (error) {
    console.error("PATCH /api/dashboard/notes error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }

    await initProjectsTable();

    const { searchParams } = new URL(req.url);
    let noteId = searchParams.get("id");

    if (!noteId) {
      try {
        const body = await req.json();
        noteId = body.id;
      } catch {
        // no body
      }
    }

    if (!noteId) {
      return NextResponse.json({ success: false, error: "Note ID is required" }, { status: 400 });
    }

    const delRes = await pool.query(
      `DELETE FROM sticky_notes WHERE id = $1 AND user_id = $2 RETURNING id`,
      [noteId, userId]
    );

    if (delRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Note not found or permission denied" }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: noteId });
  } catch (error) {
    console.error("DELETE /api/dashboard/notes error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
