export const SEASON_LENGTH = 10

const BOMB_SHELL_ROUND_SET = new Set([2, 4, 6, 8, 10])
const ELIMINATION_ROUND_SET = new Set([3, 5, 7, 9])

export function isBombshellRound(roundNumber) {
  return BOMB_SHELL_ROUND_SET.has(roundNumber)
}

export function isEliminationRound(roundNumber) {
  return ELIMINATION_ROUND_SET.has(roundNumber)
}

export function createDefaultRoundPolicy() {
  return {
    isBombshellRound,
    isEliminationRound,
  }
}

