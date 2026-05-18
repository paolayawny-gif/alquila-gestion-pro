"use client"

import { useCountUp } from "@/hooks/use-count-up"

interface CountUpProps {
  value: number
  duration?: number
  delay?: number
  className?: string
  format?: (n: number) => string
  suffix?: string
}

export function CountUp({ value, duration = 1200, delay = 0, className, format, suffix }: CountUpProps) {
  const count = useCountUp(value, duration, delay)
  const display = format ? format(count) : count.toLocaleString('es-AR')
  return (
    <span className={className}>
      {display}{suffix}
    </span>
  )
}
