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

    const excludeReports = searchParams.get("exclude_reports") === "true";
    if (excludeReports) {
      conditions.push("(primary_category IS NULL OR primary_category != 'Generated Report')");
      conditions.push("(analysis_status IS NULL OR analysis_status != 'report')");
    }

    const statusParam = searchParams.get("status");
    if (statusParam === "analyzed") {
      conditions.push("analysis_status = 'analyzed'");
    } else if (statusParam === "pending") {
      conditions.push("(analysis_status IS NULL OR (analysis_status != 'analyzed' AND analysis_status != 'report'))");
      conditions.push("(primary_category IS NULL OR primary_category != 'Generated Report')");
    } else if (statusParam === "report") {
      conditions.push("(analysis_status = 'report' OR primary_category = 'Generated Report')");
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
        downloaded_at,
        COALESCE(analysis_status, 'pending') AS status,
        analyzed_at,
        insights,
        chunks_count,
        figures_count,
        vectors_count
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

// DELETE /api/projects/[id]/papers - Remove one or multiple papers/reports
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    await initProjectsTable();
    const { id: projectId } = await params;
    if (!(await userOwnsProject(userId, projectId))) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const paperIds: string[] = Array.isArray(body.paperIds)
      ? body.paperIds
      : body.paperId
      ? [String(body.paperId)]
      : [];

    if (paperIds.length === 0) {
      return NextResponse.json({ success: false, error: "paperIds array or paperId required" }, { status: 400 });
    }

    const { removePrivateObject } = await import("@/lib/supabase-storage");

    // 1. Fetch storage paths to clean up Supabase Storage
    const selectRes = await pool.query(
      `SELECT id, paper_id, storage_bucket, storage_path, primary_category 
       FROM project_papers 
       WHERE project_id = $1 AND (paper_id = ANY($2::text[]) OR id = ANY($2::text[]))`,
      [projectId, paperIds]
    );

    for (const row of selectRes.rows) {
      if (row.storage_bucket && row.storage_path) {
        // Only delete file from Supabase Storage if no other project is using this same file
        const otherRefCheck = await pool.query(
          "SELECT COUNT(*) AS count FROM project_papers WHERE storage_path = $1 AND project_id != $2",
          [row.storage_path, projectId]
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

    // 2. Cascade delete from all analyzed information tables in PostgreSQL
    await pool.query(
      "DELETE FROM paper_vectors WHERE project_id = $1 AND (paper_id = ANY($2::text[]) OR id = ANY($2::text[]))",
      [projectId, paperIds]
    );
    await pool.query(
      "DELETE FROM paper_text_chunks WHERE project_id = $1 AND (paper_id = ANY($2::text[]) OR id = ANY($2::text[]))",
      [projectId, paperIds]
    );
    await pool.query(
      "DELETE FROM paper_visual_items WHERE project_id = $1 AND (paper_id = ANY($2::text[]) OR id = ANY($2::text[]))",
      [projectId, paperIds]
    );
    await pool.query(
      "DELETE FROM paper_processing_jobs WHERE project_id = $1 AND (paper_id = ANY($2::text[]) OR id = ANY($2::text[]))",
      [projectId, paperIds]
    );
    const delRes = await pool.query(
      "DELETE FROM project_papers WHERE project_id = $1 AND (paper_id = ANY($2::text[]) OR id = ANY($2::text[]))",
      [projectId, paperIds]
    );

    // 3. Update project papers count
    await pool.query(
      `UPDATE projects 
       SET papers_count = (SELECT COUNT(*) FROM project_papers WHERE project_id = $1 AND (primary_category IS NULL OR primary_category != 'Generated Report')), 
           updated_at = NOW() 
       WHERE id = $1`,
      [projectId]
    );

    return NextResponse.json({
      success: true,
      deletedCount: delRes.rowCount,
      paperIds,
    });
  } catch (error: unknown) {
    console.error("DELETE /api/projects/[id]/papers error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete papers" },
      { status: 500 }
    );
  }
}
