"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface BountyCountdownProps {
  /** ISO date string or timestamp when the bounty expires */
  deadline: string | number | Date;
  /** Optional label above the countdown */
  label?: string;
  /** Optional className for the outer container */
  className?: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function getTimeRemaining(deadline: Date): TimeRemaining {
  const total = deadline.getTime() - Date.now();
  if (total <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }
  return {
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    seconds: Math.floor((total / 1000) % 60),
    total,
  };
}

type Urgency = "expired" | "critical" | "warning" | "safe";

function getUrgency(time: TimeRemaining): Urgency {
  if (time.total <= 0) return "expired";
  if (time.days < 1) return "critical";
  if (time.days < 3) return "warning";
  return "safe";
}

const urgencyStyles: Record<Urgency, { bg: string; text: string; ring: string; pulse: string }> = {
  safe: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    ring: "ring-emerald-500/30",
    pulse: "",
  },
  warning: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    ring: "ring-amber-500/30",
    pulse: "",
  },
  critical: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    ring: "ring-red-500/30",
    pulse: "animate-pulse",
  },
  expired: {
    bg: "bg-gray-500/10",
    text: "text-gray-500",
    ring: "ring-gray-500/30",
    pulse: "",
  },
};

function TimeUnit({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center min-w-[2rem]">
      <motion.span
        key={value}
        initial={{ y: -6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className={`text-lg sm:text-xl md:text-2xl font-bold font-mono tabular-nums ${color}`}
      >
        {String(value).padStart(2, "0")}
      </motion.span>
      <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-500 mt-0.5">
        {label}
      </span>
    </div>
  );
}

export default function BountyCountdown({
  deadline,
  label = "Time Remaining",
  className = "",
}: BountyCountdownProps) {
  const [time, setTime] = useState<TimeRemaining>(() =>
    getTimeRemaining(new Date(deadline))
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const deadlineDate = new Date(deadline);
    const interval = setInterval(() => {
      setTime(getTimeRemaining(deadlineDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  const urgency = getUrgency(time);
  const styles = urgencyStyles[urgency];

  if (!mounted) {
    return (
      <div className={`rounded-lg p-2.5 ring-1 ${styles.ring} ${styles.bg} ${className}`}>
        <p className={`text-[10px] font-medium ${styles.text} mb-1.5`}>{label}</p>
        <div className="flex items-center justify-center gap-2">
          {["Days", "Hrs", "Min", "Sec"].map((l) => (
            <div key={l} className="flex flex-col items-center min-w-[2rem]">
              <span className={`text-lg sm:text-xl md:text-2xl font-bold font-mono ${styles.text}`}>
                --
              </span>
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-500 mt-0.5">
                {l}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={`rounded-lg p-2.5 ring-1 ${styles.ring} ${styles.bg} ${className}`}
    >
      <p className={`text-[10px] font-medium ${styles.text} mb-1.5 ${urgency === "critical" ? styles.pulse : ""}`}>
        {label}
      </p>

      {urgency === "expired" ? (
        <p className={`text-sm font-semibold text-center ${styles.text}`}>Expired</p>
      ) : (
        <div className="flex items-center justify-center gap-2">
          <TimeUnit value={time.days} label="Days" color={styles.text} />
          <span className={`text-base font-light ${styles.text} opacity-30 -mt-3`}>:</span>
          <TimeUnit value={time.hours} label="Hrs" color={styles.text} />
          <span className={`text-base font-light ${styles.text} opacity-30 -mt-3`}>:</span>
          <TimeUnit value={time.minutes} label="Min" color={styles.text} />
          <span className={`text-base font-light ${styles.text} opacity-30 -mt-3`}>:</span>
          <TimeUnit value={time.seconds} label="Sec" color={styles.text} />
        </div>
      )}
    </motion.div>
  );
}
