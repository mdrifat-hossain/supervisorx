import { NextResponse } from "next/server";
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
    const {
      message,
      sessionId,
      history = [],
      limit = 10,
      startYear,
      endYear,
      minScore = 7,
      excludeIds,
    } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.INTERNAL_API_KEY;
    const backendRes = await fetchFromBackend(
      `/api/projects/${encodeURIComponent(projectId)}/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Api-Key": apiKey || "",
          "X-User-Id": userId,
        },
        body: JSON.stringify({
          message: message.trim(),
          session_id: sessionId,
          history,
          limit,
          start_year: startYear,
          end_year: endYear,
          min_score: minScore,
          exclude_ids: excludeIds,
        }),
      }
    );

    if (!backendRes.ok) {
      const errText = await backendRes.text();
      console.error("Backend chat API error:", backendRes.status, errText);
      return NextResponse.json(
        {
          success: false,
          error: `Backend error: ${backendRes.status}`,
          detail: errText,
        },
        { status: backendRes.status }
      );
    }

    const data = await backendRes.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("POST /api/projects/[id]/chat error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process chat query",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
