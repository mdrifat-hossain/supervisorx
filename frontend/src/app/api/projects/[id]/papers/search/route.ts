import { NextResponse } from "next/server";
import { getUserId, userOwnsProject } from "@/lib/project-access";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  (process.env.DOCKER_ENV ? "http://backend:8000" : "http://localhost:8000");

async function fetchFromBackend(endpoint: string) {
  const urls = [BACKEND_URL, "http://backend:8000", "http://localhost:8000"];
  for (const base of urls) {
    try {
      const res = await fetch(`${base}${endpoint}`, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch {
      // try next url
    }
  }
  throw new Error("Unable to reach Python arXiv backend service");
}

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

    const data = await fetchFromBackend(endpoint);
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
