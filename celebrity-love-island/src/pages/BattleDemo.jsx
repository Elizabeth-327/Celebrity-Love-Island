import { useCallback, useEffect, useMemo, useState } from 'react'
import loveIslandBg from '../assets/backgrounds/love_island_bg.jpg'
import kimSprite from '../assets/characters/celebs/kim_kardashian.png'
import playerSprite from '../assets/characters/players/adjussi_clothed.png'
import angrySymbol from '../assets/states/angry symbol.png'
import embarrassedSymbol from '../assets/states/embaressed symbol.png'
import excitedSymbol from '../assets/states/excited symbol.png'
import lonelySymbol from '../assets/states/lonely symbol.png'
import nervousSymbol from '../assets/states/nervous symbol.png'
import neutralSymbol from '../assets/states/neutral symbol.png'
import sadSymbol from '../assets/states/sad symbol.png'
import celebrityIcks from '../data/icks.json'
import { getGenericMovesByState, getMovesForCareer } from '../game/data/moves'

const MAX_ATTRACTION = 100
const KIM_ID = 'kim_kardashian'
const KIM_NAME = 'Kim Kardashian'
const SLOT_ROWS = 3
const SLOT_COLUMNS = 3
const SLOT_CENTER_ROW_INDEX = 1
const SLOT_SPIN_TICK_MS = 150

const STATE_ICONS = {
  neutral: neutralSymbol,
  sad: sadSymbol,
  annoyed: angrySymbol,
  embarrassed: embarrassedSymbol,
  lonely: lonelySymbol,
  excited: excitedSymbol,
  nervous: nervousSymbol,
}
const SLOT_STATES = Object.keys(STATE_ICONS)

function clampAttraction(value) {
  return Math.max(0, Math.min(MAX_ATTRACTION, value))
}

function pickWeightedState(stateChange, fallbackState) {
  const entries = Object.entries(stateChange ?? {}).filter(([, weight]) => weight > 0)
  if (entries.length === 0) {
    return fallbackState
  }

  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0)
  let randomPoint = Math.random() * totalWeight

  for (const [state, weight] of entries) {
    randomPoint -= weight
    if (randomPoint <= 0) {
      return state
    }
  }

  return entries[entries.length - 1][0]
}

function pickNextIck(currentUsedIcks) {
  const ickPool = celebrityIcks[KIM_ID] ?? []
  if (ickPool.length === 0) {
    return { ick: null, nextUsedIcks: [] }
  }

  let usedIcks = [...currentUsedIcks]
  let availableIcks = ickPool.filter((ick) => !usedIcks.includes(ick.name))

  if (availableIcks.length === 0) {
    usedIcks = []
    availableIcks = [...ickPool]
  }

  const nextIck = availableIcks[Math.floor(Math.random() * availableIcks.length)]
  return {
    ick: nextIck,
    nextUsedIcks: [...usedIcks, nextIck.name],
  }
}

function formatStateLabel(state) {
  return String(state)
    .replace('_', ' ')
    .replace(/^\w/, (char) => char.toUpperCase())
}

function createInitialMoveCooldowns(moves) {
  return moves.reduce((acc, move) => {
    acc[move.id] = 0
    return acc
  }, {})
}

function decrementMoveCooldowns(cooldowns) {
  return Object.fromEntries(
    Object.entries(cooldowns).map(([moveId, remaining]) => [moveId, Math.max(remaining - 1, 0)]),
  )
}

