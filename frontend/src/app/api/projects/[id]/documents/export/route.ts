import { NextResponse } from "next/server";
import { getUserId, userOwnsProject } from "@/lib/project-access";
import { initProjectsTable } from "@/lib/db";
import { fetchFromBackend } from "@/lib/backend-api";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }

    await initProjectsTable();
    const { id: projectId } = await params;
    if (!(await userOwnsProject(userId, projectId))) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    const body = await req.json();
    const { title, text, citations, format = "pdf", documentType, scopeDescription } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ success: false, error: "Text is required" }, { status: 400 });
    }

    const apiKey = process.env.INTERNAL_API_KEY;
    const backendRes = await fetchFromBackend(
      `/api/projects/${encodeURIComponent(projectId)}/documents/export`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Api-Key": apiKey || "",
          "X-User-Id": userId,
        },
        body: JSON.stringify({
          title,
          text,
          citations,
          format,
          document_type: documentType,
          scope_description: scopeDescription,
        }),
      }
    );

    if (!backendRes.ok) {
      const errText = await backendRes.text();
      return NextResponse.json(
        { success: false, error: `Backend error: ${backendRes.status}`, detail: errText },
        { status: backendRes.status }
      );
    }

    const data = await backendRes.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("POST /api/projects/[id]/documents/export error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
