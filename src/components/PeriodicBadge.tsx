interface PeriodicBadgeProps {
  symbol: string;
  atomicNumber: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'blue' | 'emerald';
}

export function PeriodicBadge({
  symbol,
  atomicNumber,
  size = 'md',
  variant = 'blue',
}: PeriodicBadgeProps) {
  const sizeClasses = {
    sm: 'h-9 w-9 text-base',
    md: 'h-11 w-11 sm:h-12 sm:w-12 text-xl sm:text-2xl',
    lg: 'h-14 w-14 text-2xl',
  }[size];

  const numberClasses = {
    sm: 'text-[9px] top-0.5 right-1',
    md: 'text-[10px] top-0.5 right-1.5',
    lg: 'text-[11px] top-1 right-1.5',
  }[size];

  const variantClasses =
    variant === 'emerald'
      ? 'border-emerald-400/70 bg-gradient-to-br from-emerald-950/95 via-emerald-900/80 to-slate-950 text-emerald-100 shadow-[0_0_20px_rgba(34,197,94,0.25)]'
      : 'border-sky-400/70 bg-gradient-to-br from-sky-950/95 via-sky-900/75 to-slate-950 text-sky-50 shadow-[0_0_22px_rgba(14,165,233,0.3)]';

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-md border font-bold leading-none tracking-tight ${sizeClasses} ${variantClasses}`}
      aria-hidden="true"
    >
      <span
        className={`font-mono-tabular absolute font-semibold opacity-80 ${numberClasses}`}
      >
        {atomicNumber}
      </span>
      <span className="mt-1">{symbol}</span>
    </span>
  );
}
