import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { pool, initProjectsTable } from "@/lib/db";
import { getUserId, userOwnsProject } from "@/lib/project-access";
import { removePrivateObject, uploadPrivatePdf } from "@/lib/supabase-storage";
import { logProjectActivity } from "@/lib/activity-logger";

const MAX_PDF_SIZE = 15 * 1024 * 1024;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let uploaded: { bucket: string; storagePath: string } | undefined;
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }
    const { id: projectId } = await params;
    await initProjectsTable();
    if (!(await userOwnsProject(userId, projectId))) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Please select a valid PDF file" }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_PDF_SIZE) {
      return NextResponse.json(
        { success: false, error: "PDF files must be between 1 byte and 15 MB" },
        { status: 413 }
      );
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ success: false, error: "Only PDF files are accepted" }, { status: 415 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(0, 4).toString("ascii") !== "%PDF") {
      return NextResponse.json(
        { success: false, error: "The selected file is not a valid PDF document" },
        { status: 415 }
      );
    }

    const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 240) || "research-paper.pdf";
    const paperId = `upload-${randomUUID()}`;

    // Upload to private Supabase storage
    uploaded = await uploadPrivatePdf(projectId, paperId, filename, bytes);

    // Title from user input or clean filename
    const customTitle = form.get("title")?.toString().trim();
    const fallbackTitle = filename.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");
    const title = customTitle || fallbackTitle;

    const authors = form.get("authors")?.toString().trim() || "Author not specified";
    const venue = form.get("venue")?.toString().trim() || "Manual Upload";
    const summary =
      form.get("summary")?.toString().trim() ||
      "Preprint uploaded manually to workspace for AI analysis.";
    const year = new Date().getFullYear();
    const sizeLabel =
      bytes.length >= 1024 * 1024
        ? `${(bytes.length / (1024 * 1024)).toFixed(1)} MB • PDF`
        : `${Math.max(1, Math.round(bytes.length / 1024))} KB • PDF`;

    const fileRoute = `/api/projects/${encodeURIComponent(projectId)}/papers/${encodeURIComponent(paperId)}/file`;

    // Persist in project_papers with status 'pending' (Not Analyzed)
    await pool.query(
      `INSERT INTO project_papers (
        id, project_id, paper_id, title, authors, venue, year, published,
        summary, pdf_url, entry_url, primary_category, file_name, file_size,
        file_size_label, tags, storage_bucket, storage_path, analysis_status, insights
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10,
        'Research Paper', $11, $12, $13, '["Uploaded PDF"]'::jsonb, $14, $15, 'pending', '{}'::jsonb)
      ON CONFLICT (project_id, paper_id) DO UPDATE SET
        title = EXCLUDED.title,
        authors = EXCLUDED.authors,
        file_name = EXCLUDED.file_name,
        file_size = EXCLUDED.file_size,
        file_size_label = EXCLUDED.file_size_label,
        storage_bucket = EXCLUDED.storage_bucket,
        storage_path = EXCLUDED.storage_path`,
      [
        `${projectId}_${paperId}`,
        projectId,
        paperId,
        title,
        authors,
        venue,
        year,
        new Date().toISOString().slice(0, 10),
        summary,
        fileRoute,
        filename,
        bytes.length,
        sizeLabel,
        uploaded.bucket,
        uploaded.storagePath,
      ]
    );

    // Update project papers count and last accessed timestamp
    await pool.query(
      `UPDATE projects 
       SET papers_count = (SELECT COUNT(*) FROM project_papers WHERE project_id = $1),
           last_accessed_at = NOW(),
           updated_at = NOW() 
       WHERE id = $1`,
      [projectId]
    );

    // Log to project activities
    await logProjectActivity(
      projectId,
      "paper_download",
      `Uploaded PDF manuscript "${title}"`,
      {
        paper_id: paperId,
        file_name: filename,
        file_size: bytes.length,
        status: "pending",
      }
    );

    return NextResponse.json(
      {
        success: true,
        paper: {
          id: paperId,
          paper_id: paperId,
          title,
          authors,
          venue,
          filename,
          fileSize: bytes.length,
          fileSizeLabel: sizeLabel,
          status: "pending",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (uploaded) await removePrivateObject(uploaded.bucket, uploaded.storagePath);
    console.error("POST project PDF upload error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Could not upload this PDF",
      },
      { status: 500 }
    );
  }
}
