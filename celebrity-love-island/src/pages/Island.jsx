import LoveIsland from '../assets/backgrounds/island_drawn.png'
import AdjussiNakedImg from '../assets/characters/players/adjussi_naked.png'
import AhjummaNakedImg from '../assets/characters/players/ahjumma_naked.png'
import KimImg from '../assets/characters/celebs/kim_kardashian.png'
import KanyeImg from '../assets/characters/celebs/kanye_west.png'
import ArianaImg from '../assets/characters/celebs/ariana_grande.png'
import DrakeImg from '../assets/characters/celebs/drake.png'
import JustinImg from '../assets/characters/celebs/justin_bieber.png'
import KendrickImg from '../assets/characters/celebs/kendrick_lamar.png'
import KylieImg from '../assets/characters/celebs/kylie_jenner.png'
import NickiImg from '../assets/characters/celebs/nicki_minaj.png'
import SelenaImg from '../assets/characters/celebs/selena_gomez.png'

const NAKED_IMGS = { adjussi: AdjussiNakedImg, ahjumma: AhjummaNakedImg }
const CELEB_IMGS = [KimImg, KanyeImg, ArianaImg, DrakeImg, JustinImg, KendrickImg, KylieImg, NickiImg, SelenaImg]

// [left, bottom, height] — tweak these to match where the island land sits in the image
const POSITIONS = [
  // front row (5)
  { left: '8%',  bottom: '14%', size: '17vh' },
  { left: '24%', bottom: '17%', size: '17vh' },
  { left: '43%', bottom: '19%', size: '17vh' },
  { left: '61%', bottom: '17%', size: '17vh' },
  { left: '77%', bottom: '14%', size: '17vh' },
  // middle row (3)
  { left: '20%', bottom: '38%', size: '14vh' },
  { left: '44%', bottom: '41%', size: '14vh' },
  { left: '67%', bottom: '38%', size: '14vh' },
  // top row (2)
  { left: '34%', bottom: '57%', size: '12vh' },
  { left: '55%', bottom: '59%', size: '12vh' },
]

export default function Island({ selectedSkin }) {
  const skin = selectedSkin ?? 'adjussi'
  const allChars = [NAKED_IMGS[skin], ...CELEB_IMGS]

  return (
    <div
      className="app"
      style={{ backgroundImage: `url(${LoveIsland})`, backgroundSize: '100% 100%', backgroundPosition: 'center' }}
    >
      {allChars.map((img, i) => {
        const pos = POSITIONS[i]
        const delay = `${(i * 0.18).toFixed(2)}s`
        return (
          <img
            key={i}
            src={img}
            alt=""
            className="island-character"
            style={{
              left: pos.left,
              bottom: pos.bottom,
              height: pos.size,
              animationDelay: delay,
            }}
          />
        )
      })}
    </div>
  )
}