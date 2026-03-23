/**
 * LoadingButton — Reusable button with loading spinner and disabled state.
 *
 * Prevents double-click submissions. Shows a spinner and loading text while
 * an async action is in progress. Works in dark and light themes.
 *
 * @module components/common/LoadingButton
 */
import { type ButtonHTMLAttributes, type ReactNode } from 'react';

export interface LoadingButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** When true the button shows a spinner, disables interaction, and shows loadingText. */
  isLoading?: boolean;
  /** Text shown next to the spinner while loading. Falls back to children + '...' if omitted. */
  loadingText?: string;
  /** Visual variant. Default: 'primary'. */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  /** Icon rendered before children (hidden during loading). */
  icon?: ReactNode;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<NonNullable<LoadingButtonProps['variant']>, string> = {
  primary:
    'bg-solana-purple text-white hover:bg-violet-700 focus-visible:ring-solana-purple',
  secondary:
    'border border-gray-300 bg-gray-100 text-gray-800 hover:bg-gray-200 dark:border-transparent dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20 focus-visible:ring-gray-400',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  ghost:
    'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 focus-visible:ring-gray-400',
};

/** SVG spinner (24×24 viewBox, 1em size). */
function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/**
 * Button with built-in loading state. Use in place of plain `<button>` for
 * any async action (claim bounty, submit PR, connect wallet, etc.).
 *
 * @example
 * <LoadingButton isLoading={claiming} loadingText="Claiming..." onClick={handleClaim}>
 *   Claim Bounty
 * </LoadingButton>
 */
export function LoadingButton({
  isLoading = false,
  loadingText,
  variant = 'primary',
  icon,
  children,
  disabled,
  className = '',
  ...rest
}: LoadingButtonProps) {
  const isDisabled = isLoading || disabled;
  const label = isLoading
    ? (loadingText ?? `${String(children)}…`)
    : children;

  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={isLoading}
      className={[
        'inline-flex items-center justify-center gap-2',
        'px-5 py-2.5 rounded-lg text-sm font-semibold',
        'transition-colors duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'focus-visible:ring-offset-white dark:focus-visible:ring-offset-black',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        VARIANT_CLASSES[variant],
        className,
      ].join(' ')}
      {...rest}
    >
      {isLoading ? (
        <Spinner className="h-4 w-4 shrink-0" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span>{label}</span>
    </button>
  );
}

export { Spinner };
