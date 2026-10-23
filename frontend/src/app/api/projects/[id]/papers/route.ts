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
    const { searchParams } = new URL(req.url);

    const query = searchParams.get("query")?.trim() || "";
    const year = searchParams.get("year");
    const sort = searchParams.get("sort") || "newest";

    const effectiveProjectId = id;

    // Build dynamic query
    const conditions: string[] = ["project_id = $1"];
    const values: (string | number)[] = [effectiveProjectId];

    if (query) {
      values.push(`%${query}%`);
      conditions.push(
        `(title ILIKE $${values.length} OR authors ILIKE $${values.length} OR venue ILIKE $${values.length} OR summary ILIKE $${values.length})`
      );
    }

    if (year && year !== "all" && !isNaN(Number(year))) {
      values.push(Number(year));
      conditions.push(`year = $${values.length}`);
    }

    let orderByClause = "downloaded_at DESC";
    if (sort === "az") {
      orderByClause = "title ASC";
    } else if (sort === "za") {
      orderByClause = "title DESC";
    } else if (sort === "year_desc") {
      orderByClause = "year DESC NULLS LAST, downloaded_at DESC";
    } else if (sort === "year_asc") {
      orderByClause = "year ASC NULLS LAST, downloaded_at ASC";
    } else if (sort === "size") {
      orderByClause = "file_size DESC";
    } else if (sort === "oldest") {
      orderByClause = "downloaded_at ASC";
    }

    const sql = `
      SELECT 
        id,
        project_id,
        paper_id,
        title,
        authors,
        venue,
        year,
        published,
        summary,
        pdf_url,
        entry_url,
        primary_category,
        file_name,
        storage_path,
        file_size,
        file_size_label,
        tags,
        downloaded_at
      FROM project_papers
      WHERE ${conditions.join(" AND ")}
      ORDER BY ${orderByClause};
    `;

    const result = await pool.query(sql, values);

    // Get all available distinct years for the filter dropdown
    const yearsResult = await pool.query(
      `SELECT DISTINCT year FROM project_papers WHERE project_id = $1 AND year IS NOT NULL ORDER BY year DESC;`,
      [effectiveProjectId]
    );
    const availableYears = yearsResult.rows.map((r) => r.year);

    // Total count for project without search filters
    const totalResult = await pool.query(
      `SELECT COUNT(*) FROM project_papers WHERE project_id = $1;`,
      [effectiveProjectId]
    );
    const totalCount = parseInt(totalResult.rows[0].count, 10);

    return NextResponse.json({
      success: true,
      projectId: effectiveProjectId,
      totalCount,
      count: result.rows.length,
      availableYears,
      papers: result.rows,
    });
  } catch (error: unknown) {
    console.error("GET /api/projects/[id]/papers error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch project papers",
      },
      { status: 500 }
    );
  }
}
