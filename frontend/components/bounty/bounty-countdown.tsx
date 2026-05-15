'use client'

import { useEffect, useState } from 'react'

interface BountyCountdownProps {
  deadline: string | Date  // ISO date string or Date object
  compact?: boolean
}

interface TimeRemaining {
  days: number
  hours: number
  minutes: number
  seconds: number
  expired: boolean
  urgent: boolean  // < 1 hour
  warning: boolean // < 24 hours
}

function getTimeRemaining(deadline: Date): TimeRemaining {
  const now = new Date().getTime()
  const end = deadline.getTime()
  const diff = end - now

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true, urgent: false, warning: false }
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  return {
    days, hours, minutes, seconds,
    expired: false,
    urgent: diff < 1000 * 60 * 60, // < 1 hour
    warning: diff < 1000 * 60 * 60 * 24, // < 24 hours
  }
}

export function BountyCountdown({ deadline, compact = false }: BountyCountdownProps) {
  const [time, setTime] = useState<TimeRemaining>(() => getTimeRemaining(new Date(deadline)))

  useEffect(() => {
    const deadlineDate = new Date(deadline)
    const timer = setInterval(() => {
      setTime(getTimeRemaining(deadlineDate))
    }, 1000)
    return () => clearInterval(timer)
  }, [deadline])

  if (time.expired) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
        ⏰ Expired
      </span>
    )
  }

  const colorClass = time.urgent
    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse'
    : time.warning
      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'

  if (compact) {
    const parts: string[] = []
    if (time.days > 0) parts.push(`${time.days}d`)
    parts.push(`${time.hours}h`, `${time.minutes}m`)
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${colorClass}`}>
        ⏳ {parts.join(' ')}
      </span>
    )
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${colorClass}`}>
      <span>⏳</span>
      {time.days > 0 && <span className="font-bold">{time.days}d</span>}
      <span className="font-bold">{String(time.hours).padStart(2, '0')}</span>
      <span>:</span>
      <span className="font-bold">{String(time.minutes).padStart(2, '0')}</span>
      <span>:</span>
      <span className="font-bold">{String(time.seconds).padStart(2, '0')}</span>
    </div>
  )
}
