import { NextResponse } from "next/server";
import { pool, initProjectsTable } from "@/lib/db";
import { getUserId } from "@/lib/project-access";

function generateProjectId(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  return slug ? `${slug}-${randomSuffix}` : `proj-${Date.now()}`;
}

export async function GET(req: Request) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    await initProjectsTable();
    const result = await pool.query(
      "SELECT * FROM projects WHERE owner_user_id = $1 ORDER BY created_at DESC",
      [userId]
    );
    return NextResponse.json({ success: true, projects: result.rows });
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    await initProjectsTable();
    const body = await req.json();
    const { title, domain, description = "", color = "primary" } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { success: false, error: "Project Title is required" },
        { status: 400 }
      );
    }

    if (!domain || typeof domain !== "string" || !domain.trim()) {
      return NextResponse.json(
        { success: false, error: "Research Domain is required" },
        { status: 400 }
      );
    }

    const validColors = ["primary", "tertiary", "emerald", "amber", "rose", "cyan"];
    const chosenColor = validColors.includes(color) ? color : "primary";
    const id = generateProjectId(title);
    const collaborators = JSON.stringify(["ME"]);

    const query = `
      INSERT INTO projects (
        id, title, domain, description, color, papers_count, dataset_size, collaborators, owner_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
      RETURNING *
    `;
    const values = [
      id,
      title.trim(),
      domain.trim().toUpperCase(),
      description.trim(),
      chosenColor,
      0,
      "0 GB",
      collaborators,
      userId,
    ];

    const result = await pool.query(query, values);
    return NextResponse.json(
      { success: true, project: result.rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create project" },
      { status: 500 }
    );
  }
}
