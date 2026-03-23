/**
 * Tooltip — Reusable accessible tooltip component.
 *
 * No external dependencies. Uses CSS transitions for fade-in.
 * Positions automatically to avoid viewport overflow.
 * Supports hover (desktop) and focus/tap (mobile/keyboard).
 *
 * @module components/common/Tooltip
 */
import {
  useState,
  useRef,
  useCallback,
  useId,
  type ReactNode,
  type CSSProperties,
} from 'react';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  /** The content shown inside the tooltip bubble. */
  content: ReactNode;
  /** The element that triggers the tooltip on hover/focus. */
  children: ReactNode;
  /** Preferred placement — will flip if it would overflow the viewport. Default: 'top'. */
  placement?: TooltipPlacement;
  /** Additional class names applied to the outer wrapper span. */
  className?: string;
  /** Delay before showing in ms. Default: 0. */
  delayMs?: number;
}

/** Pixel gap between the trigger and the tooltip bubble. */
const GAP = 8;

/**
 * Compute `top` / `left` for the tooltip so it stays inside the viewport.
 * Falls back to the opposite side when the preferred side would overflow.
 */
function computePosition(
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  preferred: TooltipPlacement,
): CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const positions: Record<TooltipPlacement, CSSProperties> = {
    top: {
      top: triggerRect.top - tooltipRect.height - GAP + window.scrollY,
      left:
        triggerRect.left +
        triggerRect.width / 2 -
        tooltipRect.width / 2 +
        window.scrollX,
    },
    bottom: {
      top: triggerRect.bottom + GAP + window.scrollY,
      left:
        triggerRect.left +
        triggerRect.width / 2 -
        tooltipRect.width / 2 +
        window.scrollX,
    },
    left: {
      top:
        triggerRect.top +
        triggerRect.height / 2 -
        tooltipRect.height / 2 +
        window.scrollY,
      left: triggerRect.left - tooltipRect.width - GAP + window.scrollX,
    },
    right: {
      top:
        triggerRect.top +
        triggerRect.height / 2 -
        tooltipRect.height / 2 +
        window.scrollY,
      left: triggerRect.right + GAP + window.scrollX,
    },
  };

  // Overflow detection — flip to opposite side if needed
  const opposites: Record<TooltipPlacement, TooltipPlacement> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  };

  let placement = preferred;
  const pos = positions[placement];
  const top = Number(pos.top);
  const left = Number(pos.left);

  if (placement === 'top' && top < window.scrollY) placement = 'bottom';
  else if (
    placement === 'bottom' &&
    top + tooltipRect.height > vh + window.scrollY
  )
    placement = 'top';
  else if (placement === 'left' && left < window.scrollX) placement = 'right';
  else if (
    placement === 'right' &&
    left + tooltipRect.width > vw + window.scrollX
  )
    placement = 'left';

  // If still overflowing after flip, clamp horizontally/vertically
  const final = { ...positions[placement] };
  const finalLeft = Number(final.left);
  const finalTop = Number(final.top);
  if (finalLeft < GAP + window.scrollX) final.left = GAP + window.scrollX;
  if (finalLeft + tooltipRect.width > vw + window.scrollX - GAP)
    final.left = vw + window.scrollX - GAP - tooltipRect.width;
  if (finalTop < GAP + window.scrollY) final.top = GAP + window.scrollY;

  void opposites; // used for type completeness

  return final;
}

/**
 * Reusable tooltip component. Wraps any trigger element and shows a styled
 * bubble on hover (desktop) and focus/tap (mobile + keyboard).
 *
 * @example
 * <Tooltip content="Total $FNDRY tokens earned across all bounties">
 *   <span>Total Earned</span>
 * </Tooltip>
 */
export function Tooltip({
  content,
  children,
  placement = 'top',
  className = '',
  delayMs = 0,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  const show = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisible(true);
      // Position after DOM paint
      requestAnimationFrame(() => {
        if (!wrapperRef.current || !tooltipRef.current) return;
        const triggerRect = wrapperRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        setStyle(computePosition(triggerRect, tooltipRect, placement));
      });
    }, delayMs);
  }, [delayMs, placement]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  return (
    <span
      ref={wrapperRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      // Allow tap to toggle on touch devices
      onTouchStart={(e) => {
        e.stopPropagation();
        visible ? hide() : show();
      }}
    >
      {children}
      <div
        ref={tooltipRef}
        id={id}
        role="tooltip"
        aria-hidden={!visible}
        style={visible ? { ...style, position: 'fixed' } : { position: 'fixed', visibility: 'hidden', pointerEvents: 'none' }}
        className={[
          'z-50 max-w-xs rounded-lg px-3 py-2 text-xs font-medium shadow-lg',
          'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900',
          'border border-white/10 dark:border-gray-200',
          'transition-opacity duration-150',
          visible ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      >
        {content}
      </div>
    </span>
  );
}
