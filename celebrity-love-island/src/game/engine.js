import { resolveBattleEncounter, createInitialBattleState } from './battle'
import {
  CAREER_OPTIONS,
  PLAYER_ID,
  createBombshellQueue,
  createInitialContestants,
  getRelationshipEdgeValue,
} from './data/contestants'
import { getStartingMoveIdsForCareer } from './data/moves'
import {
  BASE_SLOT_MACHINE_SPEED,
  SLOT_MACHINE_LOSS_SPEED_MULTIPLIER,
  createActiveSlotMachineState,
  createInitialSlotMachineState,
  resolveSlotMachineReward,
  spinSlotMachine,
  stopLeftmostSpinningColumn,
} from './slotMachine'
import {
  buildScoreboard,
  computeConnectionScore,
  computeTotalConnectionScore,
} from './scoringHooks'
import { SEASON_LENGTH, createDefaultRoundPolicy } from './roundPolicy'

const EDGE_MIN = -100
const EDGE_MAX = 100
const DEFAULT_PHASE = 'intro'
const MAX_CHATS_PER_ROUND = 2

function normalizeSlotMachineSpeed(speed) {
  return Number(speed.toFixed(4))
}

function normalizeBattleTier(tier) {
  if (tier === 2 || tier === 3) {
    return tier
  }

  return 1
}

function getBattleDifficultyLabel(tier) {
  if (tier === 2) {
    return 'Medium'
  }
  if (tier === 3) {
    return 'Hard'
  }
  return 'Easy'
}

function clampEdge(value) {
  return Math.max(EDGE_MIN, Math.min(EDGE_MAX, Math.round(value)))
}

