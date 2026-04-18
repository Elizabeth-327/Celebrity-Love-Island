import { useState } from 'react'
import IslandBg from '../assets/backgrounds/love_island_bg.jpg'

const CAREERS = [
  'actor',
  'singer',
  'athlete',
  'model',
  'construction worker',
  'fast food worker',
]

function formatCareerLabel(career) {
  return career
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default function ChooseCareer({ onNext }) {
  const [selectedCareer, setSelectedCareer] = useState(CAREERS[0])

  return (
    <div
      className="app"
      style={{
        backgroundImage: `url(${IslandBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="choose-career-screen">
        <h2 className="celebs-heading">Choose Your Career</h2>
        <p className="choose-career-subtitle">
          Your career determines your default battle moves.
        </p>

        <div className="career-options">
          {CAREERS.map((career) => {
            const isSelected = selectedCareer === career
            return (
              <button
                key={career}
                className={`career-option ${isSelected ? 'career-option--selected' : ''}`}
                onClick={() => setSelectedCareer(career)}
              >
                {formatCareerLabel(career)}
              </button>
            )
          })}
        </div>

        <button className="start-game-btn select-btn select-btn--active" onClick={() => onNext(selectedCareer)}>
          Select Career
        </button>
      </div>
    </div>
  )
}
