import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let _sql: NeonQueryFunction<false, false> | null = null;
let _schemaReady = false;

export function getDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? '';
  return url.trim().length > 0 ? url.trim() : null;
}

export function isDatabaseConfigured(): boolean {
  return getDatabaseUrl() !== null;
}

export function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = getDatabaseUrl();
    if (!url) {
      throw new Error('DATABASE_URL is not configured.');
    }
    _sql = neon(url);
  }
  return _sql;
}

export async function ensureScoresTable(): Promise<void> {
  if (_schemaReady) return;

  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS reaction_scores (
      id SERIAL PRIMARY KEY,
      player_name VARCHAR(32) NOT NULL,
      average_ms INTEGER NOT NULL,
      best_ms INTEGER NOT NULL,
      attempts JSONB NOT NULL,
      rank_title VARCHAR(64) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_reaction_scores_ranking
    ON reaction_scores (average_ms ASC, best_ms ASC, created_at ASC)
  `;

  _schemaReady = true;
}
