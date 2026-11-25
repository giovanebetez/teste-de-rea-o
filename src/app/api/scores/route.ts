import { NextResponse } from 'next/server';
import { ensureScoresTable, getSql, isDatabaseConfigured } from '@/lib/db';
import {
  getReactionRank,
  TOTAL_ATTEMPTS,
  type LeaderboardEntry,
} from '@/lib/ranks';

export const dynamic = 'force-dynamic';

interface ScoreRow {
  id: number;
  player_name: string;
  average_ms: number;
  best_ms: number;
  attempts: number[] | string;
  rank_title: string;
  created_at: string | Date;
}

function mapRow(row: ScoreRow): LeaderboardEntry {
  const parsedAttempts = Array.isArray(row.attempts)
    ? row.attempts.map(Number)
    : typeof row.attempts === 'string'
      ? (JSON.parse(row.attempts) as number[]).map(Number)
      : [];

  return {
    id: Number(row.id),
    playerName: row.player_name,
    averageMs: Number(row.average_ms),
    bestMs: Number(row.best_ms),
    attempts: parsedAttempts,
    rankTitle: row.rank_title,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

async function fetchTopScores(): Promise<LeaderboardEntry[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, player_name, average_ms, best_ms, attempts, rank_title, created_at
    FROM reaction_scores
    ORDER BY average_ms ASC, best_ms ASC, created_at ASC
    LIMIT 10
  `) as ScoreRow[];

  return rows.map(mapRow);
}

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      scores: [],
    });
  }

  try {
    await ensureScoresTable();
    const scores = await fetchTopScores();
    return NextResponse.json({
      configured: true,
      scores,
    });
  } catch (error) {
    console.error('[GET /api/scores] Database error:', error);
    return NextResponse.json(
      {
        configured: false,
        scores: [],
        error: 'Não foi possível conectar ao banco de dados Neon.',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: 'Banco de dados Neon não configurado neste ambiente.' },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as {
      playerName?: unknown;
      attempts?: unknown;
    };

    const rawName = typeof body.playerName === 'string' ? body.playerName : '';
    const playerName = rawName.trim().replace(/\s+/g, ' ');

    if (playerName.length < 2 || playerName.length > 24) {
      return NextResponse.json(
        { error: 'O codinome deve ter entre 2 e 24 caracteres.' },
        { status: 400 },
      );
    }

    if (!/^[\p{L}\p{N}\s._-]+$/u.test(playerName)) {
      return NextResponse.json(
        { error: 'Use apenas letras, números, espaços, ponto, traço ou sublinhado.' },
        { status: 400 },
      );
    }

    if (
      !Array.isArray(body.attempts) ||
      body.attempts.length !== TOTAL_ATTEMPTS
    ) {
      return NextResponse.json(
        { error: `É necessário enviar exatamente ${TOTAL_ATTEMPTS} tentativas válidas.` },
        { status: 400 },
      );
    }

    const attempts = body.attempts.map((value) => Math.round(Number(value)));
    const allValid = attempts.every(
      (ms) => Number.isFinite(ms) && ms >= 60 && ms <= 10000,
    );

    if (!allValid) {
      return NextResponse.json(
        { error: 'Valores de tempo inválidos (precisam estar entre 60 ms e 10000 ms).' },
        { status: 400 },
      );
    }

    const averageMs = Math.round(
      attempts.reduce((sum, value) => sum + value, 0) / attempts.length,
    );
    const bestMs = Math.min(...attempts);
    const rankTitle = getReactionRank(averageMs).title;

    await ensureScoresTable();
    const sql = getSql();

    const inserted = (await sql`
      INSERT INTO reaction_scores (player_name, average_ms, best_ms, attempts, rank_title)
      VALUES (${playerName}, ${averageMs}, ${bestMs}, ${JSON.stringify(attempts)}::jsonb, ${rankTitle})
      RETURNING id, player_name, average_ms, best_ms, attempts, rank_title, created_at
    `) as ScoreRow[];

    const scores = await fetchTopScores();

    return NextResponse.json(
      {
        configured: true,
        entry: inserted[0] ? mapRow(inserted[0]) : null,
        scores,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/scores] Database error:', error);
    return NextResponse.json(
      { error: 'Erro ao registrar pontuação no banco de dados Neon.' },
      { status: 500 },
    );
  }
}
