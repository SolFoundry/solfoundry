"use client";

import { useEffect, useState } from "react";

interface CountdownTimerProps {
  deadline: Date | string | number;
  showLabels?: boolean;
  className?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calcTimeLeft(deadline: Date): TimeLeft {
  const total = Math.max(0, deadline.getTime() - Date.now());
  return {
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    seconds: Math.floor((total / 1000) % 60),
    total,
  };
}

function urgencyClass(totalMs: number): string {
  if (totalMs <= 0) return "text-slate-500";
  if (totalMs < 60 * 60 * 1000) return "text-red-500";       // < 1 hour
  if (totalMs < 24 * 60 * 60 * 1000) return "text-amber-500"; // < 24 hours
  return "text-white";
}

function urgencyBg(totalMs: number): string {
  if (totalMs <= 0) return "";
  if (totalMs < 60 * 60 * 1000) return "bg-red-500/20 shine-red";
  if (totalMs < 24 * 60 * 60 * 1000) return "bg-amber-500/20";
  return "";
}

export default function CountdownTimer({ deadline, showLabels = true, className = "" }: CountdownTimerProps) {
  const deadlineDate = new Date(deadline);
  const [timeLeft, setTimeLeft] = useState(() => calcTimeLeft(deadlineDate));

  useEffect(() => {
    // Abort controller for cleanup
    const abort = new AbortController();
    let frame: number;

    const tick = () => {
      const next = calcTimeLeft(deadlineDate);
      setTimeLeft(next);

      if (next.total <= 0) {
        // Deadline passed — stop ticking
        return;
      }

      frame = requestAnimationFrame(() => {
        if (!abort.signal.aborted) {
          // requestAnimationFrame fires ~60fps but we only need second-level granularity
          setTimeout(tick, 1000);
        }
      });
    };

    frame = requestAnimationFrame(tick);
    return () => {
      abort.abort();
      cancelAnimationFrame(frame);
    };
  }, [deadlineDate]);

  if (timeLeft.total <= 0) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className={`text-sm font-semibold ${urgencyClass(0)} px-2 py-1 rounded-full bg-slate-700/50`}>
          Expired
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {timeLeft.days > 0 && (
        <Unit
          value={timeLeft.days}
          label={showLabels ? "d" : ""}
          urgencyClass={urgencyClass(timeLeft.total)}
          urgencyBg={urgencyBg(timeLeft.total)}
        />
      )}
      <Unit
        value={timeLeft.hours}
        label={showLabels ? "h" : ""}
        urgencyClass={urgencyClass(timeLeft.total)}
        urgencyBg={urgencyBg(timeLeft.total)}
      />
      <Unit
        value={timeLeft.minutes}
        label={showLabels ? "m" : ""}
        urgencyClass={urgencyClass(timeLeft.total)}
        urgencyBg={urgencyBg(timeLeft.total)}
      />
      {timeLeft.days === 0 && (
        <Unit
          value={timeLeft.seconds}
          label={showLabels ? "s" : ""}
          urgencyClass={urgencyClass(timeLeft.total)}
          urgencyBg={urgencyBg(timeLeft.total)}
        />
      )}
    </div>
  );
}

function Unit({
  value,
  label,
  urgencyClass,
  urgencyBg,
}: {
  value: number;
  label: string;
  urgencyClass: string;
  urgencyBg: string;
}) {
  const padded = String(value).padStart(2, "0");
  return (
    <span className={`inline-flex items-center gap-0.5 text-sm font-mono font-semibold ${urgencyClass} ${urgencyBg} px-1.5 py-0.5 rounded`}>
      {padded}
      {label && <span className="text-[10px] opacity-70">{label}</span>}
    </span>
  );
}
