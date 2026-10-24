import { NextResponse } from "next/server";
import { pool, initProjectsTable } from "@/lib/db";
import { getUserId } from "@/lib/project-access";

export interface ProjectActivityContribution {
  id: string;
  title: string;
  count: number;
  chat: number;
  download: number;
  analyzed: number;
  other: number;
}

export interface GlobalActivityDay {
  date: string | null;
  dayNumber: number | null;
  dayOfWeek: number; // 0 (Mon) to 6 (Sun)
  count: number;
  level: number;
  isToday: boolean;
  isInRange: boolean;
  breakdown: {
    chat: number;
    download: number;
    analyzed: number;
    other: number;
  };
  projects: ProjectActivityContribution[];
}

export interface GlobalMonthGroup {
  name: string;
  fullName: string;
  year: number;
  month: number;
  totalActions: number;
  activeDaysCount: number;
  weeks: GlobalActivityDay[][];
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface DateAggregatedData {
  total: number;
  chat: number;
  download: number;
  analyzed: number;
  other: number;
  projectsMap: Map<string, ProjectActivityContribution>;
}

function buildGlobalMonthGroup(
  year: number,
  month: number,
  activityMap: Map<string, DateAggregatedData>,
  todayUTC: Date
): GlobalMonthGroup {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fullMonthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const name = monthNames[month - 1];
  const fullName = `${fullMonthNames[month - 1]} ${year}`;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDayJs = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const firstDayMonIdx = (firstDayJs + 6) % 7; // 0=Mon, ..., 6=Sun

  const todayStr = formatDate(todayUTC);

  const weeks: GlobalActivityDay[][] = [];
  let currentWeek: GlobalActivityDay[] = [];

  // Pad beginning of month
  for (let p = 0; p < firstDayMonIdx; p++) {
    currentWeek.push({
      date: null,
      dayNumber: null,
      dayOfWeek: p,
      count: 0,
      level: 0,
      isToday: false,
      isInRange: false,
      breakdown: { chat: 0, download: 0, analyzed: 0, other: 0 },
      projects: [],
    });
  }

  let totalActions = 0;
  let activeDaysCount = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const curDate = new Date(Date.UTC(year, month - 1, d));
    const dateStr = formatDate(curDate);
    const dayOfWeek = (curDate.getUTCDay() + 6) % 7;
    const isFuture = curDate > todayUTC;
    const isToday = dateStr === todayStr;

    const data = activityMap.get(dateStr);
    const count = !isFuture && data ? data.total : 0;
    const chat = !isFuture && data ? data.chat : 0;
    const download = !isFuture && data ? data.download : 0;
    const analyzed = !isFuture && data ? data.analyzed : 0;
    const other = !isFuture && data ? data.other : 0;
    const projectsList = !isFuture && data ? Array.from(data.projectsMap.values()) : [];

    let level = 0;
    if (count >= 10) level = 4;
    else if (count >= 6) level = 3;
    else if (count >= 3) level = 2;
    else if (count >= 1) level = 1;

    if (count > 0) {
      totalActions += count;
      activeDaysCount += 1;
    }

    currentWeek.push({
      date: dateStr,
      dayNumber: d,
      dayOfWeek,
      count,
      level,
      isToday,
      isInRange: !isFuture,
      breakdown: { chat, download, analyzed, other },
      projects: projectsList,
    });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Pad remaining days of last week
  if (currentWeek.length > 0) {
    let nextDayOfWeek = currentWeek.length;
    while (currentWeek.length < 7) {
      currentWeek.push({
        date: null,
        dayNumber: null,
        dayOfWeek: nextDayOfWeek++,
        count: 0,
        level: 0,
        isToday: false,
        isInRange: false,
        breakdown: { chat: 0, download: 0, analyzed: 0, other: 0 },
        projects: [],
      });
    }
    weeks.push(currentWeek);
  }

  return {
    name,
    fullName,
    year,
    month,
    totalActions,
    activeDaysCount,
    weeks,
  };
}

export async function GET(req: Request) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
    }

    await initProjectsTable();

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "last_6_months";

    // 1. Query all real activities grouped by date and project
    const query = `
      WITH raw_events AS (
        SELECT 
          DATE(cm.created_at AT TIME ZONE 'UTC') as act_date,
          'chat' as act_type,
          pr.id as project_id,
          pr.title as project_title
        FROM chat_messages cm
        JOIN projects pr ON pr.id = cm.project_id
        WHERE pr.owner_user_id = $1 AND cm.created_at IS NOT NULL
        
        UNION ALL
        
        SELECT 
          DATE(pp.downloaded_at AT TIME ZONE 'UTC') as act_date,
          'download' as act_type,
          pr.id as project_id,
          pr.title as project_title
        FROM project_papers pp
        JOIN projects pr ON pr.id = pp.project_id
        WHERE pr.owner_user_id = $1 AND pp.downloaded_at IS NOT NULL
        
        UNION ALL
        
        SELECT 
          DATE(pp.analyzed_at AT TIME ZONE 'UTC') as act_date,
          'analyzed' as act_type,
          pr.id as project_id,
          pr.title as project_title
        FROM project_papers pp
        JOIN projects pr ON pr.id = pp.project_id
        WHERE pr.owner_user_id = $1 AND pp.analyzed_at IS NOT NULL
        
        UNION ALL
        
        SELECT 
          DATE(j.created_at AT TIME ZONE 'UTC') as act_date,
          'job' as act_type,
          pr.id as project_id,
          pr.title as project_title
        FROM paper_processing_jobs j
        JOIN projects pr ON pr.id = j.project_id
        WHERE pr.owner_user_id = $1 AND j.created_at IS NOT NULL

        UNION ALL

        SELECT 
          DATE(pa.created_at AT TIME ZONE 'UTC') as act_date,
          pa.activity_type as act_type,
          pr.id as project_id,
          pr.title as project_title
        FROM project_activities pa
        JOIN projects pr ON pr.id = pa.project_id
        WHERE pr.owner_user_id = $1 AND pa.created_at IS NOT NULL
          AND pa.activity_type NOT IN ('paper_download', 'paper_analysis', 'chat_message')
      )
      SELECT 
        act_date::text as act_date,
        project_id,
        project_title,
        COUNT(*)::int as total_count,
        COUNT(*) FILTER (WHERE act_type IN ('chat', 'chat_message'))::int as chat_count,
        COUNT(*) FILTER (WHERE act_type IN ('download', 'paper_download'))::int as download_count,
        COUNT(*) FILTER (WHERE act_type IN ('analyzed', 'paper_analysis'))::int as analyzed_count,
        COUNT(*) FILTER (WHERE act_type NOT IN ('chat', 'chat_message', 'download', 'paper_download', 'analyzed', 'paper_analysis'))::int as other_count
      FROM raw_events
      GROUP BY act_date, project_id, project_title
      ORDER BY act_date ASC;
    `;

    const result = await pool.query(query, [userId]);
    const activityMap = new Map<string, DateAggregatedData>();

    let totalActions = 0;
    let chatInteractions = 0;
    let papersDownloaded = 0;
    let papersAnalyzed = 0;
    let otherActions = 0;
    const uniqueProjects = new Set<string>();

    for (const row of result.rows) {
      const d = row.act_date;
      uniqueProjects.add(row.project_id);

      if (!activityMap.has(d)) {
        activityMap.set(d, {
          total: 0,
          chat: 0,
          download: 0,
          analyzed: 0,
          other: 0,
          projectsMap: new Map(),
        });
      }

      const dateObj = activityMap.get(d)!;
      dateObj.total += row.total_count;
      dateObj.chat += row.chat_count;
      dateObj.download += row.download_count;
      dateObj.analyzed += row.analyzed_count;
      dateObj.other += row.other_count;

      totalActions += row.total_count;
      chatInteractions += row.chat_count;
      papersDownloaded += row.download_count;
      papersAnalyzed += row.analyzed_count;
      otherActions += row.other_count;

      dateObj.projectsMap.set(row.project_id, {
        id: row.project_id,
        title: row.project_title || "Project Workspace",
        count: row.total_count,
        chat: row.chat_count,
        download: row.download_count,
        analyzed: row.analyzed_count,
        other: row.other_count,
      });
    }

    // 2. Determine date bounds based on range
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayStr = formatDate(todayUTC);
    const curYear = todayUTC.getUTCFullYear();
    const curMonth = todayUTC.getUTCMonth() + 1; // 1-12

    let monthTargets: Array<{ year: number; month: number }> = [];

    if (range === "last_30_days") {
      let prevM = curMonth - 1;
      let prevY = curYear;
      if (prevM <= 0) {
        prevM = 12;
        prevY -= 1;
      }
      monthTargets = [
        { year: prevY, month: prevM },
        { year: curYear, month: curMonth },
      ];
    } else if (range === "year_to_date") {
      for (let m = 1; m <= curMonth; m++) {
        monthTargets.push({ year: curYear, month: m });
      }
    } else if (range === "all_time") {
      let startYear = curYear;
      let startMonth = Math.max(1, curMonth - 5);
      if (result.rows.length > 0) {
        const firstRow = new Date(result.rows[0].act_date + "T00:00:00Z");
        startYear = firstRow.getUTCFullYear();
        startMonth = firstRow.getUTCMonth() + 1;
      }
      let y = startYear;
      let m = startMonth;
      while (y < curYear || (y === curYear && m <= curMonth)) {
        monthTargets.push({ year: y, month: m });
        m++;
        if (m > 12) {
          m = 1;
          y++;
        }
      }
    } else {
      // default: last_6_months
      for (let i = 5; i >= 0; i--) {
        let m = curMonth - i;
        let y = curYear;
        if (m <= 0) {
          m += 12;
          y -= 1;
        }
        monthTargets.push({ year: y, month: m });
      }
    }

    const months: GlobalMonthGroup[] = [];
    for (const target of monthTargets) {
      months.push(buildGlobalMonthGroup(target.year, target.month, activityMap, todayUTC));
    }

    // 3. Compute Streaks
    const sortedDates = Array.from(activityMap.keys())
      .filter((d) => (activityMap.get(d)?.total || 0) > 0)
      .sort();

    let longestStreak = 0;
    let tempStreak = 0;
    let prevDate: Date | null = null;

    for (const dStr of sortedDates) {
      const curDate = new Date(dStr + "T00:00:00Z");
      if (!prevDate) {
        tempStreak = 1;
      } else {
        const diffDays = Math.round((curDate.getTime() - prevDate.getTime()) / 86400000);
        if (diffDays === 1) {
          tempStreak += 1;
        } else if (diffDays > 1) {
          tempStreak = 1;
        }
      }
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
      prevDate = curDate;
    }

    let currentStreak = 0;
    let checkDate = new Date(todayUTC.getTime());
    const todayData = activityMap.get(todayStr);

    if (todayData && todayData.total > 0) {
      while (true) {
        const dStr = formatDate(checkDate);
        const dData = activityMap.get(dStr);
        if (dData && dData.total > 0) {
          currentStreak++;
          checkDate = new Date(checkDate.getTime() - 86400000);
        } else {
          break;
        }
      }
    } else {
      const yesterday = new Date(todayUTC.getTime() - 86400000);
      const yesterdayStr = formatDate(yesterday);
      const yData = activityMap.get(yesterdayStr);
      if (yData && yData.total > 0) {
        checkDate = yesterday;
        while (true) {
          const dStr = formatDate(checkDate);
          const dData = activityMap.get(dStr);
          if (dData && dData.total > 0) {
            currentStreak++;
            checkDate = new Date(checkDate.getTime() - 86400000);
          } else {
            break;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      range,
      months,
      summary: {
        totalActions,
        chatInteractions,
        papersDownloaded,
        papersAnalyzed,
        otherActions,
        projectsCount: uniqueProjects.size,
        currentStreak,
        longestStreak: Math.max(longestStreak, currentStreak),
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard/activity error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch dashboard activity" },
      { status: 500 }
    );
  }
}
