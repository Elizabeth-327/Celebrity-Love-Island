const DEFAULT_BATTLE_STATE = 'neutral'
const MAX_METER = 100
const STARTING_ENERGY = 100

const MOVE_SET = {
  flirt: {
    id: 'flirt',
    basePower: 16,
    energyCost: 15,
    cooldown: 1,
    stateBonus: { lonely: 8, nervous: 5 },
    inflictsState: 'excited',
  },
  banter: {
    id: 'banter',
    basePower: 12,
    energyCost: 10,
    cooldown: 1,
    stateBonus: { annoyed: 9, neutral: 4 },
    inflictsState: 'embarrassed',
  },
  deepTalk: {
    id: 'deepTalk',
    basePower: 20,
    energyCost: 25,
    cooldown: 2,
    stateBonus: { sad: 10, lonely: 6 },
    inflictsState: 'nervous',
  },
}

export function createInitialBattleState() {
  return {
    phase: 'idle',
    lastTargetId: null,
    lastResult: null,
    opponentState: DEFAULT_BATTLE_STATE,
    playerMeter: 50,
    opponentMeter: 50,
    energy: STARTING_ENERGY,
    cooldowns: {
      flirt: 0,
      banter: 0,
      deepTalk: 0,
    },
  }
}

function decrementCooldowns(cooldowns) {
  return Object.fromEntries(
    Object.entries(cooldowns).map(([moveId, value]) => [moveId, Math.max(value - 1, 0)]),
  )
}

function pickMove(cooldowns, energy, turnIndex) {
  const orderedMoves = [MOVE_SET.deepTalk, MOVE_SET.flirt, MOVE_SET.banter]
  const shifted = orderedMoves.slice(turnIndex).concat(orderedMoves.slice(0, turnIndex))

  return (
    shifted.find(
      (move) => cooldowns[move.id] === 0 && energy >= move.energyCost,
    ) ?? MOVE_SET.banter
  )
}

function resolveMoveDamage(move, opponentState) {
  const bonus = move.stateBonus[opponentState] ?? 0
  return move.basePower + bonus
}

export function resolveBattleEncounter({
  attractionScore,
  roundNumber,
  targetId,
  previousBattle,
}) {
  let cooldowns = decrementCooldowns(previousBattle.cooldowns)
  let energy = previousBattle.energy
  let playerMeter = 45
  let opponentMeter = 55
  let opponentState = previousBattle.opponentState ?? DEFAULT_BATTLE_STATE

  for (let turn = 0; turn < 3; turn += 1) {
    const move = pickMove(cooldowns, energy, turn)
    const damage = resolveMoveDamage(move, opponentState)
    opponentMeter = Math.min(MAX_METER, opponentMeter + Math.round(damage / 2))
    energy = Math.max(0, energy - move.energyCost)
    cooldowns[move.id] = move.cooldown
    opponentState = move.inflictsState

    const rebuttal = Math.max(5, 14 - Math.round(attractionScore / 25))
    playerMeter = Math.max(0, playerMeter - rebuttal)
  }

  const deterministicSwing = (roundNumber + targetId.length) % 7
  const won = opponentMeter + deterministicSwing >= playerMeter + 10

  return {
    won,
    delta: won ? 14 : -10,
    battleState: {
      phase: 'resolved',
      lastTargetId: targetId,
      lastResult: won ? 'win' : 'loss',
      opponentState,
      playerMeter,
      opponentMeter,
      energy,
      cooldowns,
    },
  }
}

