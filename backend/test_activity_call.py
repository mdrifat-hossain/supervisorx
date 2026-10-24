import urllib.request
import json
from migrations import get_database_url
import psycopg

conn = psycopg.connect(get_database_url())
cur = conn.cursor()
cur.execute('SELECT token FROM session ORDER BY "expiresAt" DESC LIMIT 1')
token = cur.fetchone()[0]
print("Using session token:", token)

# Better auth uses session token in Cookie: better-auth.session_token
req = urllib.request.Request(
    "http://frontend:3000/api/projects/nlp-related-research-work-xxyjo/activity?range=last_6_months",
    headers={
        "Cookie": f"better-auth.session_token={token}"
    }
)

try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print("Success! Status:", resp.status)
        print("Summary:", json.dumps(data["summary"], indent=2))
        print("Number of weeks:", len(data["weeks"]))
        print("Month headers:", data["monthHeaders"])
        active_days = [d for w in data["weeks"] for d in w if d["count"] > 0]
        print("Active days found in last 6 months:", len(active_days))
        for ad in active_days:
            print("  Day:", ad["date"], "Total:", ad["count"], "Level:", ad["level"], "Breakdown:", ad["breakdown"])
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code, e.read().decode())
