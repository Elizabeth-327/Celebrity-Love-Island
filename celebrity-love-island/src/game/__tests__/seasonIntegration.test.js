import { describe, expect, it } from 'vitest'
import { PLAYER_ID } from '../data/contestants'
import { createGameEngine } from '../engine'

describe('season integration', () => {
  it('runs a full 8-round season with deterministic scoring', () => {
    const scoreFn = (contestantId) => {
      if (contestantId === PLAYER_ID) {
        return 1_000
      }

      return contestantId.length * -1
    }

    const engine = createGameEngine({ computeTotalConnectionScore: scoreFn })
    let state = engine.createInitialState()
    state = engine.startNewGame(state)
    state = engine.beginSeason(state)

    const roundSizes = {}

    while (state.phase !== 'seasonResult') {
      state = engine.startRound(state)
      roundSizes[state.round] = state.activeContestantIds.length

      const targetId = state.activeContestantIds.find((id) => id !== PLAYER_ID)
      state = engine.resolveMingle(state, targetId)
      state = engine.resolveBattle(state, targetId)
      state = engine.endRound(state)
    }

    const eliminatedCount = Object.values(state.contestants).filter(
      (contestant) => contestant.status === 'eliminated',
    ).length

    expect(roundSizes[1]).toBe(10)
    expect(roundSizes[2]).toBe(11)
    expect(roundSizes[8]).toBe(11)
    expect(eliminatedCount).toBe(3)
    expect(state.gameStatus).toBe('won')
    expect(state.round).toBe(8)
  })
})

