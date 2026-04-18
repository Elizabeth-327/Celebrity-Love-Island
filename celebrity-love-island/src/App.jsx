import { useState } from 'react'
import './App.css'
import Intro from './pages/Intro'
import IntroduceCelebs from './pages/IntroduceCelebs'

function App() {
  const [page, setPage] = useState('intro')

  if (page === 'introduce_celebs') return <IntroduceCelebs />

  return <Intro onStart={() => setPage('introduce_celebs')} />
}

export default App