function deepCloneGraph(graph) {
  return Object.fromEntries(
    Object.entries(graph).map(([fromId, edges]) => [fromId, { ...edges }]),
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
    nextGraph[fromId][toId] = clampEdge(current + delta)
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

function createInitialGraph(contestantIds) {
  const graph = {}
  contestantIds.forEach((fromId) => {
    graph[fromId] = {}
    contestantIds.forEach((toId) => {
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
  return graph
}

function extendGraphWithContestant(graph, existingIds, newcomerId) {
  const nextGraph = deepCloneGraph(graph)
  nextGraph[newcomerId] = {}

  existingIds.forEach((contestantId) => {
    if (contestantId === newcomerId) {
      return
    }

    nextGraph[contestantId] = nextGraph[contestantId] ?? {}
    nextGraph[newcomerId][contestantId] =
      contestantId === PLAYER_ID ? 0 : getRelationshipEdgeValue(newcomerId, contestantId)
    if (contestantId !== PLAYER_ID) {
      nextGraph[contestantId][newcomerId] = getRelationshipEdgeValue(contestantId, newcomerId)
    }
  })

  return nextGraph
}

function appendHistory(gameState, message) {
  return [...gameState.history, `R${gameState.round}: ${message}`]
}

function randomConnectionDelta() {
  return Math.floor(Math.random() * 41) - 20
}

function buildPlayerBattlePrimaryDeltas(targetId, delta) {
  const primaryDeltas = createEdgeDeltaMap()
  addEdgeDelta(primaryDeltas, targetId, PLAYER_ID, delta)
  return primaryDeltas
}

function buildCelebritySideBattlePrimaryDeltas(gameState, excludedCelebrityId = null) {
  const celebrityIds = gameState.activeContestantIds.filter(
    (id) => id !== PLAYER_ID && id !== excludedCelebrityId,
  )
  const primaryDeltas = createEdgeDeltaMap()

  for (let index = 0; index + 1 < celebrityIds.length; index += 2) {
    const celebA = celebrityIds[index]
    const celebB = celebrityIds[index + 1]

    const deltaAB = randomConnectionDelta()
    const deltaBA = randomConnectionDelta()

    addEdgeDelta(primaryDeltas, celebA, celebB, deltaAB)
    addEdgeDelta(primaryDeltas, celebB, celebA, deltaBA)
  }

  const leftOutId =
    celebrityIds.length % 2 === 1 ? celebrityIds[celebrityIds.length - 1] : null

  return { primaryDeltas, leftOutId }
}

function buildRippleDeltas(gameState, primaryDeltas) {
  const rippleDeltas = createEdgeDeltaMap()

  forEachEdgeDelta(primaryDeltas, (sourceId, rootId, primaryDelta) => {
    const baseMagnitude = Math.abs(primaryDelta) * 0.2
    if (baseMagnitude <= 0) {
      return
    }

    const direction = primaryDelta > 0 ? -1 : 1

    gameState.activeContestantIds.forEach((influencerId) => {
      if (influencerId === sourceId || influencerId === rootId) {
        return
      }

      const influencerToSource = gameState.graph[influencerId]?.[sourceId] ?? 0
      const influencerToRoot = gameState.graph[influencerId]?.[rootId] ?? 0

      if (influencerToSource > 0) {
        const sourceScale = getRippleStrengthScale(influencerToSource)
        const sourceImpact = Math.round(baseMagnitude * sourceScale)
        if (sourceImpact > 0) {
          addEdgeDelta(rippleDeltas, sourceId, influencerId, sourceImpact * direction)
        }
      }

      if (influencerToRoot > 0) {
        const rootScale = getRippleStrengthScale(influencerToRoot)
        const rootImpact = Math.round(baseMagnitude * rootScale)
        if (rootImpact > 0) {
          addEdgeDelta(rippleDeltas, influencerId, rootId, rootImpact * direction)
        }
      }
    })
  })

  return rippleDeltas
}

export function selectEliminatedContestant(
  activeContestants,
  gameState,
  totalScoreFn = computeTotalConnectionScore,
) {
  if (activeContestants.length === 0) {
    return null
  }

  const ranking = activeContestants
    .map((contestantId) => ({
      contestantId,
      score: totalScoreFn(contestantId, gameState),
    }))
    .sort((a, b) => a.score - b.score || a.contestantId.localeCompare(b.contestantId))

  return ranking[0].contestantId
}

export function createGameEngine(options = {}) {
  const scoringHooks = {
    computeConnectionScore:
      options.computeConnectionScore ?? computeConnectionScore,
    computeTotalConnectionScore:
      options.computeTotalConnectionScore ?? computeTotalConnectionScore,
  }

  const roundPolicy = options.roundPolicy ?? createDefaultRoundPolicy()

  function createInitialState() {
    const contestants = createInitialContestants()
    const activeContestantIds = Object.keys(contestants)
    const graph = createInitialGraph(activeContestantIds)

    return {
      seasonLength: SEASON_LENGTH,
      phase: DEFAULT_PHASE,
      round: 1,
      gameStatus: 'not_started',
      player: {
        id: PLAYER_ID,
        career: CAREER_OPTIONS[0],
      },
      contestants,
      activeContestantIds,
      graph,
      bombshellQueue: createBombshellQueue(),
      coupleTargetId: null,
      interactionState: {
        startedRound: false,
        mingled: false,
        battled: false,
        resolvedSlotMachine: false,
        chatsUsedThisRound: 0,
        maxChatsPerRound: MAX_CHATS_PER_ROUND,
        chattedCelebrityIdsThisRound: [],
      },
      battle: createInitialBattleState(),
      slotMachine: createInitialSlotMachineState(BASE_SLOT_MACHINE_SPEED),
      slotMachineSpeed: BASE_SLOT_MACHINE_SPEED,
      slotMachineLossesSinceLastWin: 0,
      playerMoveIds: getStartingMoveIdsForCareer(CAREER_OPTIONS[0]),
      history: ['Welcome to Celebrity Love Island.'],
      winnerId: null,
    }
  }

  function startNewGame(currentState) {
    return {
      ...currentState,
      phase: 'customize',
      gameStatus: 'not_started',
    }
  }

  function chooseCareer(currentState, career) {
    const nextCareer = CAREER_OPTIONS.includes(career) ? career : CAREER_OPTIONS[0]
    return {
      ...currentState,
      player: {
        ...currentState.player,
        career: nextCareer,
      },
      playerMoveIds: getStartingMoveIdsForCareer(nextCareer),
      contestants: {
        ...currentState.contestants,
        [PLAYER_ID]: {
          ...currentState.contestants[PLAYER_ID],
          career: nextCareer,
        },
      },
    }
  }

  function beginSeason(currentState) {
    return {
      ...currentState,
      phase: 'round',
      gameStatus: 'playing',
      interactionState: {
        startedRound: false,
        mingled: false,
        battled: false,
        resolvedSlotMachine: false,
        chatsUsedThisRound: 0,
        maxChatsPerRound: MAX_CHATS_PER_ROUND,
        chattedCelebrityIdsThisRound: [],
      },
      slotMachine: createInitialSlotMachineState(currentState.slotMachineSpeed),
      history: appendHistory(currentState, 'Season starts.'),
    }
  }

  function addBombshellIfNeeded(currentState) {
    if (!roundPolicy.isBombshellRound(currentState.round)) {
      return currentState
    }

    if (currentState.bombshellQueue.length === 0) {
      return {
        ...currentState,
        history: appendHistory(currentState, 'No bombshell available.'),
      }
    }

    const [incoming, ...restQueue] = currentState.bombshellQueue
    const nextContestants = {
      ...currentState.contestants,
      [incoming.id]: incoming,
    }
    const nextActiveIds = [...currentState.activeContestantIds, incoming.id]
    const nextGraph = extendGraphWithContestant(
      currentState.graph,
      nextActiveIds,
      incoming.id,
    )

    return {
      ...currentState,
      contestants: nextContestants,
      activeContestantIds: nextActiveIds,
      graph: nextGraph,
      bombshellQueue: restQueue,
      history: appendHistory(currentState, `${incoming.name} enters as a bombshell.`),
    }
  }

  function startRound(currentState) {
    if (currentState.gameStatus !== 'playing') {
      return currentState
    }

    if (currentState.interactionState.startedRound) {
      return currentState
    }

    const withBombshell = addBombshellIfNeeded(currentState)
    return {
      ...withBombshell,
      interactionState: {
        ...withBombshell.interactionState,
        startedRound: true,
        mingled: false,
        battled: false,
        resolvedSlotMachine: false,
        chatsUsedThisRound: 0,
        maxChatsPerRound:
          withBombshell.interactionState.maxChatsPerRound ?? MAX_CHATS_PER_ROUND,
        chattedCelebrityIdsThisRound: [],
      },
      slotMachine: createInitialSlotMachineState(withBombshell.slotMachineSpeed),
      history: appendHistory(withBombshell, 'Round started.'),
    }
  }

  function applyDirectRelationshipChange(currentState, targetId, delta) {
    const primaryDeltas = buildPlayerBattlePrimaryDeltas(targetId, delta)
    const nextGraph = applyEdgeDeltaMap(currentState.graph, primaryDeltas)
    return {
      ...currentState,
      graph: nextGraph,
    }
  }

  function resolveMingle(currentState, targetId) {
    const chatsUsedThisRound = currentState.interactionState.chatsUsedThisRound ?? 0
    const maxChatsPerRound =
      currentState.interactionState.maxChatsPerRound ?? MAX_CHATS_PER_ROUND
    const chattedCelebrityIdsThisRound =
      currentState.interactionState.chattedCelebrityIdsThisRound ?? []

    if (
      !currentState.interactionState.startedRound ||
      currentState.interactionState.battled ||
      chatsUsedThisRound >= maxChatsPerRound
    ) {
      return currentState
    }

    if (!currentState.activeContestantIds.includes(targetId) || targetId === PLAYER_ID) {
      return currentState
    }

    if (chattedCelebrityIdsThisRound.includes(targetId)) {
      return {
        ...currentState,
        history: appendHistory(
          currentState,
          `Already chatted with ${currentState.contestants[targetId].name} this round.`,
        ),
      }
    }

    const connectionScore = scoringHooks.computeConnectionScore(
      PLAYER_ID,
      targetId,
      currentState,
    )
    const delta = connectionScore >= 0 ? 6 : 9
    const nextState = applyDirectRelationshipChange(currentState, targetId, delta)

    return {
      ...nextState,
      interactionState: {
        ...nextState.interactionState,
        mingled: true,
        chatsUsedThisRound: chatsUsedThisRound + 1,
        maxChatsPerRound,
        chattedCelebrityIdsThisRound: [...chattedCelebrityIdsThisRound, targetId],
      },
      history: appendHistory(nextState, `Mingled with ${nextState.contestants[targetId].name}.`),
    }
  }

  function resolveBattle(currentState, targetId, requestedTier = 1, quoteAttempts = []) {
    if (!currentState.interactionState.startedRound || currentState.interactionState.battled) {
      return currentState
    }

    if (!currentState.activeContestantIds.includes(targetId) || targetId === PLAYER_ID) {
      return currentState
    }

    const connectionScore = scoringHooks.computeConnectionScore(
      PLAYER_ID,
      targetId,
      currentState,
    )
    const battleTier = normalizeBattleTier(requestedTier)
    const encounter = resolveBattleEncounter({
      connectionScore,
      roundNumber: currentState.round,
      targetId,
      tier: battleTier,
      previousBattle: currentState.battle,
      quoteAttempts,
    })
    const playerBattlePrimaryDeltas = buildPlayerBattlePrimaryDeltas(
      targetId,
      encounter.connectionDelta,
    )
    const sideBattleResult = buildCelebritySideBattlePrimaryDeltas(currentState, targetId)
    const primaryDeltas = mergeEdgeDeltaMaps(
      playerBattlePrimaryDeltas,
      sideBattleResult.primaryDeltas,
    )
    const rippleDeltas = buildRippleDeltas(currentState, primaryDeltas)
    const netDeltas = mergeEdgeDeltaMaps(primaryDeltas, rippleDeltas)
    const nextGraph = applyEdgeDeltaMap(currentState.graph, netDeltas)
    const sideBattleState = {
      ...currentState,
      graph: nextGraph,
    }
    const leftOutMessage = sideBattleResult.leftOutId
      ? ` ${sideBattleState.contestants[sideBattleResult.leftOutId].name} sat out due to odd pairing.`
      : ''
    const difficultyLabel = getBattleDifficultyLabel(battleTier)
    const historyAfterBattle = appendHistory(
      sideBattleState,
      `${difficultyLabel} battle against ${sideBattleState.contestants[targetId].name}: ${encounter.won ? 'win' : 'loss'}.`,
    )
    const historyAfterSideBattles = [
      ...historyAfterBattle,
      `R${sideBattleState.round}: Celebrity side battles shifted connection scores.${leftOutMessage}`,
    ]

    return {
      ...sideBattleState,
      coupleTargetId: targetId,
      battle: encounter.battleState,
      slotMachine: createActiveSlotMachineState(sideBattleState.slotMachineSpeed),
      interactionState: {
        ...sideBattleState.interactionState,
        battled: true,
        resolvedSlotMachine: false,
      },
      history: [
        ...historyAfterSideBattles,
        `R${sideBattleState.round}: Slot machine started at speed x${sideBattleState.slotMachineSpeed}. Press space to stop each column from left to right.`,
      ],
    }
  }

  function tickSlotMachine(currentState) {
    if (currentState.slotMachine.status !== 'spinning') {
      return currentState
    }

    return {
      ...currentState,
      slotMachine: spinSlotMachine(currentState.slotMachine),
    }
  }

  function stopSlotMachineColumn(currentState) {
    if (!currentState.interactionState.battled) {
      return currentState
    }

    if (currentState.slotMachine.status !== 'spinning') {
      return currentState
    }

    const { slotMachine: afterStop, allStopped } = stopLeftmostSpinningColumn(
      currentState.slotMachine,
    )

    if (!allStopped) {
      return {
        ...currentState,
        slotMachine: afterStop,
      }
    }

    const rewardResult = resolveSlotMachineReward(afterStop, currentState.playerMoveIds)
    const nextMoveIds = rewardResult.awardedMoveId
      ? [...currentState.playerMoveIds, rewardResult.awardedMoveId]
      : currentState.playerMoveIds
    const wonSlotMachine = Boolean(rewardResult.slotMachine.centerMatchState)
    const nextSpeed = wonSlotMachine
      ? BASE_SLOT_MACHINE_SPEED
      : normalizeSlotMachineSpeed(
          currentState.slotMachineSpeed * SLOT_MACHINE_LOSS_SPEED_MULTIPLIER,
        )
    const nextLossCount = wonSlotMachine
      ? 0
      : currentState.slotMachineLossesSinceLastWin + 1
    const message = rewardResult.awardedMoveId
      ? `Slot machine match on ${rewardResult.slotMachine.rewardMoveState}. You learned ${rewardResult.awardedMoveId}.`
      : rewardResult.slotMachine.centerMatchState
        ? `Slot machine matched ${rewardResult.slotMachine.centerMatchState}, but no new generic move was available.`
        : 'Slot machine center row did not match. No bonus move awarded.'
    const speedMessage = wonSlotMachine
      ? ` Slot speed reset to x${nextSpeed}.`
      : ` Loss streak: ${nextLossCount}. Next slot speed is x${nextSpeed}.`

    return {
      ...currentState,
      slotMachine: {
        ...rewardResult.slotMachine,
        spinSpeed: currentState.slotMachine.spinSpeed,
      },
      slotMachineSpeed: nextSpeed,
      slotMachineLossesSinceLastWin: nextLossCount,
      playerMoveIds: nextMoveIds,
      interactionState: {
        ...currentState.interactionState,
        resolvedSlotMachine: true,
      },
      history: appendHistory(currentState, `${message}${speedMessage}`),
    }
  }

  function finalizeSeason(currentState) {
    const scoreboard = buildScoreboard(currentState, scoringHooks.computeTotalConnectionScore)
    const winner = scoreboard[0]

    return {
      ...currentState,
      phase: 'seasonResult',
      gameStatus: winner?.contestantId === PLAYER_ID ? 'won' : 'lost',
      winnerId: winner?.contestantId ?? null,
      history: appendHistory(
        currentState,
        winner?.contestantId === PLAYER_ID
          ? 'You finished with the highest total connection score.'
          : `Season winner is ${currentState.contestants[winner?.contestantId]?.name ?? 'unknown'}.`,
      ),
    }
  }

  function endRound(currentState) {
    if (
      !currentState.interactionState.startedRound ||
      !currentState.interactionState.mingled ||
      !currentState.interactionState.battled ||
      !currentState.interactionState.resolvedSlotMachine
    ) {
      return currentState
    }

    let nextState = currentState

    if (roundPolicy.isEliminationRound(currentState.round)) {
      const eliminatedId = selectEliminatedContestant(
        currentState.activeContestantIds,
        currentState,
        scoringHooks.computeTotalConnectionScore,
      )

      if (eliminatedId) {
        const eliminatedName = currentState.contestants[eliminatedId].name
        nextState = {
          ...nextState,
          contestants: {
            ...nextState.contestants,
            [eliminatedId]: {
              ...nextState.contestants[eliminatedId],
              status: 'eliminated',
            },
          },
          activeContestantIds: nextState.activeContestantIds.filter((id) => id !== eliminatedId),
          history: appendHistory(nextState, `${eliminatedName} was eliminated.`),
        }

        if (eliminatedId === PLAYER_ID) {
          return {
            ...nextState,
            phase: 'seasonResult',
            gameStatus: 'lost',
            winnerId: null,
            history: appendHistory(nextState, 'You were dumped from the island.'),
          }
        }
      }
    }

    if (currentState.round >= currentState.seasonLength) {
      return finalizeSeason(nextState)
    }

    return {
      ...nextState,
      round: currentState.round + 1,
      interactionState: {
        startedRound: false,
        mingled: false,
        battled: false,
        resolvedSlotMachine: false,
        chatsUsedThisRound: 0,
        maxChatsPerRound:
          nextState.interactionState.maxChatsPerRound ?? MAX_CHATS_PER_ROUND,
        chattedCelebrityIdsThisRound: [],
      },
      battle: createInitialBattleState(),
      slotMachine: createInitialSlotMachineState(nextState.slotMachineSpeed),
      history: appendHistory(nextState, 'Round complete.'),
    }
  }

  function getScoreboard(currentState) {
    return buildScoreboard(currentState, scoringHooks.computeTotalConnectionScore)
  }

  return {
    roundPolicy,
    scoringHooks,
    createInitialState,
    startNewGame,
    chooseCareer,
    beginSeason,
    startRound,
    resolveMingle,
    resolveBattle,
    tickSlotMachine,
    stopSlotMachineColumn,
    endRound,
    getScoreboard,
  }
}
