import { describe, expect, it } from 'vitest'
import { SEASON_LENGTH, isBombshellRound, isEliminationRound } from '../roundPolicy'

describe('round policy', () => {
  it('matches expected bombshell cadence', () => {
    const bombshellRounds = []

    for (let round = 1; round <= SEASON_LENGTH; round += 1) {
      if (isBombshellRound(round)) {
        bombshellRounds.push(round)
      }
    }

    expect(bombshellRounds).toEqual([2, 4, 6, 8])
  })

  it('matches expected elimination cadence', () => {
    const eliminationRounds = []

    for (let round = 1; round <= SEASON_LENGTH; round += 1) {
      if (isEliminationRound(round)) {
        eliminationRounds.push(round)
      }
    }

    expect(eliminationRounds).toEqual([3, 5, 7])
  })
})

