export const ACTIONS = {
  START_NEW_GAME: 'START_NEW_GAME',
  SELECT_CAREER: 'SELECT_CAREER',
  BEGIN_SEASON: 'BEGIN_SEASON',
  START_ROUND: 'START_ROUND',
  RUN_MINGLE: 'RUN_MINGLE',
  RUN_BATTLE: 'RUN_BATTLE',
  TICK_SLOT_MACHINE: 'TICK_SLOT_MACHINE',
  STOP_SLOT_MACHINE_COLUMN: 'STOP_SLOT_MACHINE_COLUMN',
  END_ROUND: 'END_ROUND',
  RESET: 'RESET',
}

export function createGameReducer(engine) {
  return function gameReducer(state, action) {
    switch (action.type) {
      case ACTIONS.START_NEW_GAME:
        return engine.startNewGame(state)
      case ACTIONS.SELECT_CAREER:
        return engine.chooseCareer(state, action.payload.career)
      case ACTIONS.BEGIN_SEASON:
        return engine.beginSeason(state)
      case ACTIONS.START_ROUND:
        return engine.startRound(state)
      case ACTIONS.RUN_MINGLE:
        return engine.resolveMingle(state, action.payload.targetId)
      case ACTIONS.RUN_BATTLE:
        return engine.resolveBattle(
          state,
          action.payload.targetId,
          action.payload.tier,
          action.payload.quoteAttempts,
        )
      case ACTIONS.TICK_SLOT_MACHINE:
        return engine.tickSlotMachine(state)
      case ACTIONS.STOP_SLOT_MACHINE_COLUMN:
        return engine.stopSlotMachineColumn(state)
      case ACTIONS.END_ROUND:
        return engine.endRound(state)
      case ACTIONS.RESET:
        return engine.createInitialState()
      default:
        return state
    }
  }
}

