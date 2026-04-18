import LoveIsland from '../assets/backgrounds/island_drawn.png'

export default function Island() {
    return (
        <div
            className="app"
            style={{ backgroundImage: `url(${LoveIsland})`, backgroundSize: '100% 100%', backgroundPosition: 'center' }}
        >

        </div>
    )
}