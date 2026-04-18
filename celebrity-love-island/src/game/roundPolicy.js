export const SEASON_LENGTH = 8

export function isBombshellRound(roundNumber) {
  return roundNumber > 1 && roundNumber <= SEASON_LENGTH && roundNumber % 2 === 0
}

export function isEliminationRound(roundNumber) {
  return roundNumber > 2 && roundNumber <= SEASON_LENGTH && roundNumber % 2 === 1
}

export function createDefaultRoundPolicy() {
  return {
    isBombshellRound,
    isEliminationRound,
  }
}

