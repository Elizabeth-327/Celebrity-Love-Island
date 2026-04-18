import { useState, useEffect, useRef } from 'react'

export default function TypingText({ text, speed = 60, className = '', onDone }) {
  const [displayed, setDisplayed] = useState('')
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    setDisplayed('')
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(interval)
        onDoneRef.current?.()
      }
    }, speed)
    return () => clearInterval(interval)
  }, [text, speed])

  return <span className={className}>{displayed}</span>
}
