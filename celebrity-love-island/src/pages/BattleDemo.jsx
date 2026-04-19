import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TypingText from '../components/TypingText'
import loveIslandBg from '../assets/backgrounds/love_island_bg.jpg'
import AdjussiNakedImg from '../assets/characters/players/adjussi_naked.png'
import AhjummaNakedImg from '../assets/characters/players/ahjumma_naked.png'
import {
  KimImg,
  KanyeImg,
  ArianaImg,
  DrakeImg,
  JustinImg,
  KendrickImg,
  KylieImg,
  NickiImg,
  SelenaImg,
  ErikaImg,
  RihannaImg,
  BeyonceImg,
  JayZImg,
} from '../assets/characters/chibi_celebs'
import angrySymbol from '../assets/states/angry symbol.png'
import embarrassedSymbol from '../assets/states/embaressed symbol.png'
import excitedSymbol from '../assets/states/excited symbol.png'
import lonelySymbol from '../assets/states/lonely symbol.png'
import nervousSymbol from '../assets/states/nervous symbol.png'
import neutralSymbol from '../assets/states/neutral symbol.png'
import sadSymbol from '../assets/states/sad symbol.png'
import celebrityIcks from '../data/icks.json'
import celebrityQuotes from '../data/celebrity_quotes.json'
import {
  PLAYER_ID,
  createInitialContestants,
  getRelationshipEdgeValue,
} from '../game/data/contestants'
import { getGenericMovesByState, getMoveById, getMovesForCareer } from '../game/data/moves'

const PLAYER_MAX_ATTRACTION = 100
const DEFAULT_BATTLE_CELEBRITY_ID = 'kim_kardashian'
const SLOT_ROWS = 3
const SLOT_COLUMNS = 3
const SLOT_CENTER_ROW_INDEX = 1
const SLOT_SPIN_TICK_MS = 150
const QUOTE_TIMER_SECONDS = 30
const DEFAULT_ICK_DAMAGE = 8
const CONNECTION_MIN = -100
const CONNECTION_MAX = 100
const HEART_BURST_DURATION_MS = 900
const HEART_BREAK_DURATION_MS = 850
const HEART_BURST_TRIGGER_DELAY_MS = 220
const HEART_BREAK_TRIGGER_DELAY_MS = 220
const ACTION_TEXT_TYPING_SPEED_MS = 14
const ACTION_TEXT_LINGER_MS = 2200
const BATTLE_TIER_CONFIG = {
  1: {
    opponentMaxAttraction: 100,
    ickDamageScale: 1,
    connectionDelta: 50,
  },
  2: {
    opponentMaxAttraction: 200,
    ickDamageScale: 1.5,
    connectionDelta: 75,
  },
  3: {
    opponentMaxAttraction: 300,
    ickDamageScale: 2,
    connectionDelta: 100,
  },
}
const BATTLE_DIFFICULTY_LABELS = {
  1: 'Easy',
  2: 'Medium',
  3: 'Hard',
}
const PLAYER_SPRITES = {
  adjussi: AdjussiNakedImg,
  ahjumma: AhjummaNakedImg,
}

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
const BATTLE_CELEBRITY_CONFIG = {
  kim_kardashian: { name: 'Kim Kardashian', sprite: KimImg },
  kanye_west: { name: 'Kanye West', sprite: KanyeImg },
  ariana_grande: { name: 'Ariana Grande', sprite: ArianaImg },
  drake: { name: 'Drake', sprite: DrakeImg },
  justin_bieber: { name: 'Justin Bieber', sprite: JustinImg },
  kendrick_lamar: { name: 'Kendrick Lamar', sprite: KendrickImg },
  kylie_jenner: { name: 'Kylie Jenner', sprite: KylieImg },
  nicki_minaj: { name: 'Nicki Minaj', sprite: NickiImg },
  selena_gomez: { name: 'Selena Gomez', sprite: SelenaImg },
  erika_kirk: { name: 'Erika Kirk', sprite: ErikaImg },
  rihanna: { name: 'Rihanna', sprite: RihannaImg },
  beyonce: { name: 'Beyonce', sprite: BeyonceImg },
  jay_z: { name: 'Jay-Z', sprite: JayZImg },
}

function normalizeBattleTier(value) {
  const numericTier = Number(value)
  return numericTier === 1 || numericTier === 2 || numericTier === 3 ? numericTier : 1
}

function getBattleDifficultyLabel(tier) {
  return BATTLE_DIFFICULTY_LABELS[tier] ?? BATTLE_DIFFICULTY_LABELS[1]
}

