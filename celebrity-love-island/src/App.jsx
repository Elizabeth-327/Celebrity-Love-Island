import { useState } from 'react'
import './App.css'
import TypingText from './components/TypingText'
import Sparkles from './components/Sparkles'
import IslandBg from './assets/backgrounds/love_island_bg.jpg'

function App() {
  const [line1Done, setLine1Done] = useState(false)
  const [introDone, setIntroDone] = useState(false)

  return (
    <div className="app">
      <div
        className="app-bg"
        style={{
          backgroundImage: `url(${IslandBg})`,
          opacity: introDone ? 1 : 0,
        }}
      />
      {introDone && <Sparkles />}
      <div className="intro-screen">
        <p className="intro-welcome">
          <TypingText text="Welcome to" speed={80} onDone={() => setLine1Done(true)} />
        </p>
        {line1Done && (
          <h1 className="intro-title">
            <TypingText
              text="Celebrity Love Island"
              speed={80}
              onDone={() => setTimeout(() => setIntroDone(true), 400)}
            />
          </h1>
        )}
      </div>
    </div>
  )
}

export default App
