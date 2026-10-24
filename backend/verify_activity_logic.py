from migrations import get_database_url
import psycopg
import datetime

conn = psycopg.connect(get_database_url())
cur = conn.cursor()

project_id = 'nlp-related-research-work-xxyjo'

query = """
WITH raw_events AS (
  SELECT 
    DATE(created_at AT TIME ZONE 'UTC') as act_date,
    'chat' as act_type
  FROM chat_messages
  WHERE project_id = %s AND created_at IS NOT NULL
  
  UNION ALL
  
  SELECT 
    DATE(downloaded_at AT TIME ZONE 'UTC') as act_date,
    'download' as act_type
  FROM project_papers
  WHERE project_id = %s AND downloaded_at IS NOT NULL
  
  UNION ALL
  
  SELECT 
    DATE(analyzed_at AT TIME ZONE 'UTC') as act_date,
    'analyzed' as act_type
  FROM project_papers
  WHERE project_id = %s AND analyzed_at IS NOT NULL
  
  UNION ALL
  
  SELECT 
    DATE(created_at AT TIME ZONE 'UTC') as act_date,
    'job' as act_type
  FROM paper_processing_jobs
  WHERE project_id = %s AND created_at IS NOT NULL

  UNION ALL

  SELECT 
    DATE(created_at AT TIME ZONE 'UTC') as act_date,
    activity_type as act_type
  FROM project_activities
  WHERE project_id = %s AND created_at IS NOT NULL
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
"""

cur.execute(query, (project_id, project_id, project_id, project_id, project_id))
rows = cur.fetchall()
print("Aggregated Activity Rows by Date:")
total_actions = 0
for r in rows:
    print(f"Date: {r[0]} | Total: {r[1]} | Chat: {r[2]} | Downloaded: {r[3]} | Analyzed: {r[4]} | Other: {r[5]}")
    total_actions += r[1]

print(f"\nTotal Actions across all dates for project {project_id}: {total_actions}")
