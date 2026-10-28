import { NextResponse } from "next/server";
import { getUserId, userOwnsProject } from "@/lib/project-access";
import { fetchFromBackend } from "@/lib/backend-api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    const { id } = await params;
    if (!(await userOwnsProject(userId, id))) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("job_id");
    const query = jobId ? `?job_id=${encodeURIComponent(jobId)}` : "";

    const apiKey = process.env.INTERNAL_API_KEY;
    const backendRes = await fetchFromBackend(
      `/api/projects/${encodeURIComponent(id)}/analysis/status${query}`,
      {
        headers: {
          "X-Internal-Api-Key": apiKey || "",
          "X-User-Id": userId,
        },
        cache: "no-store",
      }
    );

    if (!backendRes.ok) {
      return NextResponse.json({ success: false, job: null });
    }

    const data = await backendRes.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("GET analysis status error:", error);
    return NextResponse.json({ success: false, job: null });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    const { id } = await params;
    if (!(await userOwnsProject(userId, id))) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    const body = await req.json();
    const { paper_ids, paper_id } = body;

    const apiKey = process.env.INTERNAL_API_KEY;
    let endpoint = "";
    let payload = {};

    if (Array.isArray(paper_ids) && paper_ids.length > 0) {
      endpoint = `/api/projects/${encodeURIComponent(id)}/papers/analyze-batch`;
      payload = { paper_ids, projectId: id };
    } else if (paper_id) {
      endpoint = `/api/projects/${encodeURIComponent(id)}/papers/${encodeURIComponent(paper_id)}/analyze`;
      payload = { paper_id, projectId: id };
    } else {
      return NextResponse.json({ success: false, error: "paper_id or paper_ids required" }, { status: 400 });
    }

    const backendRes = await fetchFromBackend(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Api-Key": apiKey || "",
        "X-User-Id": userId,
      },
      body: JSON.stringify(payload),
    });

    const data = await backendRes.json();
    if (!backendRes.ok) {
      return NextResponse.json(
        { success: false, error: data.detail || "Analysis trigger failed" },
        { status: backendRes.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("POST analysis trigger error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
