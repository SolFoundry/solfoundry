declare module 'react-sparklines' {
  import type { CSSProperties, ComponentType, ReactNode } from 'react';

  export interface SparklinesProps {
    data: number[];
    width?: number;
    height?: number;
    margin?: number;
    limit?: number;
    min?: number;
    max?: number;
    svgWidth?: number;
    svgHeight?: number;
    style?: CSSProperties;
    children?: ReactNode;
  }

  export interface SparklinesLineProps {
    color?: string;
    style?: CSSProperties;
    onMouseMove?: (event: MouseEvent) => void;
  }

  export interface SparklinesSpotsProps {
    size?: number;
    spotColors?: Record<number, string>;
    spotColor?: string;
  }

  export const Sparklines: ComponentType<SparklinesProps>;
  export const SparklinesLine: ComponentType<SparklinesLineProps>;
  export const SparklinesSpots: ComponentType<SparklinesSpotsProps>;
}
