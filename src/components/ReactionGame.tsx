'use client';

import {
  AlertTriangle,
  Award,
  CheckCircle2,
  FlaskConical,
  Loader2,
  Play,
  RotateCcw,
  Send,
  Timer,
  Trash2,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { PeriodicBadge } from '@/components/PeriodicBadge';
import {
  clearLocalRecord,
  getReactionRank,
  getSingleShotFeedback,
  MAX_DELAY_MS,
  MIN_DELAY_MS,
  readLocalRecord,
  saveLocalRecord,
  TOTAL_ATTEMPTS,
  type LeaderboardEntry,
  type LocalRecord,
} from '@/lib/ranks';

type GamePhase =
  | 'idle'
  | 'waiting'
  | 'ready'
  | 'too-early'
  | 'result'
  | 'summary';

const INTERACTION_COOLDOWN_MS = 320;

export default function ReactionGame() {
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [attempts, setAttempts] = useState<number[]>([]);
  const [lastReactionMs, setLastReactionMs] = useState<number | null>(null);
  const [isNewSingleRecord, setIsNewSingleRecord] = useState(false);
  const [isNewAverageRecord, setIsNewAverageRecord] = useState(false);

  const [localRecord, setLocalRecord] = useState<LocalRecord>({
    bestSingleMs: null,
    bestAverageMs: null,
    gamesCompleted: 0,
    updatedAt: '',
  });
  const [confirmClear, setConfirmClear] = useState(false);

  // Neon Global Leaderboard state
  const [dbConfigured, setDbConfigured] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [playerName, setPlayerName] = useState('');
  const [submittingScore, setSubmittingScore] = useState(false);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Precision timing refs
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const greenStartRef = useRef<number>(0);
  const phaseLockUntilRef = useRef<number>(0);
  const phaseRef = useRef<GamePhase>('idle');
  const attemptsRef = useRef<number[]>([]);
  const localRecordRef = useRef<LocalRecord>(localRecord);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    attemptsRef.current = attempts;
  }, [attempts]);

  useEffect(() => {
    localRecordRef.current = localRecord;
  }, [localRecord]);

  const clearScheduledTimers = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Load LocalStorage record and Neon leaderboard on mount
  useEffect(() => {
    const stored = readLocalRecord();
    setLocalRecord(stored);
    localRecordRef.current = stored;

    let cancelled = false;
    async function loadLeaderboard() {
      try {
        const res = await fetch('/api/scores', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as {
          configured?: boolean;
          scores?: LeaderboardEntry[];
        };
        if (!cancelled) {
          setDbConfigured(Boolean(data.configured));
          setLeaderboard(Array.isArray(data.scores) ? data.scores : []);
        }
      } catch {
        // Keep leaderboard hidden if unavailable
      } finally {
        if (!cancelled) {
          setLeaderboardLoading(false);
        }
      }
    }

    void loadLeaderboard();

    return () => {
      cancelled = true;
      clearScheduledTimers();
    };
  }, [clearScheduledTimers]);

  const startWaitingPhase = useCallback(() => {
    clearScheduledTimers();
    setLastReactionMs(null);
    setIsNewSingleRecord(false);
    setPhase('waiting');
    phaseRef.current = 'waiting';

    const randomDelay =
      MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setPhase('ready');
      phaseRef.current = 'ready';
      // Capture high-resolution timestamp aligned with the visual frame
      greenStartRef.current = performance.now();
      rafRef.current = window.requestAnimationFrame((frameTime) => {
        rafRef.current = null;
        if (phaseRef.current === 'ready') {
          greenStartRef.current = frameTime;
        }
      });
    }, randomDelay);
  }, [clearScheduledTimers]);

  const startNewGame = useCallback(() => {
    clearScheduledTimers();
    setAttempts([]);
    attemptsRef.current = [];
    setLastReactionMs(null);
    setIsNewSingleRecord(false);
    setIsNewAverageRecord(false);
    setScoreSubmitted(false);
    setSubmitError(null);
    setConfirmClear(false);
    startWaitingPhase();
  }, [clearScheduledTimers, startWaitingPhase]);

  const handleEarlyClick = useCallback(() => {
    clearScheduledTimers();
    phaseLockUntilRef.current = performance.now() + INTERACTION_COOLDOWN_MS;
    setPhase('too-early');
    phaseRef.current = 'too-early';
  }, [clearScheduledTimers]);

  const handleGreenHit = useCallback(() => {
    const reactionMs = Math.max(
      1,
      Math.round(performance.now() - greenStartRef.current),
    );
    clearScheduledTimers();
    phaseLockUntilRef.current = performance.now() + INTERACTION_COOLDOWN_MS;

    const updatedAttempts = [...attemptsRef.current, reactionMs];
    attemptsRef.current = updatedAttempts;
    setAttempts(updatedAttempts);
    setLastReactionMs(reactionMs);

    const currentRec = localRecordRef.current;
    const beatSingle =
      currentRec.bestSingleMs === null || reactionMs < currentRec.bestSingleMs;

    if (updatedAttempts.length >= TOTAL_ATTEMPTS) {
      const avg = Math.round(
        updatedAttempts.reduce((acc, v) => acc + v, 0) / updatedAttempts.length,
      );
      const beatAvg =
        currentRec.bestAverageMs === null || avg < currentRec.bestAverageMs;

      const nextRecord: LocalRecord = {
        bestSingleMs: beatSingle ? reactionMs : currentRec.bestSingleMs,
        bestAverageMs: beatAvg ? avg : currentRec.bestAverageMs,
        gamesCompleted: currentRec.gamesCompleted + 1,
        updatedAt: new Date().toISOString(),
      };

      setLocalRecord(nextRecord);
      localRecordRef.current = nextRecord;
      saveLocalRecord(nextRecord);
      setIsNewSingleRecord(beatSingle);
      setIsNewAverageRecord(beatAvg);
      setPhase('summary');
      phaseRef.current = 'summary';
    } else {
      if (beatSingle) {
        const nextRecord: LocalRecord = {
          ...currentRec,
          bestSingleMs: reactionMs,
          updatedAt: new Date().toISOString(),
        };
        setLocalRecord(nextRecord);
        localRecordRef.current = nextRecord;
        saveLocalRecord(nextRecord);
      }
      setIsNewSingleRecord(beatSingle);
      setPhase('result');
      phaseRef.current = 'result';
    }
  }, [clearScheduledTimers]);

  const handleArenaPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // Ignore secondary mouse buttons
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      const currentPhase = phaseRef.current;

      if (currentPhase === 'waiting') {
        e.preventDefault();
        handleEarlyClick();
        return;
      }

      if (currentPhase === 'ready') {
        e.preventDefault();
        handleGreenHit();
        return;
      }

      if (currentPhase === 'too-early' || currentPhase === 'result') {
        if (performance.now() < phaseLockUntilRef.current) return;
        e.preventDefault();
        startWaitingPhase();
      }
    },
    [handleEarlyClick, handleGreenHit, startWaitingPhase],
  );

  // Keyboard support (Spacebar for zero-latency desktop reaction)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const currentPhase = phaseRef.current;
      if (currentPhase === 'summary') return;

      e.preventDefault();

      if (currentPhase === 'idle') {
        startNewGame();
      } else if (currentPhase === 'waiting') {
        handleEarlyClick();
      } else if (currentPhase === 'ready') {
        handleGreenHit();
      } else if (currentPhase === 'too-early' || currentPhase === 'result') {
        if (performance.now() < phaseLockUntilRef.current) return;
        startWaitingPhase();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleEarlyClick, handleGreenHit, startNewGame, startWaitingPhase]);

  const stats = useMemo(() => {
    if (attempts.length === 0) {
      return { average: 0, best: 0, worst: 0 };
    }
    const sum = attempts.reduce((acc, v) => acc + v, 0);
    return {
      average: Math.round(sum / attempts.length),
      best: Math.min(...attempts),
      worst: Math.max(...attempts),
    };
  }, [attempts]);

  const rank = useMemo(
    () => (attempts.length === TOTAL_ATTEMPTS ? getReactionRank(stats.average) : null),
    [attempts.length, stats.average],
  );

  const handleClearRecord = () => {
    clearLocalRecord();
    const empty: LocalRecord = {
      bestSingleMs: null,
      bestAverageMs: null,
      gamesCompleted: 0,
      updatedAt: '',
    };
    setLocalRecord(empty);
    localRecordRef.current = empty;
    setConfirmClear(false);
  };

  const handleScoreSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submittingScore || scoreSubmitted || attempts.length !== TOTAL_ATTEMPTS) {
      return;
    }

    const trimmed = playerName.trim();
    if (trimmed.length < 2) {
      setSubmitError('Digite um codinome com pelo menos 2 caracteres.');
      return;
    }

    setSubmittingScore(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: trimmed,
          attempts,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        scores?: LeaderboardEntry[];
      };

      if (!res.ok) {
        setSubmitError(data.error ?? 'Não foi possível salvar sua pontuação.');
        return;
      }

      if (Array.isArray(data.scores)) {
        setLeaderboard(data.scores);
      }
      setScoreSubmitted(true);
    } catch {
      setSubmitError('Erro de conexão ao salvar no ranking.');
    } finally {
      setSubmittingScore(false);
    }
  };

  const currentAttemptNumber = Math.min(attempts.length + 1, TOTAL_ATTEMPTS);

  // Dynamic surface styling for the massive central arena
  const arenaClasses = (() => {
    switch (phase) {
      case 'waiting':
        return 'transition-colors duration-300 bg-gradient-to-br from-red-600 via-red-700 to-rose-900 border-red-400/60 shadow-[0_0_70px_rgba(220,38,38,0.4)] cursor-pointer';
      case 'ready':
        return 'signal-instant bg-gradient-to-br from-emerald-500 via-green-500 to-emerald-600 border-emerald-200/80 shadow-[0_0_85px_rgba(34,197,94,0.5)] cursor-pointer';
      case 'too-early':
        return 'transition-all duration-300 bg-gradient-to-br from-amber-950/90 via-red-950/90 to-slate-950 border-amber-500/50 shadow-[0_0_50px_rgba(245,158,11,0.2)] cursor-pointer';
      case 'result':
        return 'transition-all duration-300 bg-gradient-to-br from-slate-900/95 via-sky-950/50 to-slate-950 border-sky-400/40 shadow-[0_0_55px_rgba(14,165,233,0.18)] cursor-pointer';
      case 'summary':
        return 'transition-all duration-300 bg-gradient-to-b from-slate-900/95 to-slate-950/95 border-sky-500/35 shadow-[0_0_60px_rgba(14,165,233,0.15)]';
      default:
        return 'transition-all duration-300 bg-gradient-to-b from-slate-900/90 via-[#0b1324]/95 to-slate-950/95 border-sky-500/30 shadow-[0_0_50px_rgba(14,165,233,0.12)]';
    }
  })();

  const hasRecord =
    localRecord.bestSingleMs !== null || localRecord.bestAverageMs !== null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-5 sm:px-6 sm:py-7">
      {/* Header */}
      <header className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <PeriodicBadge symbol="Re" atomicNumber={75} size="md" variant="blue" />
            <span className="text-xl font-bold tracking-[0.14em] text-slate-100 sm:text-2xl">
              ACTION
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <PeriodicBadge symbol="Te" atomicNumber={52} size="md" variant="emerald" />
            <span className="text-xl font-bold tracking-[0.14em] text-slate-100 sm:text-2xl">
              ST
            </span>
          </div>
        </div>

        {/* Personal Best HUD (LocalStorage) */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-sky-500/25 bg-slate-900/80 px-3.5 py-2 backdrop-blur-md">
            <Trophy className="h-4 w-4 shrink-0 text-sky-400" />
            <div className="flex items-center gap-4 text-xs">
              <div>
                <p className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">
                  Melhor Pessoal
                </p>
                <p className="font-mono-tabular text-sm font-bold text-sky-300">
                  {localRecord.bestSingleMs !== null
                    ? `${localRecord.bestSingleMs} ms`
                    : '—'}
                </p>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <p className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">
                  Melhor Média
                </p>
                <p className="font-mono-tabular text-sm font-bold text-slate-100">
                  {localRecord.bestAverageMs !== null
                    ? `${localRecord.bestAverageMs} ms`
                    : '—'}
                </p>
              </div>
            </div>

            {hasRecord && !confirmClear && (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                title="Zerar recorde pessoal"
                aria-label="Zerar recorde pessoal"
                className="ml-1 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-rose-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}

            {confirmClear && (
              <div className="ml-1 flex items-center gap-1.5 border-l border-slate-800 pl-2">
                <button
                  type="button"
                  onClick={handleClearRecord}
                  className="rounded-md bg-rose-500/20 px-2 py-1 text-[11px] font-semibold text-rose-300 transition-colors hover:bg-rose-500/30"
                >
                  Zerar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-700"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Central Test Arena */}
      <main className="flex flex-1 flex-col gap-5">
        <section
          aria-live="polite"
          onPointerDown={handleArenaPointerDown}
          className={`relative flex w-full flex-col items-center justify-center overflow-hidden rounded-3xl border select-none touch-manipulation ${
            phase === 'summary'
              ? 'min-h-[56vh] px-5 py-7 sm:px-8 sm:py-9'
              : 'min-h-[56vh] px-6 py-10 sm:min-h-[60vh] sm:px-10'
          } ${arenaClasses}`}
        >
          {/* Subtle decorative lab corner labels inside non-signal phases */}
          {phase !== 'waiting' && phase !== 'ready' && (
            <div className="pointer-events-none absolute top-4 left-5 flex items-center gap-2 text-[11px] font-medium tracking-widest text-sky-400/60 uppercase">
              <FlaskConical className="h-3.5 w-3.5" />
              <span>Lab Albuquerque • 99,1% Blue Sky</span>
            </div>
          )}

          {/* IDLE PHASE */}
          {phase === 'idle' && (
            <div className="animate-fade-in-up flex max-w-xl flex-col items-center text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-400/40 bg-sky-500/10 text-sky-400 shadow-[0_0_30px_rgba(14,165,233,0.2)]">
                <Zap className="h-8 w-8" />
              </div>

              <h1 className="mb-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">
                Teste sua Velocidade de{' '}
                <span className="text-sky-400">Reação</span>
              </h1>

              <p className="mb-8 max-w-md text-sm leading-relaxed text-slate-300 sm:text-base">
                Quando a tela ficar <span className="font-semibold text-red-400">vermelha</span>,
                aguarde o sinal. Assim que ficar{' '}
                <span className="font-semibold text-emerald-400">verde</span>, clique o mais
                rápido possível. São <span className="font-semibold text-white">5 tentativas</span>{' '}
                por partida.
              </p>

              <button
                type="button"
                onClick={startNewGame}
                className="animate-blue-glow group inline-flex cursor-pointer items-center gap-3 rounded-2xl bg-sky-500 px-10 py-4 text-lg font-bold tracking-wider text-slate-950 transition-all duration-200 hover:scale-[1.02] hover:bg-sky-400 active:scale-[0.98]"
              >
                <Play className="h-5 w-5 fill-slate-950 transition-transform group-hover:translate-x-0.5" />
                COMEÇAR
              </button>

              <p className="mt-5 hidden text-xs text-slate-500 sm:block">
                Dica: no computador você também pode usar a tecla{' '}
                <kbd className="font-mono-tabular rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 text-[11px] text-slate-300">
                  Espaço
                </kbd>
              </p>
            </div>
          )}

          {/* WAITING PHASE (RED SCREEN) */}
          {phase === 'waiting' && (
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 rounded-full border border-white/25 bg-black/20 px-4 py-1 text-xs font-semibold tracking-widest text-white/90 uppercase backdrop-blur-sm">
                Tentativa {currentAttemptNumber} de {TOTAL_ATTEMPTS}
              </div>

              <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
                <span className="animate-pulse-ring absolute inset-0 rounded-full border-2 border-white/50" />
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
                  <Timer className="h-8 w-8 text-white" />
                </span>
              </div>

              <h2 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-sm sm:text-5xl">
                Aguarde o sinal verde...
              </h2>

              <p className="mt-3 text-sm font-medium text-red-100/85 sm:text-base">
                Fique atento — não clique antes da mudança de cor
              </p>
            </div>
          )}

          {/* READY PHASE (GREEN SCREEN — INSTANT) */}
          {phase === 'ready' && (
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 rounded-full border border-emerald-950/30 bg-emerald-950/25 px-4 py-1 text-xs font-bold tracking-widest text-white uppercase">
                Tentativa {currentAttemptNumber} de {TOTAL_ATTEMPTS}
              </div>

              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-white/20">
                <Zap className="h-10 w-10 fill-white text-white" />
              </div>

              <h2 className="text-4xl font-black tracking-tight text-white drop-shadow sm:text-6xl">
                CLIQUE AGORA!
              </h2>

              <p className="mt-3 text-base font-semibold text-emerald-50/95 sm:text-lg">
                Reação liberada — toque ou clique imediatamente!
              </p>
            </div>
          )}

          {/* TOO EARLY PHASE */}
          {phase === 'too-early' && (
            <div className="animate-fade-in-up flex max-w-lg flex-col items-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-500/15 text-amber-300">
                <AlertTriangle className="h-8 w-8" />
              </div>

              <h2 className="mb-3 text-2xl font-bold text-white sm:text-4xl">
                Muito cedo! Você clicou antes da hora
              </h2>

              <p className="mb-7 text-sm text-amber-100/75 sm:text-base">
                Calma, Jesse! A reação ainda não atingiu o ponto verde. Esta tentativa não
                foi contabilizada.
              </p>

              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={startWaitingPhase}
                className="inline-flex cursor-pointer items-center gap-2.5 rounded-xl border border-amber-400/50 bg-amber-500/20 px-7 py-3.5 text-sm font-bold tracking-wider text-amber-100 uppercase transition-all hover:bg-amber-500/30 active:scale-[0.98]"
              >
                <RotateCcw className="h-4 w-4" />
                Tentar novamente ({currentAttemptNumber}/{TOTAL_ATTEMPTS})
              </button>
            </div>
          )}

          {/* SINGLE ATTEMPT RESULT PHASE (Attempts 1–4) */}
          {phase === 'result' && lastReactionMs !== null && (
            <div className="animate-fade-in-up flex max-w-lg flex-col items-center text-center">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full border border-sky-400/35 bg-sky-500/10 px-3.5 py-1 text-xs font-semibold tracking-wider text-sky-300 uppercase">
                  Tentativa {attempts.length} de {TOTAL_ATTEMPTS}
                </span>
                {isNewSingleRecord && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
                    <Trophy className="h-3 w-3" />
                    Novo recorde pessoal!
                  </span>
                )}
              </div>

              <div className="font-mono-tabular my-2 text-6xl font-black tracking-tight text-white sm:text-7xl">
                {lastReactionMs}
                <span className="ml-2 text-2xl font-bold text-sky-400 sm:text-3xl">
                  ms
                </span>
              </div>

              <p className="mb-8 text-sm text-slate-300 sm:text-base">
                {getSingleShotFeedback(lastReactionMs)}
              </p>

              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={startWaitingPhase}
                className="inline-flex cursor-pointer items-center gap-2.5 rounded-xl bg-sky-500 px-8 py-3.5 text-sm font-bold tracking-wider text-slate-950 uppercase transition-all hover:bg-sky-400 active:scale-[0.98]"
              >
                <Play className="h-4 w-4 fill-slate-950" />
                Próxima tentativa ({attempts.length + 1}/{TOTAL_ATTEMPTS})
              </button>

              <p className="mt-4 text-xs text-slate-500">
                Ou clique em qualquer lugar da área acima para continuar
              </p>
            </div>
          )}

          {/* FINAL SUMMARY PHASE (After 5 Attempts) */}
          {phase === 'summary' && rank && (
            <div className="animate-fade-in-up w-full max-w-3xl pt-4">
              {/* Top hero metrics */}
              <div className="mb-4 text-center">
                <div className="mb-1.5 flex flex-wrap items-center justify-center gap-2">
                  <span className="rounded-full border border-sky-400/35 bg-sky-500/10 px-3 py-0.5 text-[11px] font-semibold tracking-widest text-sky-300 uppercase">
                    Relatório Final — 5 Tentativas
                  </span>
                  {(isNewAverageRecord || isNewSingleRecord) && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/50 bg-emerald-500/15 px-3 py-0.5 text-[11px] font-bold text-emerald-300">
                      <Trophy className="h-3 w-3" />
                      {isNewAverageRecord ? 'Novo Recorde de Média!' : 'Novo Melhor Tempo!'}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-[11px] font-medium tracking-widest text-slate-400 uppercase">
                  Média das 5 tentativas
                </p>
                <div className="font-mono-tabular mt-0.5 text-5xl font-black tracking-tight text-white">
                  {stats.average}
                  <span className="ml-2 text-2xl font-bold text-sky-400">
                    ms
                  </span>
                </div>
              </div>

              {/* Rank Classification Card (Breaking Bad) */}
              <div className="mb-4 rounded-2xl border border-sky-500/30 bg-slate-950/75 p-4">
                <div className="flex flex-col items-start gap-3.5 sm:flex-row sm:items-center">
                  <PeriodicBadge
                    symbol={rank.elementSymbol}
                    atomicNumber={rank.atomicNumber}
                    size="md"
                    variant="blue"
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                        Classificação:
                      </span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${rank.accentClass}`}
                      >
                        Pureza {rank.purity}
                      </span>
                    </div>
                    <h3 className="mt-0.5 text-lg font-bold text-white sm:text-xl">
                      {rank.title}{' '}
                      <span className="text-sm font-medium text-sky-400">
                        — {rank.subtitle}
                      </span>
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300 sm:text-sm">
                      “{rank.message}”
                    </p>
                  </div>
                </div>
              </div>

              {/* Key Stats Grid */}
              <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                  <p className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">
                    Melhor Reação da Partida
                  </p>
                  <p className="font-mono-tabular mt-0.5 text-xl font-bold text-emerald-400">
                    {stats.best} ms
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                  <p className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">
                    Média da Partida
                  </p>
                  <p className="font-mono-tabular mt-0.5 text-xl font-bold text-sky-400">
                    {stats.average} ms
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                  <p className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">
                    Melhor Tempo Pessoal
                  </p>
                  <p className="font-mono-tabular mt-0.5 text-xl font-bold text-white">
                    {localRecord.bestSingleMs ?? stats.best} ms
                  </p>
                </div>
              </div>

              {/* Individual Attempts Breakdown */}
              <div className="mb-4 rounded-2xl border border-slate-800/90 bg-slate-950/60 p-4">
                <h4 className="mb-2.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                  Tentativas Individuais
                </h4>
                <div className="space-y-2">
                  {attempts.map((ms, index) => {
                    const isBest = ms === stats.best;
                    const maxBar = Math.max(stats.worst, 1);
                    const widthPct = Math.max(18, Math.round((ms / maxBar) * 100));

                    return (
                      <div
                        key={`attempt-${index + 1}`}
                        className="flex items-center gap-3 text-xs sm:text-sm"
                      >
                        <span className="font-mono-tabular w-24 shrink-0 text-xs font-medium text-slate-400">
                          Tentativa #{index + 1}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800/90">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isBest
                                ? 'bg-gradient-to-r from-emerald-400 to-sky-400'
                                : 'bg-sky-500/75'
                            }`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <div className="flex w-28 shrink-0 items-center justify-end gap-1.5">
                          {isBest && (
                            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                              MELHOR
                            </span>
                          )}
                          <span
                            className={`font-mono-tabular font-bold ${
                              isBest ? 'text-emerald-300' : 'text-slate-100'
                            }`}
                          >
                            {ms} ms
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Optional Global Leaderboard Submission (Neon Postgres — only shown when configured) */}
              {dbConfigured && (
                <div className="mb-4 rounded-2xl border border-sky-500/25 bg-sky-950/20 p-3.5">
                  {scoreSubmitted ? (
                    <div className="flex items-center justify-center gap-2 text-sm font-medium text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>
                        Resultado registrado no Ranking Global do Laboratório!
                      </span>
                    </div>
                  ) : (
                    <form
                      onSubmit={handleScoreSubmit}
                      className="flex flex-col gap-3 sm:flex-row sm:items-center"
                    >
                      <div className="flex-1">
                        <label
                          htmlFor="codename"
                          className="mb-1 block text-xs font-medium text-sky-200/80"
                        >
                          Registrar média de {stats.average} ms no Ranking Global (Neon)
                        </label>
                        <input
                          id="codename"
                          type="text"
                          value={playerName}
                          onChange={(e) => setPlayerName(e.target.value)}
                          placeholder="Seu codinome (ex: Heisenberg)"
                          maxLength={24}
                          className="w-full rounded-xl border border-slate-700 bg-slate-950/90 px-3.5 py-2 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-sky-400"
                        />
                        {submitError && (
                          <p className="mt-1.5 text-xs text-rose-400">{submitError}</p>
                        )}
                      </div>
                      <button
                        type="submit"
                        disabled={submittingScore}
                        className="inline-flex cursor-pointer items-center justify-center gap-2 self-stretch rounded-xl border border-sky-400/50 bg-sky-500/15 px-5 py-2 text-sm font-semibold text-sky-200 transition-all hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-5 sm:self-auto"
                      >
                        {submittingScore ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Salvar no Ranking
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Play Again Button */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={startNewGame}
                  className="animate-blue-glow inline-flex cursor-pointer items-center gap-2.5 rounded-2xl bg-sky-500 px-8 py-3.5 text-sm font-bold tracking-wider text-slate-950 uppercase transition-all hover:scale-[1.02] hover:bg-sky-400 active:scale-[0.98]"
                >
                  <RotateCcw className="h-4 w-4" />
                  Jogar Novamente
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Live 5-Attempt Progress Bar (visible during play) */}
        {phase !== 'summary' && (
          <section
            aria-label="Progresso das tentativas"
            className="grid grid-cols-5 gap-2 sm:gap-3"
          >
            {Array.from({ length: TOTAL_ATTEMPTS }).map((_, idx) => {
              const value = attempts[idx];
              const isCurrent =
                phase !== 'idle' && idx === attempts.length;
              const isDone = typeof value === 'number';

              return (
                <div
                  key={`slot-${idx + 1}`}
                  className={`flex flex-col items-center justify-center rounded-2xl border px-2 py-3 text-center transition-all duration-300 ${
                    isDone
                      ? 'border-sky-500/40 bg-sky-950/35'
                      : isCurrent
                        ? 'border-sky-400/60 bg-slate-900/95 shadow-[0_0_20px_rgba(14,165,233,0.18)]'
                        : 'border-slate-800/80 bg-slate-900/45'
                  }`}
                >
                  <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase sm:text-[11px]">
                    Tentativa {idx + 1}
                  </span>
                  <span
                    className={`font-mono-tabular mt-1 text-sm font-bold sm:text-base ${
                      isDone
                        ? 'text-sky-300'
                        : isCurrent
                          ? 'text-white'
                          : 'text-slate-600'
                    }`}
                  >
                    {isDone ? `${value} ms` : isCurrent ? '•••' : '—'}
                  </span>
                </div>
              );
            })}
          </section>
        )}

        {/* Global Leaderboard Section (Real Neon Postgres data — rendered only when DB is connected) */}
        {!leaderboardLoading && dbConfigured && (
          <section className="rounded-3xl border border-slate-800/90 bg-slate-900/60 p-5 backdrop-blur-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Award className="h-5 w-5 text-sky-400" />
                <h2 className="text-base font-bold tracking-tight text-white sm:text-lg">
                  Ranking Global do Laboratório
                </h2>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                Neon Postgres • Top 10
              </span>
            </div>

            {leaderboard.length === 0 ? (
              <p className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-6 text-center text-sm text-slate-400">
                Nenhum químico registrado ainda. Complete as 5 tentativas e inaugure o
                ranking!
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[460px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                      <th className="py-2.5 pr-3">#</th>
                      <th className="py-2.5 pr-3">Químico</th>
                      <th className="py-2.5 pr-3">Classificação</th>
                      <th className="py-2.5 pr-3 text-right">Média</th>
                      <th className="py-2.5 text-right">Melhor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {leaderboard.map((row, index) => (
                      <tr
                        key={row.id}
                        className="transition-colors hover:bg-slate-800/35"
                      >
                        <td className="font-mono-tabular py-3 pr-3 font-bold text-slate-400">
                          {index === 0 ? (
                            <span className="text-sky-400">#1</span>
                          ) : (
                            `#${index + 1}`
                          )}
                        </td>
                        <td className="py-3 pr-3 font-semibold text-white">
                          {row.playerName}
                        </td>
                        <td className="py-3 pr-3 text-xs text-slate-300">
                          {row.rankTitle}
                        </td>
                        <td className="font-mono-tabular py-3 pr-3 text-right font-bold text-sky-300">
                          {row.averageMs} ms
                        </td>
                        <td className="font-mono-tabular py-3 text-right text-emerald-400">
                          {row.bestMs} ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
