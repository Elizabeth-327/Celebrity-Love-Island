import IslandBg from '../assets/backgrounds/love_island_bg.jpg'

function roundTo2(value) {
  return Math.round(value * 100) / 100
}

export default function SeasonResult({ result, onPlayAgain }) {
  if (!result) {
    return null
  }

  return (
    <div
      className="app season-result-screen"
      style={{
        backgroundImage: `url(${IslandBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="season-result-card">
        <h1>{result.playerWon ? 'You Win!' : 'You Lose'}</h1>
        <p>
          Season complete after {result.seasonLength} rounds.
        </p>
        <p>
          Connection sum formula:
          {' '}
          incoming sum - 100e^-x (x = number of incoming edges {'>= 50'})
        </p>

        <h3>Final Ranking</h3>
        <ul>
          {result.ranking.map((entry, index) => (
            <li key={entry.contestantId}>
              {index + 1}. {entry.name} | final {roundTo2(entry.adjustedSum)} | incoming {roundTo2(entry.incomingSum)} | x={entry.strongIncomingCount}
            </li>
          ))}
        </ul>

        <button className="start-game-btn" onClick={onPlayAgain}>
          Play Again
        </button>
      </div>
    </div>
  )
}
