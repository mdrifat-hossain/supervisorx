from migrations import get_database_url
import psycopg

conn = psycopg.connect(get_database_url())
cur = conn.cursor()
cur.execute('SELECT id FROM "user" LIMIT 1')
user_id = cur.fetchone()[0]

query = """
WITH raw_events AS (
  SELECT 
    DATE(cm.created_at AT TIME ZONE 'UTC') as act_date,
    'chat' as act_type,
    pr.id as project_id,
    pr.title as project_title
  FROM chat_messages cm
  JOIN projects pr ON pr.id = cm.project_id
  WHERE pr.owner_user_id = %s AND cm.created_at IS NOT NULL
  
  UNION ALL
  
  SELECT 
    DATE(pp.downloaded_at AT TIME ZONE 'UTC') as act_date,
    'download' as act_type,
    pr.id as project_id,
    pr.title as project_title
  FROM project_papers pp
  JOIN projects pr ON pr.id = pp.project_id
  WHERE pr.owner_user_id = %s AND pp.downloaded_at IS NOT NULL
  
  UNION ALL
  
  SELECT 
    DATE(pp.analyzed_at AT TIME ZONE 'UTC') as act_date,
    'analyzed' as act_type,
    pr.id as project_id,
    pr.title as project_title
  FROM project_papers pp
  JOIN projects pr ON pr.id = pp.project_id
  WHERE pr.owner_user_id = %s AND pp.analyzed_at IS NOT NULL
  
  UNION ALL
  
  SELECT 
    DATE(j.created_at AT TIME ZONE 'UTC') as act_date,
    'job' as act_type,
    pr.id as project_id,
    pr.title as project_title
  FROM paper_processing_jobs j
  JOIN projects pr ON pr.id = j.project_id
  WHERE pr.owner_user_id = %s AND j.created_at IS NOT NULL

  UNION ALL

  SELECT 
    DATE(pa.created_at AT TIME ZONE 'UTC') as act_date,
    pa.activity_type as act_type,
    pr.id as project_id,
    pr.title as project_title
  FROM project_activities pa
  JOIN projects pr ON pr.id = pa.project_id
  WHERE pr.owner_user_id = %s AND pa.created_at IS NOT NULL
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
"""

cur.execute(query, (user_id, user_id, user_id, user_id, user_id))
rows = cur.fetchall()
print("All projects activity breakdown:")
for r in rows:
    print(r)
