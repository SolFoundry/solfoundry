/**
 * Formats token prices as USD while preserving extra precision for sub-cent values.
 */
export declare function formatCurrency(value: number | null | undefined, maximumFractionDigits?: number): string;
/**
 * Formats large market values with compact notation for dashboard display.
 */
export declare function formatCompactNumber(value: number | null | undefined): string;
/**
 * Formats a percentage change with an explicit positive sign.
 */
export declare function formatPercentage(value: number | null | undefined): string;
/**
 * Describes how recently the live price data was refreshed.
 */
export declare function formatRelativeUpdate(timestamp: number | null | undefined): string;
//# sourceMappingURL=formatter.d.ts.map