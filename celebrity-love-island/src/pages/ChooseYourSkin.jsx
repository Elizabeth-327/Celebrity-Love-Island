import { useState } from 'react'
import AdjussiImg from '../assets/characters/players/adjussi_clothed.png'
import AhjummaImg from '../assets/characters/players/ahjumma_clothed.png'
import IslandBg from '../assets/backgrounds/love_island_bg.jpg'

const SKINS = [
  { id: 'adjussi', img: AdjussiImg },
  { id: 'ahjumma', img: AhjummaImg },
]

export default function ChooseYourSkin({ onNext }) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState(false)

  function prev() {
    setSelected(false)
    setIndex((i) => (i - 1 + SKINS.length) % SKINS.length)
  }

  function next() {
    setSelected(false)
    setIndex((i) => (i + 1) % SKINS.length)
  }

  return (
    <div
      className="app"
      style={{ backgroundImage: `url(${IslandBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="choose-skin-screen">
        <h2 className="celebs-heading">Choose Your Skin</h2>

        <div className="skin-selector">
          <button className="skin-arrow" onClick={prev}>&#8592;</button>

          <div
            className={`skin-frame ${selected ? 'skin-frame--selected' : ''}`}
            onClick={() => setSelected(true)}
          >
            <img src={SKINS[index].img} alt={SKINS[index].id} className="skin-img" />
          </div>

          <button className="skin-arrow" onClick={next}>&#8594;</button>
        </div>

        <button
          className={`start-game-btn select-btn ${selected ? 'select-btn--active' : ''}`}
          disabled={!selected}
          onClick={() => onNext(SKINS[index].id)}
        >
          Select
        </button>
      </div>
    </div>
  )
}