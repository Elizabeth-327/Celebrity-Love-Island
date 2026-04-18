import { useState } from 'react'
import TypingText from '../components/TypingText'
import Sparkles from '../components/Sparkles'
import IslandBg from '../assets/backgrounds/love_island_bg.jpg'

function formatIdLabel(value) {
  return String(value ?? '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function Intro({
  onStart,
  onSkip,
  onDemo,
  battleExitSummary,
  onDismissBattleExitSummary,
}) {
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
          <TypingText text="Welcome to" speed={70} onDone={() => setLine1Done(true)} />
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
      {introDone && (
        <button className="start-game-btn" onClick={onStart}>
          Start Game
        </button>
      )}
      {introDone && (
        <button className="demo-battle-btn" onClick={onDemo}>
          Demo Battle
        </button>
      )}
      {introDone && battleExitSummary && (
        <div className="battle-exit-summary">
          <div className="battle-exit-summary-head">
            <h3>Post-Battle Summary</h3>
            <button onClick={onDismissBattleExitSummary}>Close</button>
          </div>
          <p>Outcome: {battleExitSummary.battleWon ? 'Win' : 'Loss'}</p>
          <p>
            {battleExitSummary.targetName} {'->'} Player:{' '}
            {battleExitSummary.targetToPlayerBefore} to {battleExitSummary.targetToPlayerAfter}
          </p>
          <p>
            Side pairings: {battleExitSummary.pairings.length}
            {battleExitSummary.leftOutId
              ? ` | Left out: ${formatIdLabel(battleExitSummary.leftOutId)}`
              : ''}
          </p>
          {Array.isArray(battleExitSummary.logLines) && battleExitSummary.logLines.length > 0 && (
            <ul>
              {battleExitSummary.logLines.map((line, index) => (
                <li key={`${line}-${index}`}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <button className="skip-intro-btn" onClick={onSkip}>
        Skip Intro
      </button>
    </div>
  )
}
