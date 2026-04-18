import { resolveBattleEncounter, createInitialBattleState } from './battle'
import {
  CAREER_OPTIONS,
  PLAYER_ID,
  createBombshellQueue,
  createInitialContestants,
  getRelationshipEdgeValue,
} from './data/contestants'
import {
  buildScoreboard,
  computeConnectionScore,
  computeTotalConnectionScore,
} from './scoringHooks'
import { SEASON_LENGTH, createDefaultRoundPolicy } from './roundPolicy'

const EDGE_MIN = -100
const EDGE_MAX = 100
const DEFAULT_PHASE = 'intro'

function normalizeBattleTier(tier) {
  if (tier === 2 || tier === 3) {
    return tier
  }

  return 1
}

function clampEdge(value) {
  return Math.max(EDGE_MIN, Math.min(EDGE_MAX, Math.round(value)))
}

function deepCloneGraph(graph) {
  return Object.fromEntries(
    Object.entries(graph).map(([fromId, edges]) => [fromId, { ...edges }]),
  )
}

function applyEdgeDelta(graph, fromId, toId, delta) {
  const nextGraph = deepCloneGraph(graph)
  const current = nextGraph[fromId]?.[toId] ?? 0
  nextGraph[fromId] = nextGraph[fromId] ?? {}
  nextGraph[fromId][toId] = clampEdge(current + delta)
  return nextGraph
}

function createInitialGraph(contestantIds) {
  const graph = {}
  contestantIds.forEach((fromId) => {
    graph[fromId] = {}
    contestantIds.forEach((toId) => {
      if (fromId === toId) {
        return
      }

      graph[fromId][toId] =
        fromId === PLAYER_ID || toId === PLAYER_ID
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
    nextGraph[contestantId][newcomerId] =
      contestantId === PLAYER_ID ? 0 : getRelationshipEdgeValue(contestantId, newcomerId)
  })

  return nextGraph
}

function applyRelationshipRipple(gameState, targetId, directDelta) {
  const target = gameState.contestants[targetId]
  if (!target) {
    return gameState.graph
  }

  let nextGraph = gameState.graph
  const sign = Math.sign(directDelta)

  gameState.activeContestantIds.forEach((otherId) => {
    if (otherId === PLAYER_ID || otherId === targetId) {
      return
    }

    const allyBoost = target.allies.includes(otherId) ? 2 * sign : 0
    const rivalDrop = target.rivals.includes(otherId) ? -2 * sign : 0
    const ripple = allyBoost + rivalDrop
    if (ripple !== 0) {
      nextGraph = applyEdgeDelta(nextGraph, otherId, PLAYER_ID, ripple)
      nextGraph = applyEdgeDelta(nextGraph, PLAYER_ID, otherId, Math.sign(ripple))
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

function applyCelebritySideBattleUpdates(gameState, excludedCelebrityId = null) {
  const celebrityIds = gameState.activeContestantIds.filter(
    (id) => id !== PLAYER_ID && id !== excludedCelebrityId,
  )
  let nextGraph = gameState.graph

  for (let index = 0; index + 1 < celebrityIds.length; index += 2) {
    const celebA = celebrityIds[index]
    const celebB = celebrityIds[index + 1]

    const deltaAB = randomConnectionDelta()
    const deltaBA = randomConnectionDelta()

    nextGraph = applyEdgeDelta(nextGraph, celebA, celebB, deltaAB)
    nextGraph = applyEdgeDelta(nextGraph, celebB, celebA, deltaBA)
  }

  const leftOutId =
    celebrityIds.length % 2 === 1 ? celebrityIds[celebrityIds.length - 1] : null

  return { graph: nextGraph, leftOutId }
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
      },
      battle: createInitialBattleState(),
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
      },
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
      },
      history: appendHistory(withBombshell, 'Round started.'),
    }
  }

  function applyDirectRelationshipChange(currentState, targetId, delta) {
    let nextGraph = applyEdgeDelta(currentState.graph, PLAYER_ID, targetId, delta)
    nextGraph = applyEdgeDelta(nextGraph, targetId, PLAYER_ID, Math.round(delta / 2))
    const rippleGraph = applyRelationshipRipple(
      {
        ...currentState,
        graph: nextGraph,
      },
      targetId,
      delta,
    )

    return {
      ...currentState,
      graph: rippleGraph,
    }
  }

  function resolveMingle(currentState, targetId) {
    if (!currentState.interactionState.startedRound || currentState.interactionState.mingled) {
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
    const delta = connectionScore >= 0 ? 6 : 9
    const nextState = applyDirectRelationshipChange(currentState, targetId, delta)

    return {
      ...nextState,
      interactionState: {
        ...nextState.interactionState,
        mingled: true,
      },
      history: appendHistory(nextState, `Mingled with ${nextState.contestants[targetId].name}.`),
    }
  }

  function resolveBattle(currentState, targetId, requestedTier = 1) {
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
    })
    const nextState = applyDirectRelationshipChange(
      currentState,
      targetId,
      encounter.connectionDelta,
    )
    const sideBattleResult = applyCelebritySideBattleUpdates(nextState, targetId)
    const sideBattleState = {
      ...nextState,
      graph: sideBattleResult.graph,
    }
    const leftOutMessage = sideBattleResult.leftOutId
      ? ` ${sideBattleState.contestants[sideBattleResult.leftOutId].name} sat out due to odd pairing.`
      : ''
    const historyAfterBattle = appendHistory(
      sideBattleState,
      `Tier ${battleTier} battle against ${sideBattleState.contestants[targetId].name}: ${encounter.won ? 'win' : 'loss'}.`,
    )
    const historyAfterSideBattles = [
      ...historyAfterBattle,
      `R${sideBattleState.round}: Celebrity side battles shifted connection scores.${leftOutMessage}`,
    ]

    return {
      ...sideBattleState,
      coupleTargetId: targetId,
      battle: encounter.battleState,
      interactionState: {
        ...sideBattleState.interactionState,
        battled: true,
      },
      history: historyAfterSideBattles,
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
      !currentState.interactionState.battled
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
      },
      battle: createInitialBattleState(),
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
    endRound,
    getScoreboard,
  }
}
