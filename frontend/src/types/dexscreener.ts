/**
 * DexScreener API types for FNDRY token price data.
 *
 * DexScreener provides free, no-auth access to DEX pair data.
 * Endpoint: https://api.dexscreener.com/latest/dex/tokens/{tokenAddress}
 *
 * @module types/dexscreener
 */

export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  pairCreatedAt: number;
}

export interface DexScreenerResponse {
  pairs: DexScreenerPair[] | null;
}

/** Processed price data for the widget. */
export interface TokenPriceData {
  priceUsd: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  fdv: number;
  sparkline: number[]; // recent price points for chart
  lastUpdated: number; // timestamp
}
