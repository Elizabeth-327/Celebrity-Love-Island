import { useState } from 'react'
import './App.css'
import Intro from './pages/Intro'
import IntroduceCelebs from './pages/IntroduceCelebs'
import ChooseYourSkin from './pages/ChooseYourSkin'
import ChooseCareer from './pages/ChooseCareer'
import ChooseYourClothes from './pages/ChooseYourClothes'
import Island from './pages/Island'
import BattleDemo from './pages/BattleDemo'

function App() {
  const [page, setPage] = useState('intro')
  const [selectedSkin, setSelectedSkin] = useState(null)
  const [selectedCareer, setSelectedCareer] = useState(null)
  const [battleExitSummary, setBattleExitSummary] = useState(null)

  if (page === 'battle_demo') {
    return (
      <BattleDemo
        onBackToIntro={(summary) => {
          setBattleExitSummary(summary ?? null)
          setPage('intro')
        }}
      />
    )
  }

  if (page === 'introduce_celebs') {
    return <IntroduceCelebs onNext={() => setPage('choose_your_skin')} />
  }

  if (page === 'choose_your_skin') {
    return (
      <ChooseYourSkin
        onNext={(skin) => {
          setSelectedSkin(skin)
          setPage('choose_career')
        }}
      />
    )
  }

  if (page === 'choose_career') {
    return (
      <ChooseCareer
        onNext={(career) => {
          setSelectedCareer(career)
          setPage('choose_your_clothes')
        }}
      />
    )
  }

  if (page === 'choose_your_clothes') {
    return <ChooseYourClothes selectedSkin={selectedSkin} onNext={() => setPage('island')} />
  }

  if (page === 'island') {
    return <Island selectedSkin={selectedSkin} selectedCareer={selectedCareer} />
  }

  return (
    <Intro
      onStart={() => {
        setBattleExitSummary(null)
        setSelectedSkin(null)
        setSelectedCareer(null)
        setPage('introduce_celebs')
      }}
      onSkip={() => {
        setBattleExitSummary(null)
        setSelectedSkin(null)
        setSelectedCareer(null)
        setPage('choose_your_skin')
      }}
      onDemo={() => {
        setBattleExitSummary(null)
        setPage('battle_demo')
      }}
      battleExitSummary={battleExitSummary}
      onDismissBattleExitSummary={() => setBattleExitSummary(null)}
    />
  )
}

export default App
