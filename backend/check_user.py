import urllib.request
import urllib.parse
import json
import http.cookiejar

cookie_jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))

# Let's see all users
from migrations import get_database_url
import psycopg

conn = psycopg.connect(get_database_url())
cur = conn.cursor()
cur.execute('SELECT email FROM "user" LIMIT 1')
user_row = cur.fetchone()
print("Found user:", user_row)

if user_row:
    email = user_row[0]
    # Let's inspect cookies if we already have one in session table
    cur.execute('SELECT token, "userId" FROM session ORDER BY "expiresAt" DESC LIMIT 1')
    s_row = cur.fetchone()
    print("Recent session:", s_row)
