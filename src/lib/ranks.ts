export const TOTAL_ATTEMPTS = 5;
export const MIN_DELAY_MS = 2000;
export const MAX_DELAY_MS = 5000;
export const LOCAL_STORAGE_KEY = 'reaction_test_bb_personal_best_v1';

export interface ReactionRank {
  id: string;
  title: string;
  subtitle: string;
  purity: string;
  elementSymbol: string;
  atomicNumber: number;
  message: string;
  accentClass: string;
}

export interface LocalRecord {
  bestSingleMs: number | null;
  bestAverageMs: number | null;
  gamesCompleted: number;
  updatedAt: string;
}

export interface LeaderboardEntry {
  id: number;
  playerName: string;
  averageMs: number;
  bestMs: number;
  attempts: number[];
  rankTitle: string;
  createdAt: string;
}

export function getReactionRank(averageMs: number): ReactionRank {
  if (averageMs < 180) {
    return {
      id: 'heisenberg',
      title: 'Heisenberg',
      subtitle: 'Pureza 99,1% — Nível Lendário',
      purity: '99,1%',
      elementSymbol: 'He',
      atomicNumber: 2,
      message:
        'I am the one who clicks! Reflexos com 99,1% de pureza, dignos do chefão de Albuquerque.',
      accentClass: 'text-sky-400 border-sky-400/50 bg-sky-500/10',
    };
  }

  if (averageMs < 220) {
    return {
      id: 'gus-fring',
      title: 'Gustavo Fring',
      subtitle: 'Precisão Cirúrgica',
      purity: '96,2%',
      elementSymbol: 'Fr',
      atomicNumber: 87,
      message:
        'Frio, calculista e impecável. Padrão Los Pollos Hermanos de eficiência absoluta.',
      accentClass: 'text-cyan-400 border-cyan-400/50 bg-cyan-500/10',
    };
  }

  if (averageMs < 260) {
    return {
      id: 'mike',
      title: 'Mike Ehrmantraut',
      subtitle: 'Sem Meias Medidas',
      purity: '91,8%',
      elementSymbol: 'Fe',
      atomicNumber: 26,
      message:
        'Sem meias medidas. Reflexos afiados de quem nunca abaixa a guarda.',
      accentClass: 'text-blue-400 border-blue-400/50 bg-blue-500/10',
    };
  }

  if (averageMs < 310) {
    return {
      id: 'jesse',
      title: 'Jesse Pinkman',
      subtitle: 'Yeah, Science!',
      purity: '84,5%',
      elementSymbol: 'Br',
      atomicNumber: 35,
      message:
        'Yeah, science! Bom ritmo no laboratório, mas dá para cozinhar ainda mais rápido!',
      accentClass: 'text-emerald-400 border-emerald-400/50 bg-emerald-500/10',
    };
  }

  if (averageMs < 380) {
    return {
      id: 'saul',
      title: 'Saul Goodman',
      subtitle: 'Melhor Chamar o Saul',
      purity: '72,0%',
      elementSymbol: 'Au',
      atomicNumber: 79,
      message:
        'Melhor chamar o Saul... seus reflexos vão precisar de um ótimo advogado!',
      accentClass: 'text-amber-400 border-amber-400/50 bg-amber-500/10',
    };
  }

  return {
    id: 'badger',
    title: 'Badger & Skinny Pete',
    subtitle: 'Modo Deserto de Novo México',
    purity: '54,3%',
    elementSymbol: 'Ba',
    atomicNumber: 56,
    message:
      'Calma aí, parceiro! Até o trailer no deserto arranca mais rápido que isso.',
    accentClass: 'text-rose-400 border-rose-400/50 bg-rose-500/10',
  };
}

export function getSingleShotFeedback(ms: number): string {
  if (ms < 165) return 'Pureza 99,1%! Velocidade absurda!';
  if (ms < 210) return 'Reação cirúrgica! Estilo Gus Fring.';
  if (ms < 260) return 'Ótimo reflexo! Sem meias medidas.';
  if (ms < 320) return 'Bom tempo! Dá para acelerar no próximo lote.';
  return 'Um pouco lento — concentre-se no sinal verde!';
}

export function readLocalRecord(): LocalRecord {
  if (typeof window === 'undefined') {
    return {
      bestSingleMs: null,
      bestAverageMs: null,
      gamesCompleted: 0,
      updatedAt: '',
    };
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return {
        bestSingleMs: null,
        bestAverageMs: null,
        gamesCompleted: 0,
        updatedAt: '',
      };
    }

    const parsed = JSON.parse(raw) as Partial<LocalRecord>;
    return {
      bestSingleMs:
        typeof parsed.bestSingleMs === 'number' && parsed.bestSingleMs > 0
          ? parsed.bestSingleMs
          : null,
      bestAverageMs:
        typeof parsed.bestAverageMs === 'number' && parsed.bestAverageMs > 0
          ? parsed.bestAverageMs
          : null,
      gamesCompleted:
        typeof parsed.gamesCompleted === 'number' && parsed.gamesCompleted >= 0
          ? parsed.gamesCompleted
          : 0,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch {
    return {
      bestSingleMs: null,
      bestAverageMs: null,
      gamesCompleted: 0,
      updatedAt: '',
    };
  }
}

export function saveLocalRecord(record: LocalRecord): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

export function clearLocalRecord(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
