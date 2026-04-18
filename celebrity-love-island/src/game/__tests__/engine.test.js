import { describe, expect, it, vi } from 'vitest'
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

  it('uses the chosen battle tier regardless of current round', () => {
    const engine = createGameEngine()
    let state = createStartedState(engine)

    state = engine.startRound(state)
    const targetId = state.activeContestantIds.find((id) => id !== PLAYER_ID)
    state = engine.resolveMingle(state, targetId)

    const tier3State = engine.resolveBattle(state, targetId, 3)
    expect(tier3State.battle.tier).toBe(3)
    expect(tier3State.history.some((line) => line.includes('Tier 3 battle'))).toBe(true)

    const tierDefaultState = engine.resolveBattle(
      {
        ...state,
        interactionState: {
          ...state.interactionState,
          battled: false,
        },
      },
      targetId,
      99,
    )
    expect(tierDefaultState.battle.tier).toBe(1)
    expect(tierDefaultState.history.some((line) => line.includes('Tier 1 battle'))).toBe(true)
  })

  it('excludes the battle opponent from side-battles and leaves one out when odd', () => {
    const engine = createGameEngine()
    let state = createStartedState(engine)

    // Finish round 1 so round 2 adds a bombshell and creates an odd side-battle pool
    // after excluding the chosen battle target.
    state = engine.startRound(state)
    let targetId = state.activeContestantIds.find((id) => id !== PLAYER_ID)
    state = engine.resolveMingle(state, targetId)
    state = engine.resolveBattle(state, targetId, 1)
    state = engine.endRound(state)

    state = engine.startRound(state)
    targetId = state.activeContestantIds.find((id) => id !== PLAYER_ID)
    const sideBattleCelebrityIds = state.activeContestantIds.filter(
      (id) => id !== PLAYER_ID && id !== targetId,
    )
    const expectedPairCount = Math.floor(sideBattleCelebrityIds.length / 2)

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    state = engine.resolveMingle(state, targetId)
    state = engine.resolveBattle(state, targetId, 1)
    expect(randomSpy.mock.calls.length).toBeGreaterThanOrEqual(expectedPairCount * 2)
    randomSpy.mockRestore()

    expect(state.history.at(-1)).toContain('sat out due to odd pairing')
  })
})