function clampAttraction(value, maxAttraction = PLAYER_MAX_ATTRACTION) {
  return Math.max(0, Math.min(maxAttraction, value))
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

function pickNextIck(currentUsedIcks, celebrityId) {
  const ickPool = celebrityIcks[celebrityId] ?? []
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

function clampConnection(value) {
  return Math.max(CONNECTION_MIN, Math.min(CONNECTION_MAX, Math.round(value)))
}

function createInitialDemoGraphState() {
  const contestants = createInitialContestants()
  const activeContestantIds = Object.keys(contestants)
  const graph = {}

  activeContestantIds.forEach((fromId) => {
    graph[fromId] = {}
    activeContestantIds.forEach((toId) => {
      if (fromId === toId) {
        return
      }

      if (fromId === PLAYER_ID) {
        return
      }

      graph[fromId][toId] =
        toId === PLAYER_ID
          ? 0
          : getRelationshipEdgeValue(fromId, toId)
    })
  })

  return {
    contestants,
    activeContestantIds,
    graph,
  }
}

function deepCloneGraph(graph) {
  return Object.fromEntries(
    Object.entries(graph).map(([fromId, outgoing]) => [fromId, { ...outgoing }]),
  )
}

function createEdgeDeltaMap() {
  return {}
}

function addEdgeDelta(deltaMap, fromId, toId, delta) {
  if (!delta) {
    return
  }

  deltaMap[fromId] = deltaMap[fromId] ?? {}
  deltaMap[fromId][toId] = (deltaMap[fromId][toId] ?? 0) + delta
}

function forEachEdgeDelta(deltaMap, callback) {
  Object.entries(deltaMap).forEach(([fromId, outgoing]) => {
    Object.entries(outgoing).forEach(([toId, delta]) => {
      if (delta !== 0) {
        callback(fromId, toId, delta)
      }
    })
  })
}

function mergeEdgeDeltaMaps(...maps) {
  const merged = createEdgeDeltaMap()
  maps.forEach((deltaMap) => {
    if (!deltaMap) {
      return
    }

    forEachEdgeDelta(deltaMap, (fromId, toId, delta) => {
      addEdgeDelta(merged, fromId, toId, delta)
    })
  })
  return merged
}

function applyEdgeDeltaMap(graph, deltaMap) {
  const nextGraph = deepCloneGraph(graph)
  forEachEdgeDelta(deltaMap, (fromId, toId, delta) => {
    nextGraph[fromId] = nextGraph[fromId] ?? {}
    const current = nextGraph[fromId][toId] ?? 0
    nextGraph[fromId][toId] = clampConnection(current + delta)
  })
  return nextGraph
}

function getRippleStrengthScale(connectionScore) {
  const absoluteScore = Math.abs(connectionScore)
  if (absoluteScore <= 0) {
    return 0
  }
  if (absoluteScore <= 25) {
    return 0.25
  }
  if (absoluteScore <= 50) {
    return 0.5
  }
  if (absoluteScore <= 75) {
    return 0.75
  }
  return 1
}

function randomConnectionDelta() {
  return Math.floor(Math.random() * 41) - 20
}

function buildPlayerBattlePrimaryDeltas(targetId, delta) {
  const primaryDeltas = createEdgeDeltaMap()
  addEdgeDelta(primaryDeltas, targetId, PLAYER_ID, delta)
  return primaryDeltas
}

function buildCelebritySideBattlePrimaryDeltas(activeContestantIds, excludedCelebrityId = null) {
  const celebrityIds = activeContestantIds.filter(
    (id) => id !== PLAYER_ID && id !== excludedCelebrityId,
  )
  const primaryDeltas = createEdgeDeltaMap()
  const pairings = []

  for (let index = 0; index + 1 < celebrityIds.length; index += 2) {
    const celebA = celebrityIds[index]
    const celebB = celebrityIds[index + 1]
    const deltaAB = randomConnectionDelta()
    const deltaBA = randomConnectionDelta()

    addEdgeDelta(primaryDeltas, celebA, celebB, deltaAB)
    addEdgeDelta(primaryDeltas, celebB, celebA, deltaBA)
    pairings.push({
      celebA,
      celebB,
      deltaAB,
      deltaBA,
    })
  }

  const leftOutId =
    celebrityIds.length % 2 === 1 ? celebrityIds[celebrityIds.length - 1] : null

  return {
    primaryDeltas,
    pairings,
    leftOutId,
  }
}

function formatRippleNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function buildRippleDeltasWithDiagnostics(
  graphSnapshot,
  activeContestantIds,
  primaryDeltas,
  contestantsById,
) {
  const rippleDeltas = createEdgeDeltaMap()
  const diagnostics = []
  let changedChecks = 0
  let unchangedChecks = 0
  let diagnosticIndex = 0

  forEachEdgeDelta(primaryDeltas, (sourceId, rootId, primaryDelta) => {
    const baseMagnitude = Math.abs(primaryDelta) * 0.2
    const sourceName = getDisplayName(contestantsById, sourceId)
    const rootName = getDisplayName(contestantsById, rootId)
    const direction = primaryDelta > 0 ? -1 : 1
    const directionLabel =
      direction < 0
        ? '-1 (primary increase -> jealousy pressure)'
        : '+1 (primary decrease -> rebound pressure)'

    diagnostics.push({
      key: `ripple-primary-${sourceId}-${rootId}-${diagnosticIndex++}`,
      line: `Primary ${sourceName} -> ${rootName} ${formatSigned(primaryDelta)} | baseMagnitude=${formatRippleNumber(baseMagnitude)} | direction=${directionLabel}`,
      isHeader: true,
    })

    if (baseMagnitude <= 0) {
      diagnostics.push({
        key: `ripple-primary-skip-${sourceId}-${rootId}-${diagnosticIndex++}`,
        line: 'No ripple checks: baseMagnitude <= 0.',
        isHeader: false,
        changed: false,
      })
      unchangedChecks += 1
      return
    }

    activeContestantIds.forEach((influencerId) => {
      if (influencerId === sourceId || influencerId === rootId) {
        return
      }

      const influencerToSource = graphSnapshot[influencerId]?.[sourceId] ?? 0
      const influencerToRoot = graphSnapshot[influencerId]?.[rootId] ?? 0
      const influencerName = getDisplayName(contestantsById, influencerId)
      const sourceScale =
        influencerToSource > 0 ? getRippleStrengthScale(influencerToSource) : 0
      const sourceRawImpact = baseMagnitude * sourceScale
      const sourceImpact = Math.round(sourceRawImpact)
      const sourceDelta = sourceImpact * direction
      const sourceChanged = influencerToSource > 0 && sourceImpact > 0
      const sourceReason =
        influencerToSource <= 0
          ? 'no change: influencer->source <= 0'
          : sourceImpact <= 0
            ? 'no change: rounded source impact is 0'
            : `changed: ${sourceName} -> ${influencerName} ${formatSigned(sourceDelta)}`

      diagnostics.push({
        key: `ripple-source-${sourceId}-${rootId}-${influencerId}-${diagnosticIndex++}`,
        line: `[${influencerName} -> ${sourceName}] score=${formatRippleNumber(influencerToSource)} | scale=${formatRippleNumber(sourceScale)} | raw=${formatRippleNumber(sourceRawImpact)} | rounded=${sourceImpact} | ${sourceReason}`,
        isHeader: false,
        changed: sourceChanged,
      })

      if (sourceChanged) {
        addEdgeDelta(rippleDeltas, sourceId, influencerId, sourceDelta)
        changedChecks += 1
      } else {
        unchangedChecks += 1
      }

      const rootScale = influencerToRoot > 0 ? getRippleStrengthScale(influencerToRoot) : 0
      const rootRawImpact = baseMagnitude * rootScale
      const rootImpact = Math.round(rootRawImpact)
      const rootDelta = rootImpact * direction
      const rootChanged = influencerToRoot > 0 && rootImpact > 0
      const rootReason =
        influencerToRoot <= 0
          ? 'no change: influencer->root <= 0'
          : rootImpact <= 0
            ? 'no change: rounded root impact is 0'
            : `changed: ${influencerName} -> ${rootName} ${formatSigned(rootDelta)}`

      diagnostics.push({
        key: `ripple-root-${sourceId}-${rootId}-${influencerId}-${diagnosticIndex++}`,
        line: `[${influencerName} -> ${rootName}] score=${formatRippleNumber(influencerToRoot)} | scale=${formatRippleNumber(rootScale)} | raw=${formatRippleNumber(rootRawImpact)} | rounded=${rootImpact} | ${rootReason}`,
        isHeader: false,
        changed: rootChanged,
      })

      if (rootChanged) {
        addEdgeDelta(rippleDeltas, influencerId, rootId, rootDelta)
        changedChecks += 1
      } else {
        unchangedChecks += 1
      }
    })
  })

  return {
    rippleDeltas,
    diagnostics,
    changedChecks,
    unchangedChecks,
  }
}

function getDisplayName(contestantsById, contestantId) {
  return contestantsById[contestantId]?.name ?? contestantId
}

function getEdgeValue(graph, fromId, toId) {
  return graph[fromId]?.[toId] ?? 0
}

function edgeDeltaMapToSortedList(deltaMap) {
  const rows = []
  forEachEdgeDelta(deltaMap, (fromId, toId, delta) => {
    rows.push({ fromId, toId, delta })
  })
  rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  return rows
}

function formatSigned(value) {
  return value > 0 ? `+${value}` : String(value)
}

function formatEdgeNames(contestantsById, fromId, toId) {
  const fromName = getDisplayName(contestantsById, fromId)
  const toName = getDisplayName(contestantsById, toId)
  return `${fromName} -> ${toName}`
}

function buildEdgeDeltaLines(deltaRows, contestantsById) {
  return deltaRows.map(({ fromId, toId, delta }) => ({
    key: `${fromId}-${toId}`,
    line: `${formatEdgeNames(contestantsById, fromId, toId)} ${formatSigned(delta)}`,
  }))
}

function buildFinalEdgeLines(deltaRows, contestantsById, beforeGraph, afterGraph) {
  return deltaRows.map(({ fromId, toId }) => {
    const before = getEdgeValue(beforeGraph, fromId, toId)
    const after = getEdgeValue(afterGraph, fromId, toId)
    const delta = after - before
    return {
      key: `${fromId}-${toId}`,
      line: `${formatEdgeNames(contestantsById, fromId, toId)}: ${before} -> ${after} (${formatSigned(delta)})`,
    }
  })
}

function applyDemoPostBattleGraphUpdates({
  graphSnapshot,
  contestantsById,
  activeContestantIds,
  battleTargetId,
  battleWon,
  battleTier,
}) {
  const tierConfig = BATTLE_TIER_CONFIG[battleTier] ?? BATTLE_TIER_CONFIG[1]
  const playerDelta = battleWon
    ? tierConfig.connectionDelta
    : -tierConfig.connectionDelta
  const playerPrimaryDeltas = buildPlayerBattlePrimaryDeltas(battleTargetId, playerDelta)
  const sideBattleResult = buildCelebritySideBattlePrimaryDeltas(
    activeContestantIds,
    battleTargetId,
  )
  const primaryDeltas = mergeEdgeDeltaMaps(
    playerPrimaryDeltas,
    sideBattleResult.primaryDeltas,
  )
  const rippleResult = buildRippleDeltasWithDiagnostics(
    graphSnapshot,
    activeContestantIds,
    primaryDeltas,
    contestantsById,
  )
  const rippleDeltas = rippleResult.rippleDeltas
  const netDeltas = mergeEdgeDeltaMaps(primaryDeltas, rippleDeltas)
  const nextGraph = applyEdgeDeltaMap(graphSnapshot, netDeltas)

  const targetToPlayerBefore = getEdgeValue(graphSnapshot, battleTargetId, PLAYER_ID)
  const targetToPlayerAfter = getEdgeValue(nextGraph, battleTargetId, PLAYER_ID)

  const playerPrimaryChanges = edgeDeltaMapToSortedList(playerPrimaryDeltas)
  const sidePrimaryChanges = edgeDeltaMapToSortedList(sideBattleResult.primaryDeltas)
  const primaryChanges = edgeDeltaMapToSortedList(primaryDeltas)
  const netChanges = edgeDeltaMapToSortedList(netDeltas)
  const rippleChanges = edgeDeltaMapToSortedList(rippleDeltas)
  const playerPrimaryStepLines = buildEdgeDeltaLines(playerPrimaryChanges, contestantsById)
  const sidePrimaryStepLines = buildEdgeDeltaLines(sidePrimaryChanges, contestantsById)
  const primaryStepLines = buildEdgeDeltaLines(primaryChanges, contestantsById)
  const rippleStepLines = buildEdgeDeltaLines(rippleChanges, contestantsById)
  const finalNetStepLines = buildFinalEdgeLines(
    netChanges,
    contestantsById,
    graphSnapshot,
    nextGraph,
  )

  const targetName = getDisplayName(contestantsById, battleTargetId)
  const logLines = [
    `Graph update: ${targetName}->Player ${formatSigned(targetToPlayerAfter - targetToPlayerBefore)} (${targetToPlayerBefore} -> ${targetToPlayerAfter}).`,
    `Celebrity side battles resolved ${sideBattleResult.pairings.length} pairs; ripple changed ${rippleChanges.length} edges.`,
  ]

  if (sideBattleResult.leftOutId) {
    logLines.push(
      `Side battle left out: ${getDisplayName(contestantsById, sideBattleResult.leftOutId)}.`,
    )
  }

  return {
    nextGraph,
    summary: {
      battleTier,
      battleWon,
      targetName,
      playerDelta,
      targetToPlayerBefore,
      targetToPlayerAfter,
      pairings: sideBattleResult.pairings,
      leftOutId: sideBattleResult.leftOutId,
      playerPrimaryEdgeCount: playerPrimaryChanges.length,
      sidePrimaryEdgeCount: sidePrimaryChanges.length,
      primaryEdgeCount: primaryChanges.length,
      rippleEdgeCount: rippleChanges.length,
      netEdgeCount: netChanges.length,
      playerPrimaryStepLines,
      sidePrimaryStepLines,
      primaryStepLines,
      rippleStepLines,
      rippleComputationLines: rippleResult.diagnostics,
      rippleCheckCount: rippleResult.changedChecks + rippleResult.unchangedChecks,
      rippleChangedCheckCount: rippleResult.changedChecks,
      rippleUnchangedCheckCount: rippleResult.unchangedChecks,
      finalNetStepLines,
      logLines,
    },
  }
}

export default function BattleDemo({
  onBackToIntro,
  onBattleComplete,
  initialConnectionGraph,
  selectedBattleCelebrityId = DEFAULT_BATTLE_CELEBRITY_ID,
  selectedBattleTier = 1,
  selectedSkin = 'adjussi',
  selectedCareer = 'actor',
  initialOwnedMoveIds = null,
}) {
  const playerSprite = PLAYER_SPRITES[selectedSkin] ?? PLAYER_SPRITES.adjussi
  const battleCelebrityConfig =
    BATTLE_CELEBRITY_CONFIG[selectedBattleCelebrityId] ??
    BATTLE_CELEBRITY_CONFIG[DEFAULT_BATTLE_CELEBRITY_ID]
  const battleCelebrityId =
    BATTLE_CELEBRITY_CONFIG[selectedBattleCelebrityId]
      ? selectedBattleCelebrityId
      : DEFAULT_BATTLE_CELEBRITY_ID
  const battleTier = normalizeBattleTier(selectedBattleTier)
  const tierConfig = BATTLE_TIER_CONFIG[battleTier] ?? BATTLE_TIER_CONFIG[1]
  const opponentMaxAttraction = tierConfig.opponentMaxAttraction
  const battleCelebrityName = battleCelebrityConfig.name
  const battleCelebritySprite = battleCelebrityConfig.sprite

  const defaultCareerMoves = useMemo(() => {
    const careerMoves = getMovesForCareer(selectedCareer)
    return careerMoves.length > 0 ? careerMoves : getMovesForCareer('actor')
  }, [selectedCareer])
  const defaultCareerMoveIds = useMemo(
    () => defaultCareerMoves.map((move) => move.id),
    [defaultCareerMoves],
  )
  const startingOwnedMoveIds = useMemo(() => {
    const candidateIds =
      Array.isArray(initialOwnedMoveIds) && initialOwnedMoveIds.length > 0
        ? initialOwnedMoveIds
        : defaultCareerMoveIds
    const uniqueIds = [...new Set(candidateIds)]
    const validIds = uniqueIds.filter((moveId) => Boolean(getMoveById(moveId)))
    return validIds.length > 0 ? validIds : defaultCareerMoveIds
  }, [defaultCareerMoveIds, initialOwnedMoveIds])

  const demoInitialGraphState = useMemo(() => createInitialDemoGraphState(), [])
  const startingGraph = useMemo(
    () => deepCloneGraph(initialConnectionGraph ?? demoInitialGraphState.graph),
    [demoInitialGraphState.graph, initialConnectionGraph],
  )
  const [ownedMoveIds, setOwnedMoveIds] = useState(() => startingOwnedMoveIds)
  const moves = useMemo(
    () => ownedMoveIds.map((moveId) => getMoveById(moveId)).filter(Boolean),
    [ownedMoveIds],
  )
  const [selectedMoveId, setSelectedMoveId] = useState(
    startingOwnedMoveIds[0] ?? defaultCareerMoveIds[0] ?? '',
  )
  const [playerAttraction, setPlayerAttraction] = useState(PLAYER_MAX_ATTRACTION)
  const [celebAttraction, setCelebAttraction] = useState(0)
  const [celebrityState, setCelebrityState] = useState('neutral')
  const [usedIcks, setUsedIcks] = useState([])
  const [ickCycleCount, setIckCycleCount] = useState(0)
  const [turnCount, setTurnCount] = useState(1)
  const [battleStatus, setBattleStatus] = useState('active')
  const [phase, setPhase] = useState('battle')
  const [moveCooldowns, setMoveCooldowns] = useState(() => createInitialMoveCooldowns(moves))
  const [activeQuoteChallenge, setActiveQuoteChallenge] = useState(null)
  const [quoteTimeLeft, setQuoteTimeLeft] = useState(QUOTE_TIMER_SECONDS)
  const [pendingEnemyTurn, setPendingEnemyTurn] = useState(null)
  const [slotColumnOrders, setSlotColumnOrders] = useState(() => createRandomColumnOrders())
  const [slotColumnSteps, setSlotColumnSteps] = useState(() => createRandomColumnSteps())
  const [slotSpinningColumns, setSlotSpinningColumns] = useState([false, false, false])
  const [slotStatus, setSlotStatus] = useState('idle')
  const [slotOutcome, setSlotOutcome] = useState(null)
  const [isProceedingToIsland, setIsProceedingToIsland] = useState(false)
  const [demoGraph, setDemoGraph] = useState(() => startingGraph)
  const [graphUpdateSummary, setGraphUpdateSummary] = useState(null)
  const [rewardPopupMove, setRewardPopupMove] = useState(null)
  const [heartBurstFxId, setHeartBurstFxId] = useState(null)
  const [heartBreakFxId, setHeartBreakFxId] = useState(null)
  const [battleLog, setBattleLog] = useState([
    `${battleCelebrityName} entered the battle. Pick your move and press attack.`,
  ])
  const [actionMessageQueue, setActionMessageQueue] = useState([])
  const [activeActionMessage, setActiveActionMessage] = useState(
    `${battleCelebrityName} entered the battle. Pick your move and press attack.`,
  )
  const [actionTextRenderKey, setActionTextRenderKey] = useState(0)
  const playerAttractionRef = useRef(playerAttraction)
  const usedIcksRef = useRef(usedIcks)
  const demoGraphRef = useRef(demoGraph)
  const ownedMoveIdsRef = useRef(ownedMoveIds)
  const fxTimeoutsRef = useRef([])
  const actionMessageTimeoutRef = useRef(null)
  const previousBattleLogLengthRef = useRef(1)
  const slotGrid = useMemo(
    () => buildSlotGridFromColumns(slotColumnOrders, slotColumnSteps),
    [slotColumnOrders, slotColumnSteps],
  )

  const selectedMove = moves.find((move) => move.id === selectedMoveId) ?? null
  const activeContestantIds = useMemo(() => Object.keys(demoGraph), [demoGraph])
  const contestantsById = useMemo(() => {
    const contestants = {
      [PLAYER_ID]: { name: 'You' },
    }
    activeContestantIds.forEach((id) => {
      if (id === PLAYER_ID) {
        return
      }
      contestants[id] = {
        name: BATTLE_CELEBRITY_CONFIG[id]?.name ?? id,
      }
    })
    return contestants
  }, [activeContestantIds])
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

  useEffect(() => {
    demoGraphRef.current = demoGraph
  }, [demoGraph])

  useEffect(() => {
    ownedMoveIdsRef.current = ownedMoveIds
  }, [ownedMoveIds])

  useEffect(() => {
    return () => {
      fxTimeoutsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId)
      })
      fxTimeoutsRef.current = []
      if (actionMessageTimeoutRef.current) {
        window.clearTimeout(actionMessageTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (battleLog.length <= previousBattleLogLengthRef.current) {
      return
    }

    const newMessages = battleLog.slice(previousBattleLogLengthRef.current)
    previousBattleLogLengthRef.current = battleLog.length
    setActionMessageQueue((current) => [...current, ...newMessages])
  }, [battleLog])

  useEffect(() => {
    if (activeActionMessage || actionMessageQueue.length === 0) {
      return
    }

    setActionMessageQueue((current) => {
      if (current.length === 0) {
        return current
      }

      const [nextMessage, ...rest] = current
      setActiveActionMessage(nextMessage)
      setActionTextRenderKey((key) => key + 1)
      return rest
    })
  }, [activeActionMessage, actionMessageQueue])

  const handleActionTypingDone = useCallback(() => {
    if (actionMessageTimeoutRef.current) {
      window.clearTimeout(actionMessageTimeoutRef.current)
    }

    actionMessageTimeoutRef.current = window.setTimeout(() => {
      setActiveActionMessage('')
      actionMessageTimeoutRef.current = null
    }, ACTION_TEXT_LINGER_MS)
  }, [])

  const triggerHeartBurstFx = useCallback(() => {
    const startTimeoutId = window.setTimeout(() => {
      const fxId = `${Date.now()}-${Math.random()}`
      setHeartBurstFxId(fxId)
      const endTimeoutId = window.setTimeout(() => {
        setHeartBurstFxId((current) => (current === fxId ? null : current))
      }, HEART_BURST_DURATION_MS)
      fxTimeoutsRef.current.push(endTimeoutId)
    }, HEART_BURST_TRIGGER_DELAY_MS)
    fxTimeoutsRef.current.push(startTimeoutId)
  }, [])

  const triggerHeartBreakFx = useCallback(() => {
    const startTimeoutId = window.setTimeout(() => {
      const fxId = `${Date.now()}-${Math.random()}`
      setHeartBreakFxId(fxId)
      const endTimeoutId = window.setTimeout(() => {
        setHeartBreakFxId((current) => (current === fxId ? null : current))
      }, HEART_BREAK_DURATION_MS)
      fxTimeoutsRef.current.push(endTimeoutId)
    }, HEART_BREAK_TRIGGER_DELAY_MS)
    fxTimeoutsRef.current.push(startTimeoutId)
  }, [])

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

  const finalizeBattleGraphAndAdvance = useCallback(
    (battleWon) => {
      const { nextGraph, summary } = applyDemoPostBattleGraphUpdates({
        graphSnapshot: demoGraphRef.current,
        contestantsById,
        activeContestantIds,
        battleTargetId: battleCelebrityId,
        battleWon,
        battleTier,
      })

      setDemoGraph(nextGraph)
      setGraphUpdateSummary(summary)
      setBattleLog((current) => [
        ...current,
        `${summary.targetName} connection score ${
          summary.playerDelta >= 0 ? 'increased' : 'decreased'
        } by ${Math.abs(summary.playerDelta)}.`,
      ])
      beginSlotMachine()
    },
    [
      activeContestantIds,
      battleCelebrityId,
      battleTier,
      beginSlotMachine,
      contestantsById,
    ],
  )

  const resolveEnemyAttackAfterQuote = useCallback(
    (quoteResult) => {
      if (!pendingEnemyTurn) {
        return
      }

      const { ick, nextUsedIcks, didCycleReset } = pickNextIck(usedIcksRef.current, battleCelebrityId)
      const ickPower = ick?.power ?? DEFAULT_ICK_DAMAGE
      const isRepeatedIck = didCycleReset || ickCycleCount > 0
      const repeatedIckMultiplier = isRepeatedIck ? 2 : 1
      const preQuoteDamage = Math.max(
        1,
        Math.round(ickPower * repeatedIckMultiplier * tierConfig.ickDamageScale),
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
        ? `${battleCelebrityName} gives you the ick they ${ick.name}. You lose ${ickDamage} attraction.`
        : `${battleCelebrityName} gives you the ick. You lose ${ickDamage} attraction.`
      const defeatMessage = didPlayerLose
        ? 'Your attraction hit zero. Battle lost.'
        : null

      setUsedIcks(nextUsedIcks)
      if (didCycleReset) {
        setIckCycleCount((count) => count + 1)
      }
      triggerHeartBreakFx()
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
        finalizeBattleGraphAndAdvance(false)
      }
    },
    [
      battleCelebrityId,
      battleCelebrityName,
      finalizeBattleGraphAndAdvance,
      ickCycleCount,
      pendingEnemyTurn,
      tierConfig.ickDamageScale,
      triggerHeartBreakFx,
    ],
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

  const handleProceedToIsland = useCallback(() => {
    if (
      phase !== 'slot' ||
      slotStatus !== 'resolved' ||
      !graphUpdateSummary ||
      typeof onBattleComplete !== 'function' ||
      isProceedingToIsland
    ) {
      return
    }

    setIsProceedingToIsland(true)
    onBattleComplete({
      nextGraph: demoGraphRef.current,
      graphUpdateSummary,
      nextPlayerMoveIds: ownedMoveIdsRef.current,
    })
  }, [
    graphUpdateSummary,
    isProceedingToIsland,
    onBattleComplete,
    phase,
    slotStatus,
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
    const hasDoubleStateBonus = isStateMatch && selectedMove.state !== 'neutral'
    const attractionGain = selectedMove.power * (hasDoubleStateBonus ? 2 : 1)
    const nextCelebAttraction = clampAttraction(
      celebAttraction + attractionGain,
      opponentMaxAttraction,
    )
    const nextState = pickWeightedState(selectedMove.stateChange, celebrityState)
    triggerHeartBurstFx()

    const logEntries = [
      `Turn ${turnCount}: You used ${selectedMove.name} (+${attractionGain} attraction${hasDoubleStateBonus ? ', state match x2' : ''}).`,
    ]

      if (nextCelebAttraction >= opponentMaxAttraction) {
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
        `${battleCelebrityName} reached ${opponentMaxAttraction} attraction. Battle won.`,
      ])
      finalizeBattleGraphAndAdvance(true)
      return
    }

    const quoteChallenge = createQuoteChallengeForCelebrity(battleCelebrityId, battleCelebrityName)
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
      `Quote minigame started. Choose ${battleCelebrityName}'s quote within ${QUOTE_TIMER_SECONDS} seconds.`,
    ])
  }

  const handleExitBattleDemo = useCallback(() => {
    onBackToIntro?.(graphUpdateSummary)
  }, [graphUpdateSummary, onBackToIntro])

  return (
    <div className="battle-demo" style={{ backgroundImage: `url(${loveIslandBg})` }}>
      <div className="battle-overlay" />

      <button className="battle-back-btn" onClick={handleExitBattleDemo}>
        Back
      </button>

      <div className="celebrity-hud">
        <div className="celebrity-name-row">
          <h2>{battleCelebrityName}</h2>
          <img src={celebrityStateIcon} alt={`${celebrityState} state`} />
          <span>{formatStateLabel(celebrityState)}</span>
        </div>
        <div className="meter-track">
          <div
            className="meter-fill"
            style={{ width: `${(celebAttraction / opponentMaxAttraction) * 100}%` }}
          />
        </div>
        <p className="meter-value">{celebAttraction} / {opponentMaxAttraction}</p>
        <p className="meter-value">Difficulty: {getBattleDifficultyLabel(battleTier)}</p>
      </div>

      <img className="celebrity-sprite" src={battleCelebritySprite} alt={`${battleCelebrityName} sprite`} />
      {heartBurstFxId && (
        <div key={heartBurstFxId} className="heart-burst-fx" aria-hidden="true">
          <span className="heart-burst-particle heart-burst-particle-1">&#9829;</span>
          <span className="heart-burst-particle heart-burst-particle-2">&#9829;</span>
          <span className="heart-burst-particle heart-burst-particle-3">&#9829;</span>
          <span className="heart-burst-particle heart-burst-particle-4">&#9829;</span>
          <span className="heart-burst-particle heart-burst-particle-5">&#9829;</span>
          <span className="heart-burst-particle heart-burst-particle-6">&#9829;</span>
          <span className="heart-burst-particle heart-burst-particle-7">&#9829;</span>
        </div>
      )}
      <img className="player-sprite" src={playerSprite} alt="Player sprite" />
      {heartBreakFxId && (
        <div key={heartBreakFxId} className="heart-break-fx" aria-hidden="true">
          <span className="heart-break-half heart-break-left">&#9829;</span>
          <span className="heart-break-half heart-break-right">&#9829;</span>
          <span className="heart-break-crack" />
        </div>
      )}
      {activeActionMessage && (
        <div className="battle-action-banner" aria-live="polite">
          <TypingText
            key={actionTextRenderKey}
            className="battle-action-text"
            text={activeActionMessage}
            speed={ACTION_TEXT_TYPING_SPEED_MS}
            onDone={handleActionTypingDone}
          />
        </div>
      )}

      <div className="battle-controls">
        <div className="player-meter-row">
          <div className="player-meter-info">
            <span>Player Attraction</span>
            <span>{playerAttraction} / {PLAYER_MAX_ATTRACTION}</span>
          </div>
          <div className="meter-track">
            <div
              className="meter-fill"
              style={{ width: `${(playerAttraction / PLAYER_MAX_ATTRACTION) * 100}%` }}
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
              <button
                className="attack-btn"
                onClick={handleProceedToIsland}
                disabled={
                  slotStatus !== 'resolved' ||
                  !graphUpdateSummary ||
                  typeof onBattleComplete !== 'function' ||
                  isProceedingToIsland
                }
              >
                {isProceedingToIsland ? 'Loading...' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
