import { NextRequest, NextResponse } from "next/server";
import { getUserId, userOwnsProject } from "@/lib/project-access";
import { initProjectsTable } from "@/lib/db";

const CANDIDATE_BACKEND_URLS = [
  process.env.BACKEND_URL,
  "http://backend:8000",
  "http://localhost:8000",
].filter(Boolean) as string[];

async function fetchFromBackend(endpoint: string, options: RequestInit) {
  let lastError: unknown = null;
  for (const base of CANDIDATE_BACKEND_URLS) {
    try {
      const res = await fetch(`${base}${endpoint}`, options);
      return res;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Could not reach Python backend service");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }

    await initProjectsTable();
    const { id: projectId, docId } = await params;
    if (!(await userOwnsProject(userId, projectId))) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    const format = req.nextUrl.searchParams.get("format") || "pdf";
    const apiKey = process.env.INTERNAL_API_KEY;

    const backendRes = await fetchFromBackend(
      `/api/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(docId)}/download?format=${encodeURIComponent(format)}`,
      {
        headers: {
          "X-Internal-Api-Key": apiKey || "",
          "X-User-Id": userId,
        },
      }
    );

    if (!backendRes.ok) {
      const errText = await backendRes.text();
      return NextResponse.json(
        { success: false, error: `Backend error: ${backendRes.status}`, detail: errText },
        { status: backendRes.status }
      );
    }

    const contentType = backendRes.headers.get("content-type") || (format === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/pdf");
    const contentDisposition = backendRes.headers.get("content-disposition") || `attachment; filename="SupervisorX_${docId}.${format}"`;

    const blob = await backendRes.arrayBuffer();

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
      },
    });
  } catch (error: unknown) {
    console.error("GET /api/projects/[id]/documents/[docId]/download error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
