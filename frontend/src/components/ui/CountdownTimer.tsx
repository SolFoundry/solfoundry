import { useState, useEffect } from "react";
import { Clock, AlertTriangle, AlertCircle } from "lucide-react";

interface CountdownTimerProps {
  deadline: string; // ISO date string
  compact?: boolean; // compact mode for cards
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  expired: boolean;
}

function calcTimeRemaining(deadline: string): TimeRemaining {
  const totalMs = new Date(deadline).getTime() - Date.now();
  if (totalMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, expired: true };
  }
  return {
    days: Math.floor(totalMs / (1000 * 60 * 60 * 24)),
    hours: Math.floor((totalMs / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((totalMs / (1000 * 60)) % 60),
    seconds: Math.floor((totalMs / 1000) % 60),
    totalMs,
    expired: false,
  };
}

type Urgency = "normal" | "warning" | "urgent" | "expired";

function getUrgency(totalMs: number, expired: boolean): Urgency {
  if (expired) return "expired";
  if (totalMs < 60 * 60 * 1000) return "urgent"; // < 1 hour
  if (totalMs < 24 * 60 * 60 * 1000) return "warning"; // < 24 hours
  return "normal";
}

const URGENCY_STYLES: Record<Urgency, { text: string; icon: string; bg: string }> = {
  normal: { text: "text-text-secondary", icon: "text-emerald", bg: "" },
  warning: { text: "text-amber-400", icon: "text-amber-400", bg: "bg-amber-400/10" },
  urgent: { text: "text-red-400", icon: "text-red-400", bg: "bg-red-400/10 animate-pulse" },
  expired: { text: "text-text-muted line-through", icon: "text-text-muted", bg: "" },
};

export function CountdownTimer({ deadline, compact = false }: CountdownTimerProps) {
  const [time, setTime] = useState(() => calcTimeRemaining(deadline));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(calcTimeRemaining(deadline));
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  const urgency = getUrgency(time.totalMs, time.expired);
  const style = URGENCY_STYLES[urgency];

  if (time.expired) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs ${style.text}`}>
        <AlertCircle className="w-3.5 h-3.5" />
        Expired
      </span>
    );
  }

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs ${style.text} ${style.bg} rounded-full px-2 py-0.5`}>
        {urgency === "urgent" ? (
          <AlertTriangle className={`w-3 h-3 ${style.icon}`} />
        ) : (
          <Clock className={`w-3 h-3 ${style.icon}`} />
        )}
        {time.days > 0 && <span>{time.days}d </span>}
        <span>
          {String(time.hours).padStart(2, "0")}:
          {String(time.minutes).padStart(2, "0")}:
          {String(time.seconds).padStart(2, "0")}
        </span>
      </span>
    );
  }

  // Full display for detail pages
  return (
    <div className={`inline-flex items-center gap-2 text-sm ${style.text} ${style.bg} rounded-lg px-3 py-1.5`}>
      {urgency === "urgent" ? (
        <AlertTriangle className={`w-4 h-4 ${style.icon}`} />
      ) : urgency === "warning" ? (
        <AlertTriangle className={`w-4 h-4 ${style.icon}`} />
      ) : (
        <Clock className={`w-4 h-4 ${style.icon}`} />
      )}
      {time.days > 0 && (
        <span>
          <b>{time.days}</b>d{" "}
        </span>
      )}
      <span>
        <b>{String(time.hours).padStart(2, "0")}</b>h{" "}
        <b>{String(time.minutes).padStart(2, "0")}</b>m{" "}
        <b>{String(time.seconds).padStart(2, "0")}</b>s
      </span>
      {urgency === "urgent" && <span className="text-xs font-semibold">ENDING SOON</span>}
    </div>
  );
}
