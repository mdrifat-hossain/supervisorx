import { Pool } from "pg";
import { getDatabaseUrl } from "./database-url";

const connectionString = getDatabaseUrl();

let pool: Pool;

declare global {
  // eslint-disable-next-line no-var
  var __postgres_pool: Pool | undefined;
}

if (process.env.NODE_ENV === "production") {
  pool = new Pool({ connectionString });
} else {
  if (!global.__postgres_pool) {
    global.__postgres_pool = new Pool({ connectionString });
  }
  pool = global.__postgres_pool;
}

export { pool };

let initialized = false;

export async function initProjectsTable() {
  if (initialized) return;
  const sql = `
    CREATE TABLE IF NOT EXISTS projects (
      id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      domain VARCHAR(100) NOT NULL,
      description TEXT DEFAULT '',
      color VARCHAR(50) DEFAULT 'primary',
      papers_count INTEGER DEFAULT 0,
      dataset_size VARCHAR(50) DEFAULT '0 GB',
      collaborators JSONB DEFAULT '["ME"]'::jsonb,
      owner_user_id TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id VARCHAR(64) PRIMARY KEY,
      project_id VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      paper_count INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id VARCHAR(64) PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL,
      project_id VARCHAR(64) NOT NULL,
      sender VARCHAR(10) NOT NULL,
      text TEXT DEFAULT '',
      time_label VARCHAR(50) DEFAULT '',
      tag VARCHAR(100),
      is_papers_response BOOLEAN DEFAULT FALSE,
      papers JSONB DEFAULT '[]'::jsonb,
      intro_text TEXT,
      total_verified INTEGER DEFAULT 0,
      queued_info JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS project_papers (
      id VARCHAR(128) PRIMARY KEY,
      project_id VARCHAR(64) NOT NULL,
      paper_id VARCHAR(128) NOT NULL,
      title TEXT NOT NULL,
      authors TEXT DEFAULT '',
      venue VARCHAR(255) DEFAULT '',
      year INTEGER,
      published VARCHAR(50) DEFAULT '',
      summary TEXT DEFAULT '',
      pdf_url TEXT DEFAULT '',
      entry_url TEXT DEFAULT '',
      primary_category VARCHAR(100) DEFAULT '',
      file_name VARCHAR(255) DEFAULT '',
      file_size BIGINT DEFAULT 0,
      file_size_label VARCHAR(50) DEFAULT '',
      tags JSONB DEFAULT '[]'::jsonb,
      downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      storage_bucket TEXT,
      storage_path TEXT,
      CONSTRAINT uq_project_paper UNIQUE (project_id, paper_id)
    );

    CREATE INDEX IF NOT EXISTS idx_chat_sessions_project ON chat_sessions(project_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_project_papers_project ON project_papers(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_papers_year ON project_papers(year);
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_user_id TEXT;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE project_papers ADD COLUMN IF NOT EXISTS storage_bucket TEXT;
    ALTER TABLE project_papers ADD COLUMN IF NOT EXISTS storage_path TEXT;
    ALTER TABLE project_papers ADD COLUMN IF NOT EXISTS analysis_status VARCHAR(50) DEFAULT 'pending';
    ALTER TABLE project_papers ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE project_papers ADD COLUMN IF NOT EXISTS insights JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE project_papers ADD COLUMN IF NOT EXISTS analysis_error TEXT;
    ALTER TABLE project_papers ADD COLUMN IF NOT EXISTS chunks_count INTEGER DEFAULT 0;
    ALTER TABLE project_papers ADD COLUMN IF NOT EXISTS figures_count INTEGER DEFAULT 0;
    ALTER TABLE project_papers ADD COLUMN IF NOT EXISTS vectors_count INTEGER DEFAULT 0;
    ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS citations JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS intent VARCHAR(50);
    ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS document JSONB;
    CREATE INDEX IF NOT EXISTS idx_project_papers_status ON project_papers(project_id, analysis_status);

    CREATE TABLE IF NOT EXISTS paper_processing_jobs (
      id VARCHAR(128) PRIMARY KEY,
      project_id VARCHAR(64) NOT NULL,
      paper_id VARCHAR(128),
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      current_stage VARCHAR(100) DEFAULT 'validating',
      progress_percent INTEGER DEFAULT 0,
      total_papers INTEGER DEFAULT 1,
      processed_papers INTEGER DEFAULT 0,
      current_paper_title TEXT,
      error_message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      completed_at TIMESTAMP WITH TIME ZONE
    );

    CREATE TABLE IF NOT EXISTS project_activities (
      id VARCHAR(128) PRIMARY KEY,
      project_id VARCHAR(64) NOT NULL,
      activity_type VARCHAR(50) NOT NULL,
      description TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_project_activities_project ON project_activities(project_id, created_at);

    CREATE TABLE IF NOT EXISTS sticky_notes (
      id VARCHAR(64) PRIMARY KEY,
      user_id TEXT NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT DEFAULT '',
      category VARCHAR(100) DEFAULT 'Active Note',
      color_type VARCHAR(50) DEFAULT 'amber',
      status VARCHAR(50) DEFAULT 'Active',
      is_pinned BOOLEAN DEFAULT FALSE,
      pinned_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sticky_notes_user ON sticky_notes(user_id, is_pinned DESC, created_at DESC);

    UPDATE projects
    SET owner_user_id = (SELECT id FROM "user" LIMIT 1)
    WHERE owner_user_id IS NULL AND (SELECT COUNT(*) FROM "user") = 1;
  `;
  try {
    await pool.query(sql);

    // Seed existing downloaded papers from storage folder for the current project if empty
    const checkSql = `SELECT COUNT(*) FROM project_papers;`;
    const countRes = await pool.query(checkSql);
    if (parseInt(countRes.rows[0].count, 10) === 0) {
      // Find the existing project ID
      const projRes = await pool.query(`SELECT id FROM projects ORDER BY created_at ASC LIMIT 1;`);
      const defaultProjectId = projRes.rows[0]?.id || "nlp-related-research-work-xxyjo";

      const seedPapers = [
        {
          paper_id: "2306.14753v1",
          title: "The Deep Arbitrary Polynomial Chaos Neural Network or how Deep Artificial Neural Networks can solve Uncertainty Quantification Problems",
          authors: "V. Keshavarzzadeh, R. M. Kirby, A. Narayan",
          venue: "arXiv:2306.14753",
          year: 2023,
          published: "2023-06-26",
          file_name: "2306.14753v1_The_Deep_Arbitrary_Polynomial_Chaos_Neural_Network_or_how_De.pdf",
          file_size: 1669887,
          file_size_label: "1.6 MB • PDF",
          tags: ["Neural Networks", "Uncertainty Quantification", "Deep Learning"],
          entry_url: "https://arxiv.org/abs/2306.14753v1",
          pdf_url: "https://arxiv.org/pdf/2306.14753v1.pdf",
          primary_category: "Computer Science",
          summary: "We present deep arbitrary polynomial chaos neural networks for solving high-dimensional uncertainty quantification problems with arbitrary probability measures."
        },
        {
          paper_id: "2401.08828",
          title: "2-Selmer Groups over Multiquadratic Extensions",
          authors: "Alexander Smith",
          venue: "arXiv:2401.08828",
          year: 2024,
          published: "2024-01-16",
          file_name: "2401.08828_2-Selmer_Groups_over_Multiquadratic_Extensions.pdf",
          file_size: 414637,
          file_size_label: "405 KB • PDF",
          tags: ["Number Theory", "Arithmetic Geometry"],
          entry_url: "https://arxiv.org/abs/2401.08828",
          pdf_url: "https://arxiv.org/pdf/2401.08828.pdf",
          primary_category: "Mathematics",
          summary: "An investigation of 2-Selmer groups of elliptic curves over multiquadratic extensions with explicit distribution bounds."
        },
        {
          paper_id: "2601.15305v1",
          title: "Gated Sparse Attention: Combining Computational Efficiency with High Performance",
          authors: "M. Zhang, H. Liu, C. Wang, et al.",
          venue: "arXiv:2601.15305",
          year: 2026,
          published: "2026-01-22",
          file_name: "2601.15305v1_Gated_Sparse_Attention_Combining_Computational_Efficiency_wi.pdf",
          file_size: 740654,
          file_size_label: "723 KB • PDF",
          tags: ["Attention Mechanism", "Efficiency", "Transformers"],
          entry_url: "https://arxiv.org/abs/2601.15305v1",
          pdf_url: "https://arxiv.org/pdf/2601.15305v1.pdf",
          primary_category: "Computer Science",
          summary: "Gated Sparse Attention introduces dynamic gating masks over key-value representations, yielding sub-quadratic time complexity with near-lossless perplexity."
        },
        {
          paper_id: "2608.19200v1",
          title: "Transformer Models for Text Summarization: A Comparative Study",
          authors: "A. Sharma, P. Gupta, R. Kumar, et al.",
          venue: "arXiv:2608.19200",
          year: 2026,
          published: "2026-08-19",
          file_name: "2608.19200v1_Transformer_Models_for_Text_Summarization_A_Comparative_Stud.pdf",
          file_size: 341371,
          file_size_label: "333 KB • PDF",
          tags: ["Text Summarization", "Transformers", "NLP"],
          entry_url: "https://arxiv.org/abs/2608.19200v1",
          pdf_url: "https://arxiv.org/pdf/2608.19200v1.pdf",
          primary_category: "Computer Science",
          summary: "A rigorous empirical study evaluating abstractive vs extractive transformer architectures on large multi-document text summarization benchmarks."
        }
      ];

      for (const p of seedPapers) {
        await pool.query(
          `INSERT INTO project_papers (
            id, project_id, paper_id, title, authors, venue, year, published, summary, pdf_url, entry_url, primary_category, file_name, file_size, file_size_label, tags
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (project_id, paper_id) DO NOTHING;`,
          [
            `${defaultProjectId}_${p.paper_id}`,
            defaultProjectId,
            p.paper_id,
            p.title,
            p.authors,
            p.venue,
            p.year,
            p.published,
            p.summary,
            p.pdf_url,
            p.entry_url,
            p.primary_category,
            p.file_name,
            p.file_size,
            p.file_size_label,
            JSON.stringify(p.tags)
          ]
        );
      }

      // Update papers_count on the project
      await pool.query(
        `UPDATE projects SET papers_count = (SELECT COUNT(*) FROM project_papers WHERE project_id = $1) WHERE id = $1;`,
        [defaultProjectId]
      );
    }

    initialized = true;
  } catch (err) {
    console.error("Failed to initialize database tables:", err);
  }
}

