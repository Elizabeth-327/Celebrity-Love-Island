import { useMemo } from 'react'

const COLORS = ['#fff', '#ffe066', '#ff9de2', '#a0f0ff']

function rand(min, max) {
  return Math.random() * (max - min) + min
}

export default function Sparkles({ count = 28 }) {
  const sparkles = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${rand(2, 98)}%`,
      top: `${rand(2, 98)}%`,
      size: rand(6, 16),
      delay: `${rand(0, 3)}s`,
      duration: `${rand(1.8, 3.5)}s`,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }))
  , [])

  return (
    <div className="sparkles-container">
      {sparkles.map(s => (
        <div
          key={s.id}
          className="sparkle"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            background: s.color,
            boxShadow: `0 0 6px 2px ${s.color}`,
            animationDelay: s.delay,
            animationDuration: s.duration,
          }}
        />
      ))}
    </div>
  )
}
