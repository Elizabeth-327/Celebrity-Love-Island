import { useState } from 'react'
import TypingText from '../components/TypingText'
import IslandBg from '../assets/backgrounds/love_island_bg.jpg'
import {
  KimImg,
  KanyeImg,
  ArianaImg,
  DrakeImg,
  JustinImg,
  KendrickImg,
  KylieImg,
  NickiImg,
  SelenaImg
} from '../assets/characters/celebs'

const CELEBS = [
  { name: 'Kim Kardashian', img: KimImg },
  { name: 'Kanye West', img: KanyeImg },
  { name: 'Ariana Grande', img: ArianaImg },
  { name: 'Drake', img: DrakeImg },
  { name: 'Justin Bieber', img: JustinImg },
  { name: 'Kendrick Lamar', img: KendrickImg },
  { name: 'Kylie Jenner', img: KylieImg },
  { name: 'Nicki Minaj', img: NickiImg },
  { name: 'Selena Gomez', img: SelenaImg },
]

export default function IntroduceCelebs({ onNext }) {
  const [opportunityVisible, setOpportunityVisible] = useState(true)
  const [phase, setPhase] = useState('opportunity') // opportunity | heading | celebs | done
  const [celebIndex, setCelebIndex] = useState(0)
  const [celebSlide, setCelebSlide] = useState('offscreen-right')
  const [typeName, setTypeName] = useState(false)

  function handleOpportunityDone() {
    setTimeout(() => setOpportunityVisible(false), 1000)
    setTimeout(() => setPhase('heading'), 1800)
  }

  function handleHeadingDone() {
    setPhase('celebs')
    showCeleb(0)
  }

  function showCeleb(index) {
    setCelebIndex(index)
    setCelebSlide('offscreen-right')
    setTypeName(false)
    setTimeout(() => setCelebSlide('center'), 50)
    setTimeout(() => setTypeName(true), 1600)
    setTimeout(() => setCelebSlide('offscreen-left'), 4500)
    if (index + 1 < CELEBS.length) {
      setTimeout(() => showCeleb(index + 1), 7200)
    } else {
      setTimeout(() => setPhase('done'), 7200)
    }
  }

  const slideStyle = celebSlide === 'offscreen-right'
    ? { transform: 'translateX(110vw)', transition: 'none' }
    : celebSlide === 'center'
    ? { transform: 'translateX(0)', transition: 'transform 1.5s cubic-bezier(0.33, 1, 0.68, 1)' }
    : { transform: 'translateX(-110vw)', transition: 'transform 2.5s cubic-bezier(0.33, 1, 0.68, 1)' }

  return (
    <div
      className="app"
      style={{ backgroundImage: `url(${IslandBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div
        className="introduce-celebs-text"
        style={{ opacity: opportunityVisible ? 1 : 0, transition: 'opacity 0.8s ease' }}
      >
        <p className="celebs-intro-text">
          <TypingText
            text="You have the opportunity to find love among 9 other celebrities ;)"
            speed={70}
            onDone={handleOpportunityDone}
          />
        </p>
      </div>

      {(phase === 'heading' || phase === 'celebs') && (
        <div className="introduce-celebs-text">
          <h2 className="celebs-heading">
            <TypingText text="Introducing the Celebs:" speed={80} onDone={handleHeadingDone} />
          </h2>
          {phase === 'celebs' && (
            <div className="celeb-slide" style={slideStyle}>
              <img src={CELEBS[celebIndex].img} alt={CELEBS[celebIndex].name} className="celeb-img" />
              <p className="celeb-name">
                {typeName && <TypingText text={CELEBS[celebIndex].name} speed={90} />}
              </p>
            </div>
          )}
        </div>
      )}
      {phase === 'done' && (
        <button className="start-game-btn" onClick={onNext}>
          Choose Your Skin
        </button>
      )}
    </div>
  )
}