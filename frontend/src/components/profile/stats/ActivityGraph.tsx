import React, { useMemo } from 'react';

export interface ActivityDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface ActivityGraphProps {
  data: ActivityDay[];
  width?: number;
  height?: number;
  cellSize?: number;
  gap?: number;
}

const LEVEL_COLORS: Record<number, string> = {
  0: '#1a1a2e',
  1: '#1e3a5f',
  2: '#2563eb',
  3: '#3b82f6',
  4: '#60a5fa',
};

export function ActivityGraph({
  data,
  width = 500,
  height = 120,
  cellSize = 12,
  gap = 3,
}: ActivityGraphProps) {
  const weeks = useMemo(() => {
    const result: ActivityDay[][] = [];
    let currentWeek: ActivityDay[] = [];

    for (const day of data) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        result.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      result.push(currentWeek);
    }

    return result;
  }, [data]);

  const totalWidth = weeks.length * (cellSize + gap);
  const totalHeight = 7 * (cellSize + gap);

  return (
    <div className="activity-graph" style={{ overflowX: 'auto' }}>
      <svg
        width={Math.max(totalWidth, width)}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      >
        {weeks.map((week, weekIndex) =>
          week.map((day, dayIndex) => {
            const x = weekIndex * (cellSize + gap);
            const y = dayIndex * (cellSize + gap);

            return (
              <rect
                key={day.date}
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                rx={2}
                fill={LEVEL_COLORS[day.level]}
                className="activity-graph__cell"
              >
                <title>
                  {day.date}: {day.count} contributions
                </title>
              </rect>
            );
          })
        )}
      </svg>
      <div className="activity-graph__legend">
        <span className="activity-graph__legend-label">Less</span>
        <div className="activity-graph__legend-colors">
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className="activity-graph__legend-cell"
              style={{
                backgroundColor: LEVEL_COLORS[level],
                width: cellSize,
                height: cellSize,
                borderRadius: 2,
              }}
            />
          ))}
        </div>
        <span className="activity-graph__legend-label">More</span>
      </div>
    </div>
  );
}
