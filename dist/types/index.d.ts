import type { CSSProperties } from 'react';
export type WidgetSize = 'small' | 'medium' | 'large';
export type WidgetTheme = 'light' | 'dark';
export interface PricePoint {
    timestamp: number;
    value: number;
}
export interface DexScreenerToken {
    address: string;
    name: string;
    symbol: string;
}
export interface DexScreenerPair {
    chainId: string;
    dexId: string;
    url: string;
    pairAddress: string;
    priceUsd: string | null;
    priceNative: string;
    baseToken: DexScreenerToken;
    quoteToken: DexScreenerToken;
    volume?: Record<string, number>;
    priceChange?: Record<string, number>;
    liquidity?: {
        usd?: number;
        base?: number;
        quote?: number;
    };
    fdv?: number | null;
    marketCap?: number | null;
    pairCreatedAt?: number | null;
    info?: {
        imageUrl?: string;
        websites?: Array<{
            url: string;
        }>;
        socials?: Array<{
            platform: string;
            handle: string;
        }>;
    };
}
export interface FNDRYPriceData {
    priceUsd: number;
    priceChange24h: number;
    volume24h: number | null;
    marketCap: number | null;
    fdv: number | null;
    liquidityUsd: number | null;
    pairAddress: string;
    pairUrl: string;
    dexId: string;
    baseSymbol: string;
    quoteSymbol: string;
    updatedAt: number;
    history: PricePoint[];
}
export interface FNDRYPriceHookOptions {
    tokenAddress?: string;
    chainId?: string;
    updateInterval?: number;
    maxHistoryPoints?: number;
}
export interface FNDRYPriceHookResult {
    data: FNDRYPriceData | null;
    error: string | null;
    isLoading: boolean;
    isRefreshing: boolean;
    retry: () => Promise<void>;
}
export interface FNDRYPriceWidgetProps extends FNDRYPriceHookOptions {
    size?: WidgetSize;
    theme?: WidgetTheme;
    className?: string;
    style?: CSSProperties;
    title?: string;
    subtitle?: string;
    symbolLabel?: string;
    showVolume?: boolean;
    showMarketCap?: boolean;
}
//# sourceMappingURL=index.d.ts.map