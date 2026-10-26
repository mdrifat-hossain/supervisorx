const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@db:5432/researchpilot' });

async function check() {
  const { rows } = await pool.query(`
    SELECT pp.paper_id, p.title as project_title, pp.title as paper_title
    FROM project_papers pp
    JOIN projects p ON p.id = pp.project_id
    ORDER BY pp.paper_id
  `);
  console.log('Total project_paper rows in DB:', rows.length);
  const byPaper = {};
  for (const r of rows) {
    if (!byPaper[r.paper_id]) byPaper[r.paper_id] = [];
    byPaper[r.paper_id].push(r.project_title);
  }
  console.log('Unique papers count:', Object.keys(byPaper).length);
  for (const [pid, projs] of Object.entries(byPaper)) {
    console.log(`- ${pid}: in ${projs.length} project(s) -> [${projs.join(', ')}]`);
  }
  await pool.end();
}
check();
