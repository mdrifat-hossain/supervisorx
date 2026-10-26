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

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query")?.trim() || "";
    const year = searchParams.get("year");
    const sort = searchParams.get("sort") || "newest";
    const projectFilter = searchParams.get("project_id");

    // 1. Fetch all projects owned by the user for project selection and filtering
    const projectsRes = await pool.query(
      `SELECT id, title, color, domain, papers_count, created_at 
       FROM projects 
       WHERE owner_user_id = $1 
       ORDER BY title ASC`,
      [userId]
    );
    const userProjects = projectsRes.rows;

    if (userProjects.length === 0) {
      return NextResponse.json({
        success: true,
        papers: [],
        projects: [],
        availableYears: [],
        totalCount: 0,
        totalStorageBytes: 0,
      });
    }

    const projectIds = userProjects.map((p) => p.id);

    // 2. Build SQL conditions for papers
    // Strictly ONLY PDF research papers / uploaded PDFs (no generated reports or docx)
    const conditions: string[] = [
      "pp.project_id = ANY($1::text[])",
      "(pp.primary_category IS NULL OR pp.primary_category != 'Generated Report')",
      "(pp.analysis_status IS NULL OR pp.analysis_status != 'report')",
      "(pp.file_name ILIKE '%.pdf' OR pp.storage_path ILIKE '%.pdf' OR pp.pdf_url ILIKE '%.pdf%' OR pp.file_name = '' OR pp.file_name IS NULL)",
    ];
    const values: (string | number | string[])[] = [projectIds];

    if (projectFilter && projectFilter !== "all" && projectIds.includes(projectFilter)) {
      values.push(projectFilter);
      conditions.push(`pp.project_id = $${values.length}`);
    }

    if (year && year !== "all" && !isNaN(Number(year))) {
      values.push(parseInt(year, 10));
      conditions.push(`pp.year = $${values.length}`);
    }

    if (query) {
      values.push(`%${query}%`);
      const pIdx = values.length;
      conditions.push(
        `(pp.title ILIKE $${pIdx} OR pp.authors ILIKE $${pIdx} OR pp.venue ILIKE $${pIdx} OR pp.summary ILIKE $${pIdx} OR pp.paper_id ILIKE $${pIdx} OR p.title ILIKE $${pIdx})`
      );
    }

    let orderByClause = "pp.downloaded_at DESC";
    if (sort === "az") {
      orderByClause = "pp.title ASC";
    } else if (sort === "za") {
      orderByClause = "pp.title DESC";
    } else if (sort === "year_desc") {
      orderByClause = "pp.year DESC NULLS LAST, pp.downloaded_at DESC";
    } else if (sort === "year_asc") {
      orderByClause = "pp.year ASC NULLS LAST, pp.downloaded_at DESC";
    } else if (sort === "size") {
      orderByClause = "pp.file_size DESC";
    } else if (sort === "oldest") {
      orderByClause = "pp.downloaded_at ASC";
    }

    const sql = `
      SELECT 
        pp.id,
        pp.project_id,
        p.title AS project_title,
        p.color AS project_color,
        pp.paper_id,
        pp.title,
        pp.authors,
        pp.venue,
        pp.year,
        pp.published,
        pp.summary,
        pp.pdf_url,
        pp.entry_url,
        pp.primary_category,
        pp.file_name,
        pp.storage_bucket,
        pp.storage_path,
        pp.file_size,
        pp.file_size_label,
        pp.tags,
        pp.downloaded_at,
        COALESCE(pp.analysis_status, 'pending') AS status,
        pp.analyzed_at,
        pp.insights,
        pp.chunks_count,
        pp.figures_count,
        pp.vectors_count
      FROM project_papers pp
      JOIN projects p ON pp.project_id = p.id
      WHERE ${conditions.join(" AND ")}
      ORDER BY ${orderByClause};
    `;

    const papersRes = await pool.query(sql, values);

    // Deduplicate papers by paper_id so each unique manuscript appears once,
    // while aggregating all projects currently using this paper.
    const papersMap = new Map<string, any>();

    for (const row of papersRes.rows) {
      const key = row.paper_id || row.storage_path || row.title.toLowerCase().trim();
      const projectInfo = {
        project_id: row.project_id,
        project_title: row.project_title,
        project_color: row.project_color,
      };

      if (!papersMap.has(key)) {
        papersMap.set(key, {
          ...row,
          projects: [projectInfo],
          project_ids: [row.project_id],
          status: row.status === "analyzed" ? "analyzed" : "pending",
        });
      } else {
        const existing = papersMap.get(key);
        if (!existing.project_ids.includes(row.project_id)) {
          existing.projects.push(projectInfo);
          existing.project_ids.push(row.project_id);
        }
        // If analyzed in any project, reflect as analyzed
        if (row.status === "analyzed") {
          existing.status = "analyzed";
          existing.analyzed_at = existing.analyzed_at || row.analyzed_at;
          existing.insights = existing.insights || row.insights;
          existing.chunks_count = Math.max(existing.chunks_count || 0, row.chunks_count || 0);
          existing.figures_count = Math.max(existing.figures_count || 0, row.figures_count || 0);
          existing.vectors_count = Math.max(existing.vectors_count || 0, row.vectors_count || 0);
        }
      }
    }

    const deduplicatedPapers = Array.from(papersMap.values());

    // Get distinct publication years across all PDF papers for this user
    const yearsRes = await pool.query(
      `SELECT DISTINCT pp.year 
       FROM project_papers pp
       WHERE pp.project_id = ANY($1::text[]) 
         AND pp.year IS NOT NULL 
         AND (pp.primary_category IS NULL OR pp.primary_category != 'Generated Report')
         AND (pp.analysis_status IS NULL OR pp.analysis_status != 'report')
       ORDER BY pp.year DESC;`,
      [projectIds]
    );
    const availableYears = yearsRes.rows.map((r) => r.year);

    const totalStorageBytes = deduplicatedPapers.reduce(
      (acc, r) => acc + (Number(r.file_size) || 0),
      0
    );

    return NextResponse.json({
      success: true,
      papers: deduplicatedPapers,
      projects: userProjects,
      availableYears,
      totalCount: deduplicatedPapers.length,
      totalStorageBytes,
    });
  } catch (error: unknown) {
    console.error("GET /api/documents error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to fetch global documents" },
      { status: 500 }
    );
  }
}
