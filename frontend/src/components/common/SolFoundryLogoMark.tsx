import React from 'react';

const SIZE_CLASSES = {
  sm: 'h-7 w-7 rounded-md',
  md: 'h-8 w-8 rounded-lg',
  lg: 'h-12 w-12 rounded-xl',
  xl: 'h-16 w-16 rounded-2xl',
} as const;

export type SolFoundryLogoMarkSize = keyof typeof SIZE_CLASSES;

export interface SolFoundryLogoMarkProps {
  /** Display size; matches previous gradient box radii for each placement. */
  size?: SolFoundryLogoMarkSize;
  className?: string;
}

/**
 * Official SolFoundry anvil mark (`/logo-icon.svg`). Use beside visible “SolFoundry” text
 * so the image stays decorative (`alt=""`). SVG scales via CSS `SIZE_CLASSES` (no raster
 * `srcset` needed); keep width/height attributes for aspect ratio hints.
 */
export function SolFoundryLogoMark({ size = 'md', className = '' }: SolFoundryLogoMarkProps) {
  return (
    <img
      src="/logo-icon.svg"
      alt=""
      data-testid="solfoundry-logo-mark"
      width={512}
      height={512}
      className={`object-cover shrink-0 ${SIZE_CLASSES[size]} ${className}`.trim()}
      decoding="async"
    />
  );
}
