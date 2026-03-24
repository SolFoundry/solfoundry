import type { BountyCategory, BountyTier } from '../../types/bounty';

/**
 * GitHub-issue-label–inspired colors (pastel fills + readable text).
 * @see https://github.com/github/linguist/blob/master/lib/linguist/languages.yml (skill hues)
 */
export const CATEGORY_TAG_STYLES: Record<BountyCategory, string> = {
  'smart-contract':
    'bg-[#C5DEF5] text-[#032563] border-[#1D76B0]/35 dark:bg-[#121F33] dark:text-[#79C0FF] dark:border-[#388BFD]/45',
  frontend:
    'bg-[#D4C5F9] text-[#2F1A47] border-[#7057FF]/35 dark:bg-[#211830] dark:text-[#D2A8FF] dark:border-[#A371F7]/40',
  backend:
    'bg-[#C2E0C6] text-[#17421A] border-[#22863A]/35 dark:bg-[#15221A] dark:text-[#7EE787] dark:border-[#238636]/45',
  design:
    'bg-[#F9D0C4] text-[#5C1F0A] border-[#D93F0B]/25 dark:bg-[#2D1A14] dark:text-[#FFA657] dark:border-[#F85149]/35',
  content:
    'bg-[#BFDADC] text-[#042F35] border-[#1B7C83]/30 dark:bg-[#102A2E] dark:text-[#56D4DD] dark:border-[#39C5CF]/40',
  security:
    'bg-[#F9C8C8] text-[#6B1111] border-[#D73A4A]/35 dark:bg-[#2D1414] dark:text-[#FF7B72] dark:border-[#F85149]/45',
  devops:
    'bg-[#FEF2C0] text-[#5C4A00] border-[#D4A72C]/40 dark:bg-[#2D2608] dark:text-[#E3B341] dark:border-[#D29922]/45',
  documentation:
    'bg-[#D4E5FF] text-[#032F62] border-[#0366D6]/30 dark:bg-[#0D1B2A] dark:text-[#58A6FF] dark:border-[#388BFD]/45',
};

/** Tier badges: T1 green, T2 yellow, T3 red (bounty spec). */
export const TIER_TAG_STYLES: Record<BountyTier, string> = {
  T1:
    'bg-[#22863A]/18 text-[#1a7f37] border-[#22863A]/40 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-400/40',
  T2:
    'bg-[#FBDA61]/50 text-[#6d4c0f] border-[#D4A72C]/50 dark:bg-amber-500/18 dark:text-amber-300 dark:border-amber-400/40',
  T3:
    'bg-[#D73A4A]/18 text-[#B31D28] border-[#D73A4A]/45 dark:bg-red-500/20 dark:text-red-300 dark:border-red-400/45',
};

const SKILL_MAP: Record<string, string> = {
  typescript:
    'bg-[#3178c6]/22 text-[#0f4d8f] border-[#3178c6]/35 dark:bg-[#3178c6]/22 dark:text-[#79C0FF] dark:border-[#58A6FF]/40',
  javascript:
    'bg-[#f1e05a]/45 text-[#5c4a00] border-[#C9A61A]/40 dark:bg-[#C9A61A]/22 dark:text-[#E3B341] dark:border-[#D29922]/40',
  python:
    'bg-[#3572A5]/22 text-[#0d3a66] border-[#3572A5]/35 dark:bg-[#3572A5]/25 dark:text-[#79C0FF] dark:border-[#388BFD]/40',
  rust: 'bg-[#dea584]/35 text-[#3d2314] border-[#A67C52]/40 dark:bg-[#8B5A3C]/25 dark:text-[#FFA657] dark:border-[#BD6D3C]/40',
  solidity:
    'bg-[#AA6746]/25 text-[#4a2c1c] border-[#AA6746]/35 dark:bg-[#6B4423]/35 dark:text-[#E2B08A] dark:border-[#A67C52]/40',
  react:
    'bg-[#61DAFB]/28 text-[#0c4a5c] border-[#149ECA]/35 dark:bg-[#149ECA]/18 dark:text-[#79D8F7] dark:border-[#39C5CF]/40',
  anchor:
    'bg-[#B794F4]/25 text-[#3b2a5c] border-[#8957E5]/35 dark:bg-[#3D1F6B]/40 dark:text-[#D2A8FF] dark:border-[#A371F7]/40',
  solana:
    'bg-[#9945FF]/18 text-[#4a1f7a] border-[#9945FF]/35 dark:bg-[#2D1B4E]/50 dark:text-[#C4A3FF] dark:border-[#8957E5]/40',
  'node.js':
    'bg-[#3C873A]/22 text-[#1e451c] border-[#3C873A]/35 dark:bg-[#214521]/40 dark:text-[#7EE787] dark:border-[#238636]/40',
  fastapi:
    'bg-[#009688]/20 text-[#004d40] border-[#009688]/35 dark:bg-[#004D40]/35 dark:text-[#4DB6AC] dark:border-[#26A69A]/40',
  security:
    'bg-[#D73A4A]/15 text-[#8B1111] border-[#D73A4A]/30 dark:bg-red-500/15 dark:text-red-300 dark:border-red-400/35',
  content:
    'bg-[#BFD4F2] text-[#032F62] border-[#0366D6]/25 dark:bg-[#1C2D41] dark:text-[#79C0FF] dark:border-[#388BFD]/35',
  twitter:
    'bg-[#1DA1F2]/18 text-[#0c4d73] border-[#1DA1F2]/35 dark:bg-[#1DA1F2]/15 dark:text-[#79C0FF] dark:border-[#58A6FF]/40',
  community:
    'bg-[#D4D4D8] text-[#24292F] border-[#D0D7DE] dark:bg-gray-600/25 dark:text-gray-200 dark:border-gray-500/40',
};

/** Default “neutral” GitHub-gray label. */
export const DEFAULT_SKILL_TAG_CLASS =
  'bg-[#D4D4D8] text-[#24292F] border-[#D0D7DE] dark:bg-gray-600/30 dark:text-gray-200 dark:border-gray-500/40';

export function skillTagClass(skill: string): string {
  const key = skill.trim().toLowerCase().replace(/\s+/g, '');
  const alias: Record<string, string> = { ts: 'typescript', js: 'javascript' };
  const k = alias[key] ?? key;
  return SKILL_MAP[k] ?? DEFAULT_SKILL_TAG_CLASS;
}

const pillBase =
  'inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-opacity';

export function bountyCategoryPillClass(category: BountyCategory): string {
  return `${pillBase} ${CATEGORY_TAG_STYLES[category]}`;
}

export function bountyTierPillClass(tier: BountyTier): string {
  return `${pillBase} ${TIER_TAG_STYLES[tier]}`;
}

export function bountySkillPillClass(skill: string): string {
  return `${pillBase} ${skillTagClass(skill)}`;
}
