import { useState } from 'react'
import './App.css'
import Intro from './pages/Intro'
import IntroduceCelebs from './pages/IntroduceCelebs'
import ChooseYourSkin from './pages/ChooseYourSkin'

function App() {
  const [page, setPage] = useState('intro')

  if (page === 'introduce_celebs') return <IntroduceCelebs onNext={() => setPage('choose_your_skin')} />
  if (page === 'choose_your_skin') return <ChooseYourSkin />

  return <Intro onStart={() => setPage('introduce_celebs')} />
}

export default App
