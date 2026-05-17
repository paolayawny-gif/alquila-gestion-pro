import { useEffect, useRef, useState } from 'react'

export function useCountUp(target: number, duration = 1200, delay = 0) {
  const [count, setCount] = useState(0)
  const rafRef = useRef<number>()
  const startTimeRef = useRef<number>()

  useEffect(() => {
    setCount(0)
    startTimeRef.current = undefined

    const timeout = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (!startTimeRef.current) startTimeRef.current = timestamp
        const elapsed = timestamp - startTimeRef.current
        const progress = Math.min(elapsed / duration, 1)
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3)
        setCount(Math.round(eased * target))
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate)
        }
      }
      rafRef.current = requestAnimationFrame(animate)
    }, delay)

    return () => {
      clearTimeout(timeout)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration, delay])

  return count
}
