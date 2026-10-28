import { NextResponse } from "next/server";
import { getUserId, userOwnsProject } from "@/lib/project-access";
import { logProjectActivity } from "@/lib/activity-logger";
import { fetchFromBackend } from "@/lib/backend-api";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    if (!(await userOwnsProject(userId, id))) return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "";
    const limit = searchParams.get("limit") || "10";
    const startYear = searchParams.get("start_year");
    const endYear = searchParams.get("end_year");
    const minScore = searchParams.get("min_score") || "7";
    const excludeIds = searchParams.get("exclude_ids") || "";

    if (!query.trim()) {
      return NextResponse.json(
        { success: false, error: "Search query is required" },
        { status: 400 }
      );
    }

    let endpoint = `/api/papers/search?query=${encodeURIComponent(
      query
    )}&limit=${limit}&min_score=${minScore}`;
    if (startYear) endpoint += `&start_year=${startYear}`;
    if (endYear) endpoint += `&end_year=${endYear}`;
    if (excludeIds) endpoint += `&exclude_ids=${encodeURIComponent(excludeIds)}`;

    const backendRes = await fetchFromBackend(endpoint, { cache: "no-store" });
    if (!backendRes.ok) {
      throw new Error(`Backend search returned status ${backendRes.status}`);
    }
    const data = await backendRes.json();
    // Log search activity in background
    logProjectActivity(id, "paper_search", `Literature search: ${query.slice(0, 50)}`).catch(() => {});
    return NextResponse.json({ ...data, projectId: id });
  } catch (error: unknown) {
    console.error("GET /api/projects/[id]/papers/search error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to search arXiv papers",
      },
      { status: 500 }
    );
  }
}
