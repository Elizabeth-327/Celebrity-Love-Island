import { useState, useEffect } from 'react'
import TypingText from '../components/TypingText'
import AdjussiNakedImg from '../assets/characters/players/adjussi_naked.png'
import AhjummaNakedImg from '../assets/characters/players/ahjumma_naked.png'
import AdjussiClothedImg from '../assets/characters/players/adjussi_clothed.png'
import AhjummaClothedImg from '../assets/characters/players/ahjumma_clothed.png'
import IslandBg from '../assets/backgrounds/love_island_bg.jpg'

const NAKED_IMGS = {
  adjussi: AdjussiNakedImg,
  ahjumma: AhjummaNakedImg,
}

const CLOTHED_IMGS = {
  adjussi: AdjussiClothedImg,
  ahjumma: AhjummaClothedImg,
}

const RAYS = Array.from({ length: 20 }, (_, i) => ({
  angle: i * 18,
  height: 90 + Math.random() * 100,
  delay: (Math.random() * 0.6).toFixed(2),
}))

function Burst() {
  return (
    <div className="burst-wrap">
      <div className="burst-glow" />
      {RAYS.map((ray, i) => (
        <div
          key={i}
          className="burst-ray"
          style={{
            height: `${ray.height}px`,
            transform: `rotate(${ray.angle}deg)`,
            animationDelay: `${ray.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

export default function ChooseYourClothes({ selectedSkin, onNext }) {
  const [phase, setPhase] = useState('clothes') // clothes | naked | dots
  const [dotRound, setDotRound] = useState(0)
  const [dotsVisible, setDotsVisible] = useState(true)
  const skin = selectedSkin ?? 'adjussi'

  useEffect(() => {
    if (phase !== 'naked') return
    const t = setTimeout(() => {
      setPhase('dots')
      setDotRound(0)
      setDotsVisible(true)
    }, 3000)
    return () => clearTimeout(t)
  }, [phase])

  function handleDotsDone() {
    setTimeout(() => setDotsVisible(false), 600)
    setTimeout(() => {
      if (dotRound < 2) {
        setDotRound(r => r + 1)
        setDotsVisible(true)
      } else {
        onNext()
      }
    }, 1400)
  }

  if (phase === 'dots') {
    return (
      <div className="app" style={{ background: 'black' }}>
        <div className="dots-screen">
          <p
            className="dots-text"
            style={{ opacity: dotsVisible ? 1 : 0, transition: 'opacity 0.7s ease' }}
          >
            <TypingText key={dotRound} text="..." speed={200} onDone={handleDotsDone} />
          </p>
        </div>
      </div>
    )
  }

  if (phase === 'naked') {
    return (
      <div
        className="app"
        style={{ backgroundImage: `url(${IslandBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div className="naked-reveal">
          <div className="naked-img-wrap">
            <Burst />
            <img src={NAKED_IMGS[skin]} alt="naked" className="naked-img" />
          </div>
          <p className="naked-text">
            Why are you looking through your closet?? This is love island!! You're supposed to be naked.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="app"
      style={{ backgroundImage: `url(${IslandBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="choose-skin-screen">
        <h2 className="celebs-heading">Choose Your Clothes</h2>
        <div className="skin-selector">
          <button className="skin-arrow" onClick={() => setPhase('naked')}>&#8592;</button>
          <div className="skin-frame">
            <img src={CLOTHED_IMGS[skin]} alt="clothed" className="skin-img" />
          </div>
          <button className="skin-arrow" onClick={() => setPhase('naked')}>&#8594;</button>
        </div>
        <button className="start-game-btn select-btn select-btn--active" onClick={() => setPhase('naked')}>Select</button>
      </div>
    </div>
  )
}