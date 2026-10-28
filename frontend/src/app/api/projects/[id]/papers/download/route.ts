import { NextResponse } from "next/server";
import { pool, initProjectsTable } from "@/lib/db";
import { getUserId, userOwnsProject } from "@/lib/project-access";
import { removePrivateObject, uploadPrivatePdf } from "@/lib/supabase-storage";
import { fetchFromBackend } from "@/lib/backend-api";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    await initProjectsTable();
    if (!(await userOwnsProject(userId, id))) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }
    const body = await req.json();
    const { paper_id } = body;

    if (typeof paper_id !== "string" || !/^[a-zA-Z0-9._-]{1,128}$/.test(paper_id)) {
      return NextResponse.json(
        { success: false, error: "paper_id is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.INTERNAL_API_KEY;
    if (!apiKey) throw new Error("Internal backend authentication is not configured");

    const response = await fetchFromBackend("/api/papers/download", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Api-Key": apiKey,
        "X-User-Id": userId,
      },
      body: JSON.stringify({
        paper_id,
        pdf_url: body.pdf_url,
        title: body.title,
        projectId: id,
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Backend download failed with status ${response.status}: ${errText}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const disposition = response.headers.get("content-disposition") || "";
    const filename = decodeURIComponent(disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1] || disposition.match(/filename="?([^";]+)"?/i)?.[1] || `${paper_id}.pdf`);
    const { bucket, storagePath } = await uploadPrivatePdf(id, paper_id, filename, bytes);

    // Record downloaded paper in PostgreSQL project_papers table
    try {
      await initProjectsTable();

      const fileSize = bytes.byteLength;
      let sizeLabel = "PDF";
      if (fileSize > 1024 * 1024) {
        sizeLabel = `${(fileSize / (1024 * 1024)).toFixed(1)} MB • PDF`;
      } else if (fileSize > 0) {
        sizeLabel = `${Math.round(fileSize / 1024)} KB • PDF`;
      }

      const paperYear = body.year
        ? parseInt(body.year, 10)
        : (body.published ? parseInt(body.published.slice(0, 4), 10) : new Date().getFullYear());

      await pool.query(
        `INSERT INTO project_papers (
          id, project_id, paper_id, title, authors, venue, year, published, summary, pdf_url, entry_url, primary_category, file_name, file_size, file_size_label, tags, storage_bucket, storage_path
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (project_id, paper_id) DO UPDATE SET
          file_name = EXCLUDED.file_name,
          file_size = EXCLUDED.file_size,
          file_size_label = EXCLUDED.file_size_label,
          downloaded_at = NOW(),
          storage_bucket = EXCLUDED.storage_bucket,
          storage_path = EXCLUDED.storage_path;`,
        [
          `${id}_${paper_id}`,
          id,
          paper_id,
          body.title || "Research Paper",
          body.authors || "",
          body.venue || "Academic Preprint",
          isNaN(paperYear) ? new Date().getFullYear() : paperYear,
          body.published || new Date().toISOString().split("T")[0],
          body.summary || body.snippet || "",
          body.pdf_url || "",
          body.entry_url || body.pdf_url || "",
          body.primary_category || "Computer Science",
          filename,
          fileSize,
          sizeLabel,
          JSON.stringify(Array.isArray(body.tags) ? body.tags : ["Preprint", "Research"]),
          bucket,
          storagePath,
        ]
      );

      // Synchronize papers_count on project
      await pool.query(
        `UPDATE projects SET papers_count = (SELECT COUNT(*) FROM project_papers WHERE project_id = $1), updated_at = NOW() WHERE id = $1;`,
        [id]
      );
    } catch (dbErr) {
      console.warn("Could not save downloaded paper record to db:", dbErr);
      await removePrivateObject(bucket, storagePath);
      throw dbErr;
    }

    return NextResponse.json({ success: true, paper_id, filename, file_size: bytes.byteLength, projectId: id });
  } catch (error: unknown) {
    console.error("POST /api/projects/[id]/papers/download error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to download arXiv paper",
      },
      { status: 500 }
    );
  }
}
