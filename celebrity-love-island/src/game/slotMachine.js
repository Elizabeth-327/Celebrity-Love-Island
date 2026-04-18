import { BATTLE_STATES, getGenericMovesByState } from './data/moves'

export const SLOT_MACHINE_ROWS = 3
export const SLOT_MACHINE_COLUMNS = 3
export const SLOT_MACHINE_CENTER_ROW_INDEX = 1
export const BASE_SLOT_MACHINE_SPEED = 1
export const SLOT_MACHINE_LOSS_SPEED_MULTIPLIER = 0.8

function pickRandomState() {
  const randomIndex = Math.floor(Math.random() * BATTLE_STATES.length)
  return BATTLE_STATES[randomIndex]
}

function createRandomGrid() {
  return Array.from({ length: SLOT_MACHINE_ROWS }, () =>
    Array.from({ length: SLOT_MACHINE_COLUMNS }, () => pickRandomState()),
  )
}

function getCenterRowStates(grid) {
  return Array.from({ length: SLOT_MACHINE_COLUMNS }, (_, columnIndex) => {
    return grid[SLOT_MACHINE_CENTER_ROW_INDEX][columnIndex]
  })
}

function pickRandomMoveFromPool(pool) {
  if (pool.length === 0) {
    return null
  }

  const randomIndex = Math.floor(Math.random() * pool.length)
  return pool[randomIndex]
}

export function createInitialSlotMachineState(spinSpeed = BASE_SLOT_MACHINE_SPEED) {
  return {
    status: 'idle',
    grid: createRandomGrid(),
    spinningColumns: [false, false, false],
    stoppedColumns: 0,
    spinSpeed,
    centerMatchState: null,
    rewardMoveId: null,
    rewardMoveState: null,
  }
}

export function createActiveSlotMachineState(spinSpeed = BASE_SLOT_MACHINE_SPEED) {
  return {
    status: 'spinning',
    grid: createRandomGrid(),
    spinningColumns: [true, true, true],
    stoppedColumns: 0,
    spinSpeed,
    centerMatchState: null,
    rewardMoveId: null,
    rewardMoveState: null,
  }
}

export function spinSlotMachine(slotMachineState) {
  if (slotMachineState.status !== 'spinning') {
    return slotMachineState
  }

  const spinSpeed = Math.max(0, Math.min(1, slotMachineState.spinSpeed ?? BASE_SLOT_MACHINE_SPEED))
  const nextGrid = slotMachineState.grid.map((row, rowIndex) =>
    row.map((tileState, columnIndex) => {
      if (!slotMachineState.spinningColumns[columnIndex]) {
        return tileState
      }

      // Lower speed means fewer symbol updates per tick, which visually slows the reel.
      if (Math.random() > spinSpeed) {
        return tileState
      }

      return pickRandomState(rowIndex, columnIndex)
    }),
  )

  return {
    ...slotMachineState,
    grid: nextGrid,
  }
}

export function stopLeftmostSpinningColumn(slotMachineState) {
  if (slotMachineState.status !== 'spinning') {
    return {
      slotMachine: slotMachineState,
      allStopped: slotMachineState.status === 'resolved',
    }
  }

  const columnToStop = slotMachineState.spinningColumns.findIndex(Boolean)
  if (columnToStop === -1) {
    return {
      slotMachine: {
        ...slotMachineState,
        status: 'resolved',
      },
      allStopped: true,
    }
  }

  const nextSpinningColumns = [...slotMachineState.spinningColumns]
  nextSpinningColumns[columnToStop] = false
  const allStopped = nextSpinningColumns.every((isSpinning) => !isSpinning)

  return {
    slotMachine: {
      ...slotMachineState,
      spinningColumns: nextSpinningColumns,
      stoppedColumns: slotMachineState.stoppedColumns + 1,
      status: allStopped ? 'resolved' : 'spinning',
    },
    allStopped,
  }
}

export function resolveSlotMachineReward(slotMachineState, ownedMoveIds) {
  const centerStates = getCenterRowStates(slotMachineState.grid)
  const [first, second, third] = centerStates
  const hasMatch = first === second && second === third
  if (!hasMatch) {
    return {
      slotMachine: {
        ...slotMachineState,
        centerMatchState: null,
        rewardMoveId: null,
        rewardMoveState: null,
      },
      awardedMoveId: null,
    }
  }

  const matchingState = first
  const candidates = getGenericMovesByState(matchingState).filter(
    (move) => !ownedMoveIds.includes(move.id),
  )
  const awardedMove = pickRandomMoveFromPool(candidates)

  return {
    slotMachine: {
      ...slotMachineState,
      centerMatchState: matchingState,
      rewardMoveId: awardedMove?.id ?? null,
      rewardMoveState: matchingState,
    },
    awardedMoveId: awardedMove?.id ?? null,
  }
}
