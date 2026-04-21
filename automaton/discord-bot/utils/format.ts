export function resolveTierColor(tier?: number): number {
  switch (tier) {
    case 1: return 0x00E676;
    case 2: return 0x40C4FF;
    case 3: return 0x7C3AED;
    default: return 0x00E676;
  }
}

export function formatReward(amount: number | undefined, currency: string = '$FNDRY'): string {
  if (amount == null) return 'N/A';
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M ${currency}`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K ${currency}`;
  return `${amount} ${currency}`;
}

export function truncate(text: string, max: number = 300): string {
  return text.length <= max ? text : text.slice(0, max - 3) + '...';
}
