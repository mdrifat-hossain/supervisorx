import { NextResponse } from "next/server";
import { pool, initProjectsTable } from "@/lib/db";
import { getUserId, userOwnsProject } from "@/lib/project-access";

interface ImportItem {
  paperId: string;
  sourceProjectId: string;
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }

    await initProjectsTable();

    const body = await req.json().catch(() => ({}));
    const targetProjectId = body.targetProjectId;
    const items: ImportItem[] = Array.isArray(body.items) ? body.items : [];

    if (!targetProjectId || typeof targetProjectId !== "string") {
      return NextResponse.json({ success: false, error: "targetProjectId is required" }, { status: 400 });
    }

    if (items.length === 0) {
      return NextResponse.json({ success: false, error: "At least one paper item is required to import" }, { status: 400 });
    }

    // Verify user owns target project
    if (!(await userOwnsProject(userId, targetProjectId))) {
      return NextResponse.json({ success: false, error: "Target project not found or access denied" }, { status: 403 });
    }

    // Get target project title
    const targetProjRes = await pool.query("SELECT id, title FROM projects WHERE id = $1", [targetProjectId]);
    const targetProjectTitle = targetProjRes.rows[0]?.title || targetProjectId;

    let importedCount = 0;
    let skippedCount = 0;
    const importedTitles: string[] = [];

    for (const item of items) {
      const { paperId, sourceProjectId } = item;
      if (!paperId || !sourceProjectId) continue;

      // Don't import into the same project
      if (sourceProjectId === targetProjectId) {
        skippedCount++;
        continue;
      }

      // Verify user owns source project
      if (!(await userOwnsProject(userId, sourceProjectId))) {
        continue;
      }

      // Check if already in target project
      const existingInTarget = await pool.query(
        "SELECT id FROM project_papers WHERE project_id = $1 AND (paper_id = $2 OR id = $2)",
        [targetProjectId, paperId]
      );
      if (existingInTarget.rows.length > 0) {
        skippedCount++;
        continue;
      }

      // Fetch source paper details
      const sourceRes = await pool.query(
        `SELECT * FROM project_papers 
         WHERE project_id = $1 AND (paper_id = $2 OR id = $2)`,
        [sourceProjectId, paperId]
      );

      if (sourceRes.rows.length === 0) {
        continue;
      }

      const p = sourceRes.rows[0];
      const newPk = `${targetProjectId}_${p.paper_id}`;
      const isAnalyzed = p.analysis_status === "analyzed";

      // Insert paper into target project
      await pool.query(
        `INSERT INTO project_papers (
          id, project_id, paper_id, title, authors, venue,
          year, published, summary, pdf_url, entry_url,
          primary_category, file_name, storage_bucket, storage_path,
          file_size, file_size_label, tags, downloaded_at,
          analysis_status, analyzed_at, insights,
          chunks_count, figures_count, vectors_count
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15,
          $16, $17, $18, NOW(),
          $19, $20, $21,
          $22, $23, $24
        )
        ON CONFLICT (project_id, paper_id) DO NOTHING`,
        [
          newPk,
          targetProjectId,
          p.paper_id,
          p.title,
          p.authors,
          p.venue,
          p.year,
          p.published,
          p.summary,
          p.pdf_url,
          p.entry_url,
          p.primary_category,
          p.file_name,
          p.storage_bucket,
          p.storage_path,
          p.file_size,
          p.file_size_label,
          JSON.stringify(p.tags || []),
          isAnalyzed ? "analyzed" : "pending",
          isAnalyzed ? (p.analyzed_at || new Date()) : null,
          JSON.stringify(p.insights || {}),
          isAnalyzed ? (p.chunks_count || 0) : 0,
          isAnalyzed ? (p.figures_count || 0) : 0,
          isAnalyzed ? (p.vectors_count || 0) : 0,
        ]
      );

      // If source paper was already analyzed, copy text chunks, visual items, and vector embeddings
      // so target project can immediately query it in RAG without re-analyzing!
      if (isAnalyzed) {
        try {
          // Copy text chunks with target_project_id prefix
          await pool.query(
            `INSERT INTO paper_text_chunks (
              id, paper_id, project_id, chunk_index, page_start, page_end,
              section_title, section_path, content_type, text_content, content_hash
            )
            SELECT 
              $1 || '_' || substring(id from position('_' in id)+1),
              paper_id,
              $1,
              chunk_index,
              page_start,
              page_end,
              section_title,
              section_path,
              content_type,
              text_content,
              content_hash
            FROM paper_text_chunks
            WHERE project_id = $2 AND paper_id = $3
            ON CONFLICT (id) DO NOTHING`,
            [targetProjectId, sourceProjectId, p.paper_id]
          );

          // Copy visual items with target_project_id prefix
          await pool.query(
            `INSERT INTO paper_visual_items (
              id, paper_id, project_id, page_number, figure_number,
              caption, visual_type, visual_description, visible_labels,
              axes_and_units, relationships_or_trends, limitations_or_uncertainties,
              content_hash
            )
            SELECT 
              $1 || '_' || substring(id from position('_' in id)+1),
              paper_id,
              $1,
              page_number,
              figure_number,
              caption,
              visual_type,
              visual_description,
              visible_labels,
              axes_and_units,
              relationships_or_trends,
              limitations_or_uncertainties,
              content_hash
            FROM paper_visual_items
            WHERE project_id = $2 AND paper_id = $3
            ON CONFLICT (id) DO NOTHING`,
            [targetProjectId, sourceProjectId, p.paper_id]
          );

          // Copy pgvector embeddings with target_project_id prefix
          await pool.query(
            `INSERT INTO paper_vectors (
              id, paper_id, project_id, source_type, source_id,
              content_text, page_start, page_end, section_title,
              figure_number, caption, content_hash, embedding_model, embedding
            )
            SELECT 
              $1 || '_' || substring(id from position('_' in id)+1),
              paper_id,
              $1,
              source_type,
              $1 || '_' || substring(source_id from position('_' in source_id)+1),
              content_text,
              page_start,
              page_end,
              section_title,
              figure_number,
              caption,
              content_hash,
              embedding_model,
              embedding
            FROM paper_vectors
            WHERE project_id = $2 AND paper_id = $3
            ON CONFLICT (id) DO NOTHING`,
            [targetProjectId, sourceProjectId, p.paper_id]
          );
        } catch (copyErr) {
          console.warn("Failed to copy vectors/chunks on import:", copyErr);
        }
      }

      importedCount++;
      importedTitles.push(p.title);
    }

    // Update target project papers count
    await pool.query(
      `UPDATE projects 
       SET papers_count = (SELECT COUNT(*) FROM project_papers WHERE project_id = $1 AND (primary_category IS NULL OR primary_category != 'Generated Report')),
           updated_at = NOW()
       WHERE id = $1`,
      [targetProjectId]
    );

    // Log activity
    if (importedCount > 0) {
      try {
        const actId = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const desc =
          importedCount === 1
            ? `Imported paper "${importedTitles[0].slice(0, 50)}..." from another project`
            : `Imported ${importedCount} research papers into project`;

        await pool.query(
          `INSERT INTO project_activities (id, project_id, activity_type, description, metadata)
           VALUES ($1, $2, 'paper_imported', $3, $4)`,
          [actId, targetProjectId, desc, JSON.stringify({ count: importedCount, titles: importedTitles })]
        );
      } catch (actErr) {
        console.warn("Could not log activity for import:", actErr);
      }
    }

    return NextResponse.json({
      success: true,
      importedCount,
      skippedCount,
      targetProjectId,
      targetProjectTitle,
    });
  } catch (error: unknown) {
    console.error("POST /api/documents/import error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to import documents" },
      { status: 500 }
    );
  }
}
