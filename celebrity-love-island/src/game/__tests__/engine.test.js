import { describe, expect, it, vi } from 'vitest'
import { PLAYER_ID } from '../data/contestants'
import { MOVE_POOL_BY_ID } from '../data/moves'
import { createGameEngine } from '../engine'
import { BASE_SLOT_MACHINE_SPEED, SLOT_MACHINE_LOSS_SPEED_MULTIPLIER } from '../slotMachine'

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
  const afterSlot1 = engine.stopSlotMachineColumn(afterBattle)
  const afterSlot2 = engine.stopSlotMachineColumn(afterSlot1)
  const afterSlot3 = engine.stopSlotMachineColumn(afterSlot2)
  return engine.endRound(afterSlot3)
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
      engine.stopSlotMachineColumn(
        engine.stopSlotMachineColumn(
          engine.stopSlotMachineColumn(
            engine.resolveBattle(
              engine.resolveMingle(
                state,
                state.activeContestantIds.find((id) => id !== PLAYER_ID),
              ),
              state.activeContestantIds.find((id) => id !== PLAYER_ID),
            ),
          ),
        ),
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
    state = engine.stopSlotMachineColumn(state)
    state = engine.stopSlotMachineColumn(state)
    state = engine.stopSlotMachineColumn(state)
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
    state = engine.stopSlotMachineColumn(state)
    state = engine.stopSlotMachineColumn(state)
    state = engine.stopSlotMachineColumn(state)
    expect(randomSpy.mock.calls.length).toBeGreaterThanOrEqual(expectedPairCount * 2)
    randomSpy.mockRestore()

    expect(state.history.some((line) => line.includes('sat out due to odd pairing'))).toBe(true)
  })

  it('requires resolving the slot machine before ending the round', () => {
    const engine = createGameEngine()
    let state = createStartedState(engine)

    state = engine.startRound(state)
    const targetId = state.activeContestantIds.find((id) => id !== PLAYER_ID)
    state = engine.resolveMingle(state, targetId)
    state = engine.resolveBattle(state, targetId, 1)

    const blockedEndState = engine.endRound(state)
    expect(blockedEndState.round).toBe(state.round)

    state = engine.stopSlotMachineColumn(state)
    state = engine.stopSlotMachineColumn(state)
    state = engine.stopSlotMachineColumn(state)
    const endedState = engine.endRound(state)
    expect(endedState.round).toBe(2)
  })

  it('awards a generic move when slot machine center row matches', () => {
    const engine = createGameEngine()
    let state = createStartedState(engine)

    state = engine.startRound(state)
    const targetId = state.activeContestantIds.find((id) => id !== PLAYER_ID)
    state = engine.resolveMingle(state, targetId)
    state = engine.resolveBattle(state, targetId, 1)

    state = {
      ...state,
      slotMachine: {
        ...state.slotMachine,
        status: 'spinning',
        grid: [
          ['sad', 'neutral', 'lonely'],
          ['excited', 'excited', 'excited'],
          ['annoyed', 'embarrassed', 'nervous'],
        ],
        spinningColumns: [true, true, true],
        stoppedColumns: 0,
      },
    }

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    state = engine.stopSlotMachineColumn(state)
    state = engine.stopSlotMachineColumn(state)
    state = engine.stopSlotMachineColumn(state)
    randomSpy.mockRestore()

    expect(state.slotMachine.status).toBe('resolved')
    expect(state.slotMachine.centerMatchState).toBe('excited')
    expect(state.slotMachine.rewardMoveId).toBeTruthy()
    expect(state.playerMoveIds).toContain(state.slotMachine.rewardMoveId)
    expect(MOVE_POOL_BY_ID[state.slotMachine.rewardMoveId].state).toBe('excited')
  })

  it('slows slot speed after losses and resets speed/count after a win', () => {
    const engine = createGameEngine()
    let state = createStartedState(engine)

    state = engine.startRound(state)
    let targetId = state.activeContestantIds.find((id) => id !== PLAYER_ID)
    state = engine.resolveMingle(state, targetId)
    state = engine.resolveBattle(state, targetId, 1)

    state = {
      ...state,
      slotMachine: {
        ...state.slotMachine,
        status: 'spinning',
        grid: [
          ['sad', 'neutral', 'lonely'],
          ['excited', 'nervous', 'excited'],
          ['annoyed', 'embarrassed', 'nervous'],
        ],
        spinningColumns: [true, true, true],
      },
    }

    state = engine.stopSlotMachineColumn(state)
    state = engine.stopSlotMachineColumn(state)
    state = engine.stopSlotMachineColumn(state)

    expect(state.slotMachineLossesSinceLastWin).toBe(1)
    expect(state.slotMachineSpeed).toBe(
      Number((BASE_SLOT_MACHINE_SPEED * SLOT_MACHINE_LOSS_SPEED_MULTIPLIER).toFixed(4)),
    )

    state = engine.endRound(state)
    state = engine.startRound(state)
    targetId = state.activeContestantIds.find((id) => id !== PLAYER_ID)
    state = engine.resolveMingle(state, targetId)
    state = engine.resolveBattle(state, targetId, 1)

    expect(state.slotMachine.spinSpeed).toBe(
      Number((BASE_SLOT_MACHINE_SPEED * SLOT_MACHINE_LOSS_SPEED_MULTIPLIER).toFixed(4)),
    )

    state = {
      ...state,
      slotMachine: {
        ...state.slotMachine,
        status: 'spinning',
        grid: [
          ['sad', 'neutral', 'lonely'],
          ['excited', 'excited', 'excited'],
          ['annoyed', 'embarrassed', 'nervous'],
        ],
        spinningColumns: [true, true, true],
      },
    }

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    state = engine.stopSlotMachineColumn(state)
    state = engine.stopSlotMachineColumn(state)
    state = engine.stopSlotMachineColumn(state)
    randomSpy.mockRestore()

    expect(state.slotMachine.centerMatchState).toBe('excited')
    expect(state.slotMachineLossesSinceLastWin).toBe(0)
    expect(state.slotMachineSpeed).toBe(BASE_SLOT_MACHINE_SPEED)
  })
})

