import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import celebrityQuotes from '../data/celebrity_quotes.json'
import { getGenericMovesByState, getMovesForCareer } from '../game/data/moves'

const MAX_ATTRACTION = 100
const KIM_ID = 'kim_kardashian'
const KIM_NAME = 'Kim Kardashian'
const SLOT_ROWS = 3
const SLOT_COLUMNS = 3
const SLOT_CENTER_ROW_INDEX = 1
const SLOT_SPIN_TICK_MS = 150
const QUOTE_TIMER_SECONDS = 30
const DEFAULT_ICK_DAMAGE = 8
const TIER_ICK_DAMAGE_SCALE = 1

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
    return { ick: null, nextUsedIcks: [], didCycleReset: false }
  }

  let usedIcks = [...currentUsedIcks]
  let availableIcks = ickPool.filter((ick) => !usedIcks.includes(ick.name))
  let didCycleReset = false

  if (availableIcks.length === 0) {
    usedIcks = []
    availableIcks = [...ickPool]
    didCycleReset = true
  }

  const nextIck = availableIcks[Math.floor(Math.random() * availableIcks.length)]
  return {
    ick: nextIck,
    nextUsedIcks: [...usedIcks, nextIck.name],
    didCycleReset,
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

function shuffleArray(values) {
  const shuffled = [...values]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

function createRandomColumnOrders() {
  return Array.from({ length: SLOT_COLUMNS }, () => shuffleArray(SLOT_STATES))
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

function createQuoteChallengeForCelebrity(celebrityId, celebrityName) {
  const correctPool = Array.isArray(celebrityQuotes[celebrityId])
    ? celebrityQuotes[celebrityId]
    : []

  if (correctPool.length === 0) {
    return null
  }

  const correctQuote = correctPool[Math.floor(Math.random() * correctPool.length)]
  const decoyPool = Object.entries(celebrityQuotes).flatMap(([id, quotes]) => {
    if (id === celebrityId || !Array.isArray(quotes)) {
      return []
    }

    return quotes
  })
  const decoys = shuffleArray(decoyPool.filter((quote) => quote !== correctQuote)).slice(0, 2)
  if (decoys.length < 2) {
    return null
  }

  const options = shuffleArray([correctQuote, ...decoys])
  return {
    prompt: `Which quote did ${celebrityName} say?`,
    options,
    correctOptionIndex: options.indexOf(correctQuote),
  }
}

export default function BattleDemo({ onBackToIntro }) {
  const moves = useMemo(() => getMovesForCareer('actor'), [])
  const [selectedMoveId, setSelectedMoveId] = useState(moves[0]?.id ?? '')
  const [playerAttraction, setPlayerAttraction] = useState(MAX_ATTRACTION)
  const [celebAttraction, setCelebAttraction] = useState(0)
  const [celebrityState, setCelebrityState] = useState('neutral')
  const [usedIcks, setUsedIcks] = useState([])
  const [ickCycleCount, setIckCycleCount] = useState(0)
  const [turnCount, setTurnCount] = useState(1)
  const [battleStatus, setBattleStatus] = useState('active')
  const [phase, setPhase] = useState('battle')
  const [ownedMoveIds, setOwnedMoveIds] = useState(() => moves.map((move) => move.id))
  const [moveCooldowns, setMoveCooldowns] = useState(() => createInitialMoveCooldowns(moves))
  const [activeQuoteChallenge, setActiveQuoteChallenge] = useState(null)
  const [quoteTimeLeft, setQuoteTimeLeft] = useState(QUOTE_TIMER_SECONDS)
  const [pendingEnemyTurn, setPendingEnemyTurn] = useState(null)
  const [slotColumnOrders, setSlotColumnOrders] = useState(() => createRandomColumnOrders())
  const [slotColumnSteps, setSlotColumnSteps] = useState(() => createRandomColumnSteps())
  const [slotSpinningColumns, setSlotSpinningColumns] = useState([false, false, false])
  const [slotStatus, setSlotStatus] = useState('idle')
  const [slotOutcome, setSlotOutcome] = useState(null)
  const [rewardPopupMove, setRewardPopupMove] = useState(null)
  const [battleLog, setBattleLog] = useState([
    `${KIM_NAME} entered the battle. Pick your move and press attack.`,
  ])
  const playerAttractionRef = useRef(playerAttraction)
  const usedIcksRef = useRef(usedIcks)
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
    selectedMoveCooldown === 0 &&
    !activeQuoteChallenge

  useEffect(() => {
    playerAttractionRef.current = playerAttraction
  }, [playerAttraction])

  useEffect(() => {
    usedIcksRef.current = usedIcks
  }, [usedIcks])

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
    setActiveQuoteChallenge(null)
    setPendingEnemyTurn(null)
    setQuoteTimeLeft(QUOTE_TIMER_SECONDS)
    setBattleLog((current) => [
      ...current,
      'Slot machine started. Press Space to stop each column from left to right.',
    ])
  }, [])

  const resolveEnemyAttackAfterQuote = useCallback(
    (quoteResult) => {
      if (!pendingEnemyTurn) {
        return
      }

      const { ick, nextUsedIcks, didCycleReset } = pickNextIck(usedIcksRef.current)
      const ickPower = ick?.power ?? DEFAULT_ICK_DAMAGE
      const isRepeatedIck = didCycleReset || ickCycleCount > 0
      const repeatedIckMultiplier = isRepeatedIck ? 2 : 1
      const preQuoteDamage = Math.max(
        1,
        Math.round(ickPower * repeatedIckMultiplier * TIER_ICK_DAMAGE_SCALE),
      )
      const ickDamage =
        quoteResult === 'win' ? Math.max(1, Math.round(preQuoteDamage / 2)) : preQuoteDamage
      const nextPlayerAttraction = clampAttraction(playerAttractionRef.current - ickDamage)
      const didPlayerLose = nextPlayerAttraction <= 0

      const quoteResultMessage =
        quoteResult === 'win'
          ? 'Quote minigame win: incoming ick -attraction was halved.'
          : quoteResult === 'timeout'
            ? 'Quote minigame timeout: full ick -attraction applied.'
            : 'Quote minigame incorrect: full ick -attraction applied.'
      const ickMessage = ick
        ? `${KIM_NAME} used "${ick.name}" (${ickPower} power${isRepeatedIck ? ', repeat x2' : ''}) and applied -${ickDamage} attraction.`
        : `${KIM_NAME} attacked for -${ickDamage} attraction.`
      const defeatMessage = didPlayerLose
        ? 'Your attraction hit zero. Battle lost.'
        : null

      setUsedIcks(nextUsedIcks)
      if (didCycleReset) {
        setIckCycleCount((count) => count + 1)
      }
      setPlayerAttraction(nextPlayerAttraction)
      setBattleStatus(didPlayerLose ? 'lost' : 'active')
      setTurnCount((count) => count + 1)
      setActiveQuoteChallenge(null)
      setPendingEnemyTurn(null)
      setQuoteTimeLeft(QUOTE_TIMER_SECONDS)
      setBattleLog((current) => [
        ...current,
        quoteResultMessage,
        ickMessage,
        ...(defeatMessage ? [defeatMessage] : []),
      ])

      if (didPlayerLose) {
        beginSlotMachine()
      }
    },
    [beginSlotMachine, ickCycleCount, pendingEnemyTurn],
  )

  const handleQuoteChoice = useCallback(
    (optionIndex) => {
      if (!activeQuoteChallenge || !pendingEnemyTurn) {
        return
      }

      const didWin = optionIndex === activeQuoteChallenge.correctOptionIndex && quoteTimeLeft > 0
      resolveEnemyAttackAfterQuote(didWin ? 'win' : 'wrong')
    },
    [activeQuoteChallenge, pendingEnemyTurn, quoteTimeLeft, resolveEnemyAttackAfterQuote],
  )

  useEffect(() => {
    if (!activeQuoteChallenge || !pendingEnemyTurn || battleStatus !== 'active') {
      return undefined
    }

    if (quoteTimeLeft <= 0) {
      resolveEnemyAttackAfterQuote('timeout')
      return undefined
    }

    const timeout = window.setTimeout(() => {
      setQuoteTimeLeft((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearTimeout(timeout)
  }, [
    activeQuoteChallenge,
    battleStatus,
    pendingEnemyTurn,
    quoteTimeLeft,
    resolveEnemyAttackAfterQuote,
  ])

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

    const quoteChallenge = createQuoteChallengeForCelebrity(KIM_ID, KIM_NAME)
    if (!quoteChallenge) {
      setBattleLog((current) => [
        ...current,
        ...logEntries,
        'Quote minigame setup failed. Enemy turn skipped in demo.',
      ])
      return
    }

    setCelebAttraction(nextCelebAttraction)
    setCelebrityState(nextState)
    setMoveCooldowns((current) => {
      const next = decrementMoveCooldowns(current)
      next[selectedMove.id] = selectedMove.cooldown
      return next
    })
    setPendingEnemyTurn({
      turnNumber: turnCount,
      moveId: selectedMove.id,
    })
    setActiveQuoteChallenge(quoteChallenge)
    setQuoteTimeLeft(QUOTE_TIMER_SECONDS)
    setBattleLog((current) => [
      ...current,
      ...logEntries,
      `Quote minigame started. Choose ${KIM_NAME}'s quote within ${QUOTE_TIMER_SECONDS} seconds.`,
    ])
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
            {activeQuoteChallenge ? (
              <div className="move-panels quote-replacement-panels">
                <div className="move-list-panel quote-list-panel">
                  <h3>Quote Choices</h3>
                  <div className="quote-options">
                    {activeQuoteChallenge.options.map((quote, optionIndex) => (
                      <button
                        key={`${quote}-${optionIndex}`}
                        className="quote-option-btn"
                        onClick={() => handleQuoteChoice(optionIndex)}
                      >
                        {quote}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="move-details-panel quote-details-panel">
                  <div className="quote-minigame-header">
                    <h3>Quote Minigame</h3>
                    <span className="quote-timer">{quoteTimeLeft}s</span>
                  </div>
                  <p className="quote-prompt">{activeQuoteChallenge.prompt}</p>
                  <p className="quote-minigame-helper">
                    Correct answer halves the incoming ick -attraction.
                  </p>
                </div>
              </div>
            ) : (
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
                          <div className="move-item-title-row">
                            <span className="move-item-name">{move.name}</span>
                            <span
                              className="move-item-state-chip"
                              title={`Move state: ${formatStateLabel(move.state)}`}
                            >
                              <img
                                src={STATE_ICONS[move.state] ?? neutralSymbol}
                                alt={`${formatStateLabel(move.state)} state`}
                              />
                            </span>
                          </div>
                          <div className="move-item-meta">
                            <small>Power {move.power}</small>
                            <small>CD {moveCooldowns[move.id] ?? 0}</small>
                          </div>
                          <div className="move-item-state-changes">
                            {Object.entries(move.stateChange).map(([state, chance]) => (
                              <span
                                key={`${move.id}-${state}`}
                                className="move-state-change-chip"
                                title={`${formatStateLabel(state)} ${chance}%`}
                              >
                                <img
                                  src={STATE_ICONS[state] ?? neutralSymbol}
                                  alt={`${formatStateLabel(state)} state`}
                                />
                                <small>{chance}%</small>
                              </span>
                            ))}
                          </div>
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
                        <div className="selected-move-state">
                          <span>State:</span>
                          <span className="selected-state-chip">
                            <img
                              src={STATE_ICONS[selectedMove.state] ?? neutralSymbol}
                              alt={`${formatStateLabel(selectedMove.state)} state`}
                            />
                            <span>{formatStateLabel(selectedMove.state)}</span>
                          </span>
                        </div>
                        <p>Cooldown: {selectedMove.cooldown}</p>
                        <p>Cooldown Remaining: {moveCooldowns[selectedMove.id] ?? 0}</p>
                        <div className="state-change-list">
                          <span>State Change:</span>
                          <ul>
                            {Object.entries(selectedMove.stateChange).map(([state, chance]) => (
                              <li key={state} className="state-change-item">
                                <img
                                  src={STATE_ICONS[state] ?? neutralSymbol}
                                  alt={`${formatStateLabel(state)} state`}
                                />
                                <span className="state-change-label">
                                  {formatStateLabel(state)} {chance}%
                                </span>
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
            )}

            {activeQuoteChallenge && (
              <div className="battle-footer">
                <p className="battle-status">Quote minigame in progress</p>
                <p className="battle-status">Choose before timer hits 0</p>
              </div>
            )}
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
