import { NextResponse } from "next/server";
import { pool, initProjectsTable } from "@/lib/db";
import { getUserId, userOwnsProject } from "@/lib/project-access";

type StoredPaper = {
  paperId?: string;
  status?: string;
  progress?: number;
  [key: string]: unknown;
};

// GET /api/projects/[id]/chat/messages?sessionId=...
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    await initProjectsTable();
    const { id: projectId } = await params;
    if (!(await userOwnsProject(userId, projectId))) return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "sessionId is required" },
        { status: 400 }
      );
    }

    const res = await pool.query(
      `SELECT id, session_id, sender, text, time_label, tag,
              is_papers_response, papers, intro_text, total_verified, queued_info,
              citations, intent, document, created_at
       FROM chat_messages
       WHERE project_id = $1 AND session_id = $2
       ORDER BY created_at ASC`,
      [projectId, sessionId]
    );

    const messages = res.rows.map((row) => ({
      id: row.id,
      sender: row.sender,
      text: row.text,
      time: row.time_label,
      tag: row.tag || undefined,
      isPapersResponse: row.is_papers_response || false,
      papers: row.papers || [],
      introText: row.intro_text || undefined,
      totalVerified: row.total_verified || 0,
      queuedInfo: row.queued_info || undefined,
      citations: row.citations || [],
      intent: row.intent || undefined,
      document: row.document || undefined,
    }));

    return NextResponse.json({ success: true, messages });
  } catch (error) {
    console.error("GET /api/projects/[id]/chat/messages error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch chat messages" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/chat/messages - Append a message
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    await initProjectsTable();
    const { id: projectId } = await params;
    if (!(await userOwnsProject(userId, projectId))) return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    const body = await req.json();

    const {
      id = `msg-${Date.now()}`,
      sessionId,
      sender,
      text = "",
      time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      tag,
      isPapersResponse = false,
      papers = [],
      introText,
      totalVerified = 0,
      queuedInfo,
      citations = [],
      intent,
      document = null,
    } = body;

    if (!sessionId || !sender) {
      return NextResponse.json(
        { success: false, error: "sessionId and sender are required" },
        { status: 400 }
      );
    }

    await pool.query(
      `INSERT INTO chat_messages (
        id, session_id, project_id, sender, text, time_label, tag,
        is_papers_response, papers, intro_text, total_verified, queued_info,
        citations, intent, document
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        id,
        sessionId,
        projectId,
        sender,
        text,
        time,
        tag || null,
        Boolean(isPapersResponse),
        JSON.stringify(papers || []),
        introText || null,
        Number(totalVerified || (papers ? papers.length : 0)),
        queuedInfo ? JSON.stringify(queuedInfo) : null,
        JSON.stringify(citations || []),
        intent || null,
        document ? JSON.stringify(document) : null,
      ]
    );

    // Update session updated_at and paper_count
    if (papers && papers.length > 0) {
      await pool.query(
        `UPDATE chat_sessions
         SET updated_at = NOW(),
             paper_count = (
               SELECT COALESCE(SUM(jsonb_array_length(papers)), 0)
               FROM chat_messages
               WHERE session_id = $1 AND is_papers_response = TRUE
             )
         WHERE id = $1 AND project_id = $2`,
        [sessionId, projectId]
      );
    } else {
      await pool.query(
        `UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1 AND project_id = $2`,
        [sessionId, projectId]
      );
    }

    return NextResponse.json({ success: true, messageId: id });
  } catch (error) {
    console.error("POST /api/projects/[id]/chat/messages error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to store chat message" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id]/chat/messages - Update paper status in stored messages
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(req);
    if (!userId) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    await initProjectsTable();
    const { id: projectId } = await params;
    if (!(await userOwnsProject(userId, projectId))) return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    const body = await req.json();
    const { paperId, status, progress } = body;

    if (!paperId || !status) {
      return NextResponse.json(
        { success: false, error: "paperId and status are required" },
        { status: 400 }
      );
    }

    // Update papers jsonb array where paperId matches
    const res = await pool.query(
      `SELECT id, papers FROM chat_messages
       WHERE project_id = $1 AND is_papers_response = TRUE`,
      [projectId]
    );

    for (const row of res.rows) {
      const papers = row.papers as StoredPaper[];
      if (Array.isArray(papers)) {
        let changed = false;
        const updated = papers.map((p: StoredPaper) => {
          const cleanPId = typeof p.paperId === "string" ? p.paperId.split("v")[0] : "";
          const targetClean = paperId.split("v")[0];
          if (p.paperId === paperId || cleanPId === targetClean) {
            changed = true;
            return { ...p, status, progress: progress !== undefined ? progress : p.progress };
          }
          return p;
        });

        if (changed) {
          await pool.query(
            `UPDATE chat_messages SET papers = $1 WHERE id = $2`,
            [JSON.stringify(updated), row.id]
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/projects/[id]/chat/messages error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update paper status" },
      { status: 500 }
    );
  }
}
