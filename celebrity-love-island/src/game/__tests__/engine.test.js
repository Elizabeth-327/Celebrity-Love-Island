import { describe, expect, it } from 'vitest'
import { PLAYER_ID } from '../data/contestants'
import { createGameEngine } from '../engine'

function createStartedState(engine) {
  let state = engine.createInitialState()
  state = engine.startNewGame(state)
  state = engine.beginSeason(state)
  return state
}

function playSingleRound(engine, state) {
  const nextState = engine.startRound(state)
  const targetId = nextState.activeContestantIds.find((id) => id !== PLAYER_ID)
  const afterMingle = engine.resolveMingle(nextState, targetId)
  const afterBattle = engine.resolveBattle(afterMingle, targetId)
  return engine.endRound(afterBattle)
}

describe('engine round behavior', () => {
  it('applies elimination only on elimination rounds', () => {
    const scoreFn = (id) => (id === 'kanye_west' ? -999 : 100)
    const engine = createGameEngine({ computeTotalConnectionScore: scoreFn })
    let state = createStartedState(engine)

    state = playSingleRound(engine, state)
    expect(state.round).toBe(2)
    expect(state.activeContestantIds).toContain('kanye_west')

    state = playSingleRound(engine, state)
    expect(state.round).toBe(3)
    expect(state.activeContestantIds).toContain('kanye_west')

    state = playSingleRound(engine, state)
    expect(state.round).toBe(4)
    expect(state.activeContestantIds).not.toContain('kanye_west')
  })

  it('adds bombshell contestants only on bombshell rounds', () => {
    const engine = createGameEngine()
    let state = createStartedState(engine)

    state = engine.startRound(state)
    expect(state.activeContestantIds).toHaveLength(10)
    state = engine.endRound(
      engine.resolveBattle(
        engine.resolveMingle(
          state,
          state.activeContestantIds.find((id) => id !== PLAYER_ID),
        ),
        state.activeContestantIds.find((id) => id !== PLAYER_ID),
      ),
    )

    state = engine.startRound(state)
    expect(state.round).toBe(2)
    expect(state.activeContestantIds).toHaveLength(11)
  })

  it('ends the game immediately when the player is eliminated', () => {
    const scoreFn = (id) => (id === PLAYER_ID ? -1000 : 10)
    const engine = createGameEngine({ computeTotalConnectionScore: scoreFn })
    let state = createStartedState(engine)

    state = playSingleRound(engine, state)
    state = playSingleRound(engine, state)
    state = playSingleRound(engine, state)

    expect(state.phase).toBe('seasonResult')
    expect(state.gameStatus).toBe('lost')
  })
})

