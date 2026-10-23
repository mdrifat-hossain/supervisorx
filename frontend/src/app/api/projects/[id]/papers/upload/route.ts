import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { pool, initProjectsTable } from "@/lib/db";
import { getUserId, userOwnsProject } from "@/lib/project-access";
import { removePrivateObject, uploadPrivatePdf } from "@/lib/supabase-storage";

const MAX_PDF_SIZE = 15 * 1024 * 1024;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let uploaded: { bucket: string; storagePath: string } | undefined;
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    const { id: projectId } = await params;
    await initProjectsTable();
    if (!(await userOwnsProject(userId, projectId))) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Choose a PDF file" }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_PDF_SIZE) {
      return NextResponse.json({ success: false, error: "PDF files must be 15 MB or smaller" }, { status: 413 });
    }
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ success: false, error: "Only PDF files are accepted" }, { status: 415 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(0, 4).toString("ascii") !== "%PDF") {
      return NextResponse.json({ success: false, error: "The selected file is not a valid PDF" }, { status: 415 });
    }
    const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 240) || "research-paper.pdf";
    const paperId = `upload-${randomUUID()}`;
    uploaded = await uploadPrivatePdf(projectId, paperId, filename, bytes);
    const title = filename.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");
    const year = new Date().getFullYear();
    const sizeLabel = bytes.length >= 1024 * 1024
      ? `${(bytes.length / (1024 * 1024)).toFixed(1)} MB • PDF`
      : `${Math.max(1, Math.round(bytes.length / 1024))} KB • PDF`;

    await pool.query(
      `INSERT INTO project_papers (
        id, project_id, paper_id, title, authors, venue, year, published,
        summary, pdf_url, entry_url, primary_category, file_name, file_size,
        file_size_label, tags, storage_bucket, storage_path
      ) VALUES ($1, $2, $3, $4, '', 'Manual Upload', $5, $6, '', '', '',
        'Research Paper', $7, $8, $9, '["Uploaded PDF"]'::jsonb, $10, $11)` ,
      [
        `${projectId}_${paperId}`, projectId, paperId, title, year,
        new Date().toISOString().slice(0, 10), filename, bytes.length,
        sizeLabel, uploaded.bucket, uploaded.storagePath,
      ]
    );
    await pool.query(
      "UPDATE projects SET papers_count = (SELECT COUNT(*) FROM project_papers WHERE project_id = $1), updated_at = NOW() WHERE id = $1",
      [projectId]
    );

    return NextResponse.json({ success: true, paperId, filename, fileSize: bytes.length }, { status: 201 });
  } catch (error) {
    if (uploaded) await removePrivateObject(uploaded.bucket, uploaded.storagePath);
    console.error("POST project PDF upload error:", error);
    return NextResponse.json({ success: false, error: "Could not upload this PDF" }, { status: 500 });
  }
}
