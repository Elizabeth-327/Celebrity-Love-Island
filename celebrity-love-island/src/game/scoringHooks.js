import { PLAYER_ID } from './data/contestants'

export function computeConnectionScore(fromId, toId, gameState) {
  return gameState.graph[fromId]?.[toId] ?? 0
}

export function computeTotalConnectionScore(contestantId, gameState) {
  return gameState.activeContestantIds.reduce((sum, otherId) => {
    if (contestantId === otherId) {
      return sum
    }

    return sum + computeConnectionScore(contestantId, otherId, gameState)
  }, 0)
}

export function buildScoreboard(gameState, scoreFn = computeTotalConnectionScore) {
  return gameState.activeContestantIds
    .map((contestantId) => ({
      contestantId,
      score: scoreFn(contestantId, gameState),
      isPlayer: contestantId === PLAYER_ID,
    }))
    .sort((a, b) => b.score - a.score || a.contestantId.localeCompare(b.contestantId))
}

