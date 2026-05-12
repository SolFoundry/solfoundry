import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { Bounty, Submission } from '../../types/bounty';
import { formatCompactNumber } from '../../lib/utils';

interface MonthBucket {
  key: string;
  month: string;
  usdc: number;
  fndry: number;
}

interface Props {
  /** Submissions where the contributor was paid out. */
  paidSubmissions: Submission[];
  /** Bounty lookup so we can credit each submission with token + amount. */
  bountiesById: Map<string, Bounty>;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function emptyMonths(count: number): MonthBucket[] {
  const out: MonthBucket[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ key, month: MONTH_LABELS[d.getMonth()], usdc: 0, fndry: 0 });
  }
  return out;
}

export function EarningsHistoryChart({ paidSubmissions, bountiesById }: Props) {
  const [range, setRange] = useState<6 | 12>(12);

  const data = useMemo(() => {
    const months = emptyMonths(range);
    const index = new Map(months.map((m, i) => [m.key, i]));
    for (const sub of paidSubmissions) {
      const bounty = bountiesById.get(sub.bounty_id);
      if (!bounty) continue;
      const earned = sub.earned ?? bounty.reward_amount ?? 0;
      if (!earned) continue;
      const d = new Date(sub.created_at);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const idx = index.get(key);
      if (idx == null) continue;
      if (bounty.reward_token === 'FNDRY') {
        months[idx].fndry += earned;
      } else {
        months[idx].usdc += earned;
      }
    }
    return months;
  }, [paidSubmissions, bountiesById, range]);

  const totalUsdc = data.reduce((s, m) => s + m.usdc, 0);
  const totalFndry = data.reduce((s, m) => s + m.fndry, 0);
  const hasData = totalUsdc + totalFndry > 0;

  return (
    <div className="rounded-xl border border-border bg-forge-900 p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="font-sans text-base font-semibold text-text-primary">Earnings history</h3>
          <p className="text-xs text-text-muted mt-0.5">
            FNDRY payouts and USDC bounties over time
          </p>
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded-md bg-forge-800 text-xs">
          {([6, 12] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 py-1 rounded transition-colors ${
                range === r ? 'bg-forge-700 text-text-primary' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {r}mo
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="h-[200px] flex items-center justify-center text-sm text-text-muted">
          No payouts yet — complete a bounty to start your earnings history.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#1E1E2E" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#5C5C78', fontSize: 12, fontFamily: 'JetBrains Mono' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#5C5C78', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              tickFormatter={(v: number) => formatCompactNumber(v)}
              width={48}
            />
            <Tooltip
              cursor={{ fill: 'rgba(124,58,237,0.06)' }}
              contentStyle={{
                backgroundColor: '#16161F',
                border: '1px solid #1E1E2E',
                borderRadius: 8,
                fontFamily: 'JetBrains Mono',
                fontSize: 12,
              }}
              labelStyle={{ color: '#A0A0B8' }}
              formatter={(value, name) => {
                const v = typeof value === 'number' ? value : Number(value) || 0;
                if (name === 'fndry') return [`${formatCompactNumber(v)} FNDRY`, 'FNDRY'];
                return [`$${v.toLocaleString()}`, 'USDC'];
              }}
            />
            <Legend
              verticalAlign="top"
              height={28}
              iconType="square"
              wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#A0A0B8' }}
              formatter={(v: string) => (v === 'fndry' ? 'FNDRY' : 'USDC')}
            />
            <Bar dataKey="usdc" stackId="earn" fill="#00E676" radius={[0, 0, 0, 0]} opacity={0.9} />
            <Bar dataKey="fndry" stackId="earn" fill="#7C3AED" radius={[4, 4, 0, 0]} opacity={0.9} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
