import { useEffect, useRef, useState } from 'react';
import { Sparklines, SparklinesLine, SparklinesSpots } from 'react-sparklines';
import { useFNDRYPrice } from '../hooks/useFNDRYPrice';
import type { FNDRYPriceWidgetProps } from '../types';
import {
  formatCompactNumber,
  formatCurrency,
  formatPercentage,
  formatRelativeUpdate,
} from '../utils/formatter';
import styles from '../styles/FNDRYPriceWidget.module.css';

const sizeClassMap = {
  small: styles.small,
  medium: styles.medium,
  large: styles.large,
};

const themeClassMap = {
  light: styles.light,
  dark: styles.dark,
};

export function FNDRYPriceWidget({
  size = 'medium',
  theme = 'light',
  className,
  style,
  title = 'FNDRY Price',
  subtitle = 'Live from DexScreener',
  symbolLabel = 'FNDRY',
  showVolume = true,
  showMarketCap = true,
  ...hookOptions
}: FNDRYPriceWidgetProps) {
  const { data, error, isLoading, isRefreshing, retry } = useFNDRYPrice(hookOptions);
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'flat'>('flat');
  const previousPriceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!data) {
      return;
    }

    const previousPrice = previousPriceRef.current;
    if (previousPrice != null) {
      if (data.priceUsd > previousPrice) {
        setPriceDirection('up');
      } else if (data.priceUsd < previousPrice) {
        setPriceDirection('down');
      } else {
        setPriceDirection('flat');
      }
    }

    previousPriceRef.current = data.priceUsd;
    const timeoutId = window.setTimeout(() => setPriceDirection('flat'), 900);
    return () => window.clearTimeout(timeoutId);
  }, [data]);

  const sparklineData =
    !data?.history.length ? [] :
    data.history.length === 1 ? new Array(8).fill(data.history[0].value) :
    data.history.map((point) => point.value);

  const isPositive = (data?.priceChange24h ?? 0) >= 0;
  const rootClassName = [
    styles.widget,
    sizeClassMap[size],
    themeClassMap[theme],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      className={rootClassName}
      style={style}
      data-direction={priceDirection}
      aria-live="polite"
    >
      <header className={styles.header}>
        <div>
          <p className={styles.subtitle}>{subtitle}</p>
          <h2 className={styles.title}>{title}</h2>
        </div>
        <span className={styles.tokenBadge}>{symbolLabel}</span>
      </header>

      {error && !data ? (
        <div className={styles.statePanel} role="status">
          <p className={styles.stateTitle}>Price feed unavailable</p>
          <p className={styles.stateCopy}>{error}</p>
          <button className={styles.retryButton} type="button" onClick={() => void retry()}>
            Retry now
          </button>
        </div>
      ) : null}

      {!error && isLoading && !data ? (
        <div className={styles.statePanel} role="status">
          <p className={styles.stateTitle}>Loading FNDRY</p>
          <p className={styles.stateCopy}>Connecting to DexScreener live pair data.</p>
        </div>
      ) : null}

      {data ? (
        <>
          <div className={styles.priceBlock}>
            <div>
              <p className={styles.priceLabel}>Current price</p>
              <p className={styles.priceValue}>{formatCurrency(data.priceUsd)}</p>
            </div>

            <div
              className={`${styles.changePill} ${isPositive ? styles.positive : styles.negative}`}
            >
              <span className={styles.changeDot} />
              {formatPercentage(data.priceChange24h)}
            </div>
          </div>

          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <span>Session trend</span>
              <span>{data.baseSymbol}/{data.quoteSymbol}</span>
            </div>
            <div className={styles.chartShell}>
              <Sparklines data={sparklineData} width={100} height={36} margin={8}>
                <SparklinesLine
                  color={isPositive ? 'var(--spark-positive)' : 'var(--spark-negative)'}
                  style={{ fill: 'none', strokeWidth: 3 }}
                />
                <SparklinesSpots
                  size={3}
                  spotColor={isPositive ? 'var(--spark-positive)' : 'var(--spark-negative)'}
                />
              </Sparklines>
            </div>
          </div>

          <div className={styles.statsGrid}>
            {showVolume ? (
              <div className={styles.statCard}>
                <span className={styles.statLabel}>24h Volume</span>
                <strong className={styles.statValue}>{formatCompactNumber(data.volume24h)}</strong>
              </div>
            ) : null}

            {showMarketCap ? (
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Market Cap</span>
                <strong className={styles.statValue}>{formatCompactNumber(data.marketCap)}</strong>
              </div>
            ) : null}

            <div className={styles.statCard}>
              <span className={styles.statLabel}>Liquidity</span>
              <strong className={styles.statValue}>{formatCompactNumber(data.liquidityUsd)}</strong>
            </div>

            <div className={styles.statCard}>
              <span className={styles.statLabel}>FDV</span>
              <strong className={styles.statValue}>{formatCompactNumber(data.fdv)}</strong>
            </div>
          </div>

          <footer className={styles.footer}>
            <span>{formatRelativeUpdate(data.updatedAt)}</span>
            <span className={styles.metaActions}>
              {isRefreshing ? 'Refreshing...' : data.dexId}
              <a href={data.pairUrl} target="_blank" rel="noreferrer">
                View pair
              </a>
            </span>
          </footer>

          {error ? (
            <div className={styles.inlineError} role="status">
              <span>{error}</span>
              <button type="button" onClick={() => void retry()}>
                Retry
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
