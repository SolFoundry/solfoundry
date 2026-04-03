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
 * Official SolFoundry logo mark (metallic cube with cascading binary).
 * Uses the PNG raster version from the X profile.
 */
export function SolFoundryLogoMark({ size = 'md', className = '' }: SolFoundryLogoMarkProps) {
  return (
    <img
      src="/logo-icon.png"
      alt=""
      data-testid="solfoundry-logo-mark"
      width={400}
      height={400}
      className={`object-cover shrink-0 ${SIZE_CLASSES[size]} ${className}`.trim()}
      decoding="async"
    />
  );
}
