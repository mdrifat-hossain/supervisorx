from migrations import get_database_url
import psycopg

conn = psycopg.connect(get_database_url())
cur = conn.cursor()
cur.execute('SELECT column_name FROM information_schema.columns WHERE table_name=\'session\'')
cols = [c[0] for c in cur.fetchall()]
print("Session columns:", cols)

cur.execute('SELECT * FROM session ORDER BY 1 LIMIT 1')
row = cur.fetchone()
print("Session row:", row)
