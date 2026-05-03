const FNDRY_TOKEN_ADDRESS = 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS';
const DEXSCREENER_TOKEN_URL = `https://api.dexscreener.com/latest/dex/tokens/${FNDRY_TOKEN_ADDRESS}`;

interface DexScreenerPair {
  priceUsd?: string;
  priceNative?: string;
  priceChange?: {
    h1?: number;
    h6?: number;
    h24?: number;
  };
  volume?: {
    h24?: number;
  };
  liquidity?: {
    usd?: number;
  };
  pairAddress?: string;
  url?: string;
  dexId?: string;
  chainId?: string;
}

interface DexScreenerTokenResponse {
  pairs?: DexScreenerPair[] | null;
}

export interface FndryPriceSnapshot {
  priceUsd: number;
  priceNative?: number;
  change1h: number;
  change6h: number;
  change24h: number;
  volume24h?: number;
  liquidityUsd?: number;
  pairUrl?: string;
  updatedAt: string;
  sparkline: number[];
}

function toNumber(value: string | number | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function buildSparkline(priceUsd: number, change1h: number, change6h: number, change24h: number): number[] {
  const checkpoints = [change24h, change6h, change1h, 0];
  return checkpoints.map((changeFromNow) => priceUsd / (1 + changeFromNow / 100)).filter(Number.isFinite);
}

function pickBestPair(pairs: DexScreenerPair[]): DexScreenerPair | undefined {
  return [...pairs]
    .filter((pair) => pair.chainId === 'solana' || pair.chainId === undefined)
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
}

export async function fetchFndryPrice(): Promise<FndryPriceSnapshot> {
  const response = await fetch(DEXSCREENER_TOKEN_URL);
  if (!response.ok) throw new Error('DexScreener price request failed');

  const data = (await response.json()) as DexScreenerTokenResponse;
  const pair = pickBestPair(data.pairs ?? []);
  const priceUsd = toNumber(pair?.priceUsd);
  if (!pair || priceUsd === undefined) throw new Error('FNDRY price pair unavailable');

  const change1h = pair.priceChange?.h1 ?? 0;
  const change6h = pair.priceChange?.h6 ?? 0;
  const change24h = pair.priceChange?.h24 ?? 0;

  return {
    priceUsd,
    priceNative: toNumber(pair.priceNative),
    change1h,
    change6h,
    change24h,
    volume24h: pair.volume?.h24,
    liquidityUsd: pair.liquidity?.usd,
    pairUrl: pair.url,
    updatedAt: new Date().toISOString(),
    sparkline: buildSparkline(priceUsd, change1h, change6h, change24h),
  };
}