function shuffleStates(states) {
  const shuffled = [...states]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

function createRandomColumnOrders() {
  return Array.from({ length: SLOT_COLUMNS }, () => shuffleStates(SLOT_STATES))
}

function createRandomColumnSteps() {
  return Array.from({ length: SLOT_COLUMNS }, () => Math.floor(Math.random() * SLOT_STATES.length))
}

function buildSlotGridFromColumns(columnOrders, columnSteps) {
  return Array.from({ length: SLOT_ROWS }, (_, rowIndex) =>
    Array.from({ length: SLOT_COLUMNS }, (_, columnIndex) => {
      const columnOrder = columnOrders[columnIndex]
      const baseStep = columnSteps[columnIndex]
      const stateIndex = (baseStep + rowIndex) % columnOrder.length
      return columnOrder[stateIndex]
    }),
  )
}

function advanceColumnSteps(columnSteps, spinningColumns) {
  return columnSteps.map((step, columnIndex) => {
    if (!spinningColumns[columnIndex]) {
      return step
    }

    return (step - 1 + SLOT_STATES.length) % SLOT_STATES.length
  })
}

function resolveSlotOutcome(grid, ownedMoveIds) {
  const [first, second, third] = grid[SLOT_CENTER_ROW_INDEX]
  const matchedState = first === second && second === third ? first : null

  if (!matchedState) {
    return {
      matchedState: null,
      rewardMove: null,
    }
  }

  const candidates = getGenericMovesByState(matchedState).filter(
    (move) => !ownedMoveIds.includes(move.id),
  )
  const rewardMove =
    candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : null

  return {
    matchedState,
    rewardMove,
  }
}

export default function BattleDemo({ onBackToIntro }) {
  const moves = useMemo(() => getMovesForCareer('actor'), [])
  const [selectedMoveId, setSelectedMoveId] = useState(moves[0]?.id ?? '')
  const [playerAttraction, setPlayerAttraction] = useState(MAX_ATTRACTION)
  const [celebAttraction, setCelebAttraction] = useState(0)
  const [celebrityState, setCelebrityState] = useState('neutral')
  const [usedIcks, setUsedIcks] = useState([])
  const [turnCount, setTurnCount] = useState(1)
  const [battleStatus, setBattleStatus] = useState('active')
  const [phase, setPhase] = useState('battle')
  const [ownedMoveIds, setOwnedMoveIds] = useState(() => moves.map((move) => move.id))
  const [moveCooldowns, setMoveCooldowns] = useState(() => createInitialMoveCooldowns(moves))
  const [slotColumnOrders, setSlotColumnOrders] = useState(() => createRandomColumnOrders())
  const [slotColumnSteps, setSlotColumnSteps] = useState(() => createRandomColumnSteps())
  const [slotSpinningColumns, setSlotSpinningColumns] = useState([false, false, false])
  const [slotStatus, setSlotStatus] = useState('idle')
  const [slotOutcome, setSlotOutcome] = useState(null)
  const [rewardPopupMove, setRewardPopupMove] = useState(null)
  const [battleLog, setBattleLog] = useState([
    `${KIM_NAME} entered the battle. Pick your move and press attack.`,
  ])
  const slotGrid = useMemo(
    () => buildSlotGridFromColumns(slotColumnOrders, slotColumnSteps),
    [slotColumnOrders, slotColumnSteps],
  )

  const selectedMove = moves.find((move) => move.id === selectedMoveId) ?? null
  const celebrityStateIcon = STATE_ICONS[celebrityState] ?? neutralSymbol
  const selectedMoveCooldown = selectedMove ? moveCooldowns[selectedMove.id] ?? 0 : 0
  const canAttack =
    phase === 'battle' &&
    battleStatus === 'active' &&
    Boolean(selectedMove) &&
    selectedMoveCooldown === 0

  const beginSlotMachine = useCallback(() => {
    const nextColumnOrders = createRandomColumnOrders()
    const nextColumnSteps = createRandomColumnSteps()
    setPhase('slot')
    setSlotColumnOrders(nextColumnOrders)
    setSlotColumnSteps(nextColumnSteps)
    setSlotSpinningColumns([true, true, true])
    setSlotStatus('spinning')
    setSlotOutcome(null)
    setRewardPopupMove(null)
    setBattleLog((current) => [
      ...current,
      'Slot machine started. Press Space to stop each column from left to right.',
    ])
  }, [])

  useEffect(() => {
    if (phase !== 'slot' || slotStatus !== 'spinning') {
      return undefined
    }

    const spinInterval = window.setInterval(() => {
      setSlotColumnSteps((currentSteps) => advanceColumnSteps(currentSteps, slotSpinningColumns))
    }, SLOT_SPIN_TICK_MS)

    return () => window.clearInterval(spinInterval)
  }, [phase, slotStatus, slotSpinningColumns])

  const stopNextSlotColumn = useCallback(() => {
    if (phase !== 'slot' || slotStatus !== 'spinning') {
      return
    }

    const nextColumnToStop = slotSpinningColumns.findIndex(Boolean)
    if (nextColumnToStop === -1) {
      return
    }

    const nextColumns = [...slotSpinningColumns]
    nextColumns[nextColumnToStop] = false
    const allStopped = nextColumns.every((isSpinning) => !isSpinning)
    setSlotSpinningColumns(nextColumns)

    if (!allStopped) {
      return
    }

    const outcome = resolveSlotOutcome(slotGrid, ownedMoveIds)
    setSlotStatus('resolved')
    setSlotOutcome(outcome)
    if (outcome.rewardMove) {
      setOwnedMoveIds((currentMoveIds) =>
        currentMoveIds.includes(outcome.rewardMove.id)
          ? currentMoveIds
          : [...currentMoveIds, outcome.rewardMove.id],
      )
      setRewardPopupMove(outcome.rewardMove)
      setBattleLog((current) => [
        ...current,
        `Slot center matched ${formatStateLabel(outcome.matchedState)}. Reward: ${outcome.rewardMove.name}.`,
      ])
      return
    }

    if (outcome.matchedState) {
      setBattleLog((current) => [
        ...current,
        `Slot center matched ${formatStateLabel(outcome.matchedState)}, but no new generic move was available.`,
      ])
      return
    }

    setBattleLog((current) => [
      ...current,
      'Slot center did not match. No move reward this time.',
    ])
  }, [ownedMoveIds, phase, slotGrid, slotSpinningColumns, slotStatus])

  useEffect(() => {
    if (phase !== 'slot' || slotStatus !== 'spinning') {
      return undefined
    }

    const onKeyDown = (event) => {
      if (event.code !== 'Space') {
        return
      }

      event.preventDefault()
      stopNextSlotColumn()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, slotStatus, stopNextSlotColumn])

  const handleAttack = () => {
    if (!selectedMove || phase !== 'battle' || battleStatus !== 'active') {
      return
    }

    if ((moveCooldowns[selectedMove.id] ?? 0) > 0) {
      setBattleLog((current) => [
        ...current,
        `${selectedMove.name} is on cooldown for ${moveCooldowns[selectedMove.id]} more turn(s).`,
      ])
      return
    }

    const isStateMatch = selectedMove.state === celebrityState
    const attractionGain = selectedMove.power * (isStateMatch ? 2 : 1)
    const nextCelebAttraction = clampAttraction(celebAttraction + attractionGain)
    const nextState = pickWeightedState(selectedMove.stateChange, celebrityState)

    const logEntries = [
      `Turn ${turnCount}: You used ${selectedMove.name} (+${attractionGain} attraction${isStateMatch ? ', state match x2' : ''}).`,
    ]

    if (nextCelebAttraction >= MAX_ATTRACTION) {
      setCelebAttraction(nextCelebAttraction)
      setCelebrityState(nextState)
      setBattleStatus('won')
      setTurnCount((count) => count + 1)
      setMoveCooldowns((current) => {
        const next = decrementMoveCooldowns(current)
        next[selectedMove.id] = selectedMove.cooldown
        return next
      })
      setBattleLog((current) => [
        ...current,
        ...logEntries,
        `${KIM_NAME} is fully attracted. Battle won.`,
      ])
      beginSlotMachine()
      return
    }

    const { ick, nextUsedIcks } = pickNextIck(usedIcks)
    const ickDamage = ick ? Math.max(4, Math.round(ick.power * 0.35)) : 8
    const nextPlayerAttraction = clampAttraction(playerAttraction - ickDamage)
    const didPlayerLose = nextPlayerAttraction <= 0

    if (ick) {
      logEntries.push(`${KIM_NAME} used "${ick.name}" and dealt ${ickDamage} damage.`)
    } else {
      logEntries.push(`${KIM_NAME} attacked for ${ickDamage} damage.`)
    }

    if (didPlayerLose) {
      logEntries.push('Your attraction hit zero. Battle lost.')
    }

    setCelebAttraction(nextCelebAttraction)
    setCelebrityState(nextState)
    setUsedIcks(nextUsedIcks)
    setPlayerAttraction(nextPlayerAttraction)
    setBattleStatus(didPlayerLose ? 'lost' : 'active')
    setTurnCount((count) => count + 1)
    setMoveCooldowns((current) => {
      const next = decrementMoveCooldowns(current)
      next[selectedMove.id] = selectedMove.cooldown
      return next
    })
    setBattleLog((current) => [...current, ...logEntries])
    if (didPlayerLose) {
      beginSlotMachine()
    }
  }

  return (
    <div className="battle-demo" style={{ backgroundImage: `url(${loveIslandBg})` }}>
      <div className="battle-overlay" />

      <button className="battle-back-btn" onClick={onBackToIntro}>
        Back
      </button>

      <div className="celebrity-hud">
        <div className="celebrity-name-row">
          <h2>{KIM_NAME}</h2>
          <img src={celebrityStateIcon} alt={`${celebrityState} state`} />
          <span>{formatStateLabel(celebrityState)}</span>
        </div>
        <div className="meter-track">
          <div
            className="meter-fill"
            style={{ width: `${(celebAttraction / MAX_ATTRACTION) * 100}%` }}
          />
        </div>
        <p className="meter-value">{celebAttraction} / 100</p>
      </div>

      <img className="celebrity-sprite" src={kimSprite} alt="Kim Kardashian sprite" />
      <img className="player-sprite" src={playerSprite} alt="Player sprite" />

      <div className="battle-controls">
        <div className="player-meter-row">
          <div className="player-meter-info">
            <span>Player Attraction</span>
            <span>{playerAttraction} / 100</span>
          </div>
          <div className="meter-track">
            <div
              className="meter-fill"
              style={{ width: `${(playerAttraction / MAX_ATTRACTION) * 100}%` }}
            />
          </div>
        </div>

        {phase === 'battle' ? (
          <>
            <div className="move-panels">
              <div className="move-list-panel">
                <h3>Moves</h3>
                <div className="move-list">
                  {moves.map((move) => (
                    <button
                      key={move.id}
                      className={`move-item ${selectedMoveId === move.id ? 'selected' : ''} ${(moveCooldowns[move.id] ?? 0) > 0 ? 'on-cooldown' : ''}`}
                      onClick={() => setSelectedMoveId(move.id)}
                    >
                      <span>{move.name}</span>
                      <small>
                        Power {move.power} | State {formatStateLabel(move.state)} | CD {moveCooldowns[move.id] ?? 0}
                      </small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="move-details-panel">
                <h3>Selected Move</h3>
                {selectedMove ? (
                  <>
                    <p className="move-title">{selectedMove.name}</p>
                    <p>{selectedMove.description}</p>
                    <p>Power: {selectedMove.power}</p>
                    <p>State: {formatStateLabel(selectedMove.state)}</p>
                    <p>Cooldown: {selectedMove.cooldown}</p>
                    <p>Cooldown Remaining: {moveCooldowns[selectedMove.id] ?? 0}</p>
                    <div className="state-change-list">
                      <span>State Change:</span>
                      <ul>
                        {Object.entries(selectedMove.stateChange).map(([state, chance]) => (
                          <li key={state}>
                            {formatStateLabel(state)} {chance}%
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <p>No move selected.</p>
                )}
              </div>
            </div>

            <div className="battle-footer">
              <button className="attack-btn" onClick={handleAttack} disabled={!selectedMove || !canAttack}>
                Attack
              </button>
              <p className="battle-status">
                {battleStatus === 'active' && 'Battle in progress'}
                {battleStatus === 'won' && 'You won this battle'}
                {battleStatus === 'lost' && 'You lost this battle'}
              </p>
            </div>
          </>
        ) : (
          <div className="slot-machine-panel">
            {rewardPopupMove && (
              <button
                className="slot-reward-popup"
                onClick={() => setRewardPopupMove(null)}
              >
                <p className="slot-reward-title">New Move Unlocked</p>
                <p className="slot-reward-name">{rewardPopupMove.name}</p>
                <p>{rewardPopupMove.description}</p>
                <p>
                  Power {rewardPopupMove.power} | State{' '}
                  {formatStateLabel(rewardPopupMove.state)} | Cooldown {rewardPopupMove.cooldown}
                </p>
                <p className="slot-reward-dismiss">Click anywhere on this box to close</p>
              </button>
            )}
            <h3>Slot Machine Minigame</h3>
            <p className="slot-machine-instructions">
              Press <strong>Space</strong> to stop the leftmost spinning column.
            </p>
            <div className="slot-machine-grid">
              {slotGrid.map((row, rowIndex) =>
                row.map((state, columnIndex) => (
                  <div
                    key={`${rowIndex}-${columnIndex}`}
                    className={`slot-tile ${slotSpinningColumns[columnIndex] ? 'spinning' : 'stopped'} ${rowIndex === SLOT_CENTER_ROW_INDEX ? 'center-row' : ''}`}
                  >
                    <img src={STATE_ICONS[state]} alt={state} />
                    <span>{formatStateLabel(state)}</span>
                  </div>
                )),
              )}
            </div>

            <div className="slot-machine-footer">
              <button
                className="attack-btn"
                onClick={stopNextSlotColumn}
                disabled={slotStatus !== 'spinning'}
              >
                Stop Next Column
              </button>
              <p className="battle-status">
                {slotStatus === 'spinning' && 'Slot machine spinning'}
                {slotStatus === 'resolved' && slotOutcome?.matchedState && !slotOutcome.rewardMove && 'Center matched, but no new move available'}
                {slotStatus === 'resolved' && slotOutcome?.matchedState && slotOutcome.rewardMove && `Reward unlocked: ${slotOutcome.rewardMove.name}`}
                {slotStatus === 'resolved' && !slotOutcome?.matchedState && 'No center match this spin'}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="battle-log">
        <h3>Battle Log</h3>
        <ul>
          {battleLog.slice(-5).map((line, index) => (
            <li key={`${line}-${index}`}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
