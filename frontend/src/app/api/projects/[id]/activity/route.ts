import { NextResponse } from "next/server";
import { pool, initProjectsTable } from "@/lib/db";
import { getUserId, userOwnsProject } from "@/lib/project-access";

interface ActivityDay {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0 (Mon) to 6 (Sun)
  count: number;
  level: number; // 0 to 4
  isToday: boolean;
  isInRange: boolean;
  breakdown: {
    chat: number;
    download: number;
    analyzed: number;
    other: number;
  };
}

interface MonthHeader {
  label: string;
  weekIndex: number;
}

export interface MonthDay {
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
}

export interface MonthGroup {
  name: string; // "May", "Jun", etc.
  fullName: string; // "May 2026"
  year: number;
  month: number; // 1-12
  totalActions: number;
  activeDaysCount: number;
  weeks: MonthDay[][];
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildMonthGroup(
  year: number,
  month: number, // 1 to 12
  activityMap: Map<string, { total: number; chat: number; download: number; analyzed: number; other: number }>,
  todayUTC: Date
): MonthGroup {
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

  const weeks: MonthDay[][] = [];
  let currentWeek: MonthDay[] = [];

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
    });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

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

export async function GET(
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

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "last_6_months";

    // 1. Query all real activities grouped by UTC date
    const query = `
      WITH raw_events AS (
        SELECT 
          DATE(created_at AT TIME ZONE 'UTC') as act_date,
          'chat' as act_type
        FROM chat_messages
        WHERE project_id = $1 AND created_at IS NOT NULL
        
        UNION ALL
        
        SELECT 
          DATE(downloaded_at AT TIME ZONE 'UTC') as act_date,
          'download' as act_type
        FROM project_papers
        WHERE project_id = $1 AND downloaded_at IS NOT NULL
        
        UNION ALL
        
        SELECT 
          DATE(analyzed_at AT TIME ZONE 'UTC') as act_date,
          'analyzed' as act_type
        FROM project_papers
        WHERE project_id = $1 AND analyzed_at IS NOT NULL
        
        UNION ALL
        
        SELECT 
          DATE(created_at AT TIME ZONE 'UTC') as act_date,
          'job' as act_type
        FROM paper_processing_jobs
        WHERE project_id = $1 AND created_at IS NOT NULL

        UNION ALL

        SELECT 
          DATE(created_at AT TIME ZONE 'UTC') as act_date,
          activity_type as act_type
        FROM project_activities
        WHERE project_id = $1 AND created_at IS NOT NULL
          AND activity_type NOT IN ('paper_download', 'paper_analysis', 'chat_message')
      )
      SELECT 
        act_date::text as act_date,
        COUNT(*)::int as total_count,
        COUNT(*) FILTER (WHERE act_type IN ('chat', 'chat_message'))::int as chat_count,
        COUNT(*) FILTER (WHERE act_type IN ('download', 'paper_download'))::int as download_count,
        COUNT(*) FILTER (WHERE act_type IN ('analyzed', 'paper_analysis'))::int as analyzed_count,
        COUNT(*) FILTER (WHERE act_type NOT IN ('chat', 'chat_message', 'download', 'paper_download', 'analyzed', 'paper_analysis'))::int as other_count
      FROM raw_events
      GROUP BY act_date
      ORDER BY act_date ASC;
    `;

    const result = await pool.query(query, [projectId]);
    const activityMap = new Map<
      string,
      { total: number; chat: number; download: number; analyzed: number; other: number }
    >();

    for (const row of result.rows) {
      activityMap.set(row.act_date, {
        total: row.total_count,
        chat: row.chat_count,
        download: row.download_count,
        analyzed: row.analyzed_count,
        other: row.other_count,
      });
    }

    // 2. Determine start and end date based on requested range
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayStr = formatDate(todayUTC);

    // End date is Sunday of current week
    // JavaScript day: 0=Sun, 1=Mon, ..., 6=Sat
    // We want Monday = 0, ..., Sunday = 6
    const currentJsDay = todayUTC.getUTCDay();
    const currentMonIdx = (currentJsDay + 6) % 7;
    const daysUntilSunday = 6 - currentMonIdx;

    const endSunday = new Date(todayUTC.getTime() + daysUntilSunday * 86400000);

    let startMonday: Date;
    let weeksCount = 26;

    if (range === "last_30_days") {
      weeksCount = 5;
      const targetStart = new Date(todayUTC.getTime() - 30 * 86400000);
      const startJsDay = targetStart.getUTCDay();
      const startMonIdx = (startJsDay + 6) % 7;
      startMonday = new Date(targetStart.getTime() - startMonIdx * 86400000);
      weeksCount = Math.ceil((endSunday.getTime() - startMonday.getTime()) / (7 * 86400000));
    } else if (range === "year_to_date") {
      const jan1 = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      const jan1JsDay = jan1.getUTCDay();
      const jan1MonIdx = (jan1JsDay + 6) % 7;
      startMonday = new Date(jan1.getTime() - jan1MonIdx * 86400000);
      weeksCount = Math.max(1, Math.ceil((endSunday.getTime() - startMonday.getTime()) / (7 * 86400000)));
    } else if (range === "all_time") {
      // Find earliest activity or default 26 weeks
      let earliestDate = new Date(todayUTC.getTime() - 26 * 7 * 86400000);
      if (result.rows.length > 0) {
        const firstRowDate = new Date(result.rows[0].act_date + "T00:00:00Z");
        if (firstRowDate < earliestDate) {
          earliestDate = firstRowDate;
        }
      }
      const earlyJsDay = earliestDate.getUTCDay();
      const earlyMonIdx = (earlyJsDay + 6) % 7;
      startMonday = new Date(earliestDate.getTime() - earlyMonIdx * 86400000);
      weeksCount = Math.max(26, Math.ceil((endSunday.getTime() - startMonday.getTime()) / (7 * 86400000)));
    } else {
      // default: last_6_months (26 weeks)
      weeksCount = 26;
      startMonday = new Date(endSunday.getTime() - (weeksCount * 7 - 1) * 86400000);
      // adjust to monday
      const sDay = startMonday.getUTCDay();
      const sMon = (sDay + 6) % 7;
      startMonday = new Date(startMonday.getTime() - sMon * 86400000);
    }

    // 3. Build Weeks Matrix (columns: weeks, rows: 7 days Monday to Sunday)
    const weeks: ActivityDay[][] = [];
    const monthHeaders: MonthHeader[] = [];
    let currentMonth = -1;

    let totalActions = 0;
    let chatInteractions = 0;
    let papersDownloaded = 0;
    let papersAnalyzed = 0;
    let otherActions = 0;
    let activeDaysCount = 0;

    let cursor = new Date(startMonday.getTime());

    for (let w = 0; w < weeksCount; w++) {
      const weekDays: ActivityDay[] = [];

      for (let d = 0; d < 7; d++) {
        const dateStr = formatDate(cursor);
        const dayOfWeek = (cursor.getUTCDay() + 6) % 7; // 0=Mon, 6=Sun
        const isFuture = cursor > todayUTC;
        const isToday = dateStr === todayStr;

        const data = activityMap.get(dateStr);
        const count = !isFuture && data ? data.total : 0;
        const chat = !isFuture && data ? data.chat : 0;
        const download = !isFuture && data ? data.download : 0;
        const analyzed = !isFuture && data ? data.analyzed : 0;
        const other = !isFuture && data ? data.other : 0;

        // Density level:
        // 0: 0
        // 1: 1-2 actions
        // 2: 3-5 actions
        // 3: 6-9 actions
        // 4: 10+ actions
        let level = 0;
        if (count >= 10) level = 4;
        else if (count >= 6) level = 3;
        else if (count >= 3) level = 2;
        else if (count >= 1) level = 1;

        if (count > 0) {
          totalActions += count;
          chatInteractions += chat;
          papersDownloaded += download;
          papersAnalyzed += analyzed;
          otherActions += other;
          activeDaysCount += 1;
        }

        // Check if month changes (label top header)
        if (d === 0 || cursor.getUTCDate() === 1) {
          const m = cursor.getUTCMonth();
          if (m !== currentMonth) {
            currentMonth = m;
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            monthHeaders.push({
              label: monthNames[m],
              weekIndex: w,
            });
          }
        }

        weekDays.push({
          date: dateStr,
          dayOfWeek,
          count,
          level,
          isToday,
          isInRange: !isFuture,
          breakdown: {
            chat,
            download,
            analyzed,
            other,
          },
        });

        // advance 1 day
        cursor = new Date(cursor.getTime() + 86400000);
      }

      weeks.push(weekDays);
    }

    // 4. Calculate Current Streak & Longest Streak across all time
    // Sort all unique dates from activityMap
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

    // Calculate Current Streak backwards from today
    let currentStreak = 0;
    let checkDate = new Date(todayUTC.getTime());
    const todayData = activityMap.get(todayStr);

    // If today has activity, start from today, else start from yesterday
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
      // Check if yesterday had activity
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

    // 5. Build Months Array for full-width responsive grid
    const months: MonthGroup[] = [];
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
      // default: last_6_months (6 consecutive months)
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

    for (const target of monthTargets) {
      months.push(buildMonthGroup(target.year, target.month, activityMap, todayUTC));
    }

    return NextResponse.json({
      success: true,
      range,
      weeks,
      monthHeaders,
      months,
      summary: {
        totalActions,
        chatInteractions,
        papersDownloaded,
        papersAnalyzed,
        otherActions,
        activeDaysCount,
        currentStreak,
        longestStreak: Math.max(longestStreak, currentStreak),
      },
    });
  } catch (error) {
    console.error("GET /api/projects/[id]/activity error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch project activity" },
      { status: 500 }
    );
  }
}
