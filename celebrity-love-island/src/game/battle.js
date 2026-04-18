import celebrityIcks from '../data/icks.json'

const DEFAULT_BATTLE_STATE = 'neutral'
const STARTING_ENERGY = 100
const BASE_PLAYER_ATTRACTION_MAX = 100
const ICK_DAMAGE_SCALE = 0.32

export const BATTLE_TIER_CONFIG = {
  1: {
    tier: 1,
    opponentMaxAttraction: 100,
    ickDamageScale: 1,
    winConnectionDelta: 50,
    lossConnectionDelta: -50,
  },
  2: {
    tier: 2,
    opponentMaxAttraction: 200,
    ickDamageScale: 1.5,
    winConnectionDelta: 75,
    lossConnectionDelta: -75,
  },
  3: {
    tier: 3,
    opponentMaxAttraction: 300,
    ickDamageScale: 2,
    winConnectionDelta: 100,
    lossConnectionDelta: -100,
  },
}

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

const DEFAULT_ICKS = [
  { name: 'Gives dry one-word answers', power: 20 },
  { name: 'Never laughs at your jokes', power: 24 },
  { name: 'Talks about their ex nonstop', power: 28 },
]

export function getBattleTierConfig(tier = 1) {
  return BATTLE_TIER_CONFIG[tier] ?? BATTLE_TIER_CONFIG[1]
}

export function createInitialBattleState() {
  return {
    phase: 'idle',
    lastTargetId: null,
    lastResult: null,
    tier: 1,
    opponentState: DEFAULT_BATTLE_STATE,
    playerMaxAttraction: BASE_PLAYER_ATTRACTION_MAX,
    opponentMaxAttraction: BATTLE_TIER_CONFIG[1].opponentMaxAttraction,
    playerMeter: 50,
    opponentMeter: 50,
    energy: STARTING_ENERGY,
    cooldowns: {
      flirt: 0,
      banter: 0,
      deepTalk: 0,
    },
    ickTrackerByTarget: {},
    lastIcksUsed: [],
  }
}

function normalizeTargetKey(targetId) {
  return String(targetId).trim().toLowerCase().replace(/\s+/g, '_')
}

function getIckPoolForTarget(targetId) {
  const normalizedTarget = normalizeTargetKey(targetId)
  const pool = celebrityIcks[normalizedTarget]
  if (!Array.isArray(pool) || pool.length === 0) {
    return DEFAULT_ICKS
  }

  return pool
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

function chooseIckForTurn({
  targetId,
  ickTrackerByTarget,
  roundNumber,
  turnIndex,
}) {
  const ickPool = getIckPoolForTarget(targetId)
  const tracker = ickTrackerByTarget[targetId] ?? {
    usedThisCycle: [],
    completedCycles: 0,
  }

  let usedThisCycle = [...tracker.usedThisCycle]
  let completedCycles = tracker.completedCycles
  let availableIcks = ickPool.filter((ick) => !usedThisCycle.includes(ick.name))

  if (availableIcks.length === 0) {
    usedThisCycle = []
    completedCycles += 1
    availableIcks = [...ickPool]
  }

  const seed = roundNumber + turnIndex + targetId.length + usedThisCycle.length
  const selectedIck = availableIcks[seed % availableIcks.length]
  const nextUsedThisCycle = [...usedThisCycle, selectedIck.name]
  const isDoubled = completedCycles > 0

  return {
    selectedIck,
    isDoubled,
    nextIckTrackerByTarget: {
      ...ickTrackerByTarget,
      [targetId]: {
        usedThisCycle: nextUsedThisCycle,
        completedCycles,
      },
    },
  }
}

function resolveIckDamage({
  ick,
  isDoubled,
  connectionScore,
  tierConfig,
}) {
  const baseDamage = Math.max(3, Math.round(ick.power * ICK_DAMAGE_SCALE))
  const connectionMitigation = Math.round(connectionScore / 40)
  const adjustedDamage = Math.max(2, baseDamage - connectionMitigation)
  const tierScaledDamage = Math.max(
    2,
    Math.round(adjustedDamage * tierConfig.ickDamageScale),
  )
  return isDoubled ? tierScaledDamage * 2 : tierScaledDamage
}

export function resolveBattleEncounter({
  connectionScore,
  roundNumber,
  targetId,
  tier = 1,
  previousBattle,
}) {
  const normalizedConnectionScore = connectionScore ?? 0
  const tierConfig = getBattleTierConfig(tier)

  let cooldowns = decrementCooldowns(previousBattle.cooldowns)
  let energy = previousBattle.energy
  const playerMaxAttraction = BASE_PLAYER_ATTRACTION_MAX
  let playerMeter = Math.round(playerMaxAttraction * 0.85)
  let opponentMeter = Math.round(tierConfig.opponentMaxAttraction * 0.45)
  let opponentState = previousBattle.opponentState ?? DEFAULT_BATTLE_STATE
  let ickTrackerByTarget = previousBattle.ickTrackerByTarget ?? {}
  const ickLog = []

  for (let turn = 0; turn < 3; turn += 1) {
    const move = pickMove(cooldowns, energy, turn)
    const damage = resolveMoveDamage(move, opponentState)
    opponentMeter = Math.min(
      tierConfig.opponentMaxAttraction,
      opponentMeter + Math.round(damage / 2),
    )
    energy = Math.max(0, energy - move.energyCost)
    cooldowns[move.id] = move.cooldown
    opponentState = move.inflictsState

    const ickTurn = chooseIckForTurn({
      targetId,
      ickTrackerByTarget,
      roundNumber,
      turnIndex: turn,
    })
    ickTrackerByTarget = ickTurn.nextIckTrackerByTarget
    const rebuttal = resolveIckDamage({
      ick: ickTurn.selectedIck,
      isDoubled: ickTurn.isDoubled,
      connectionScore: normalizedConnectionScore,
      tierConfig,
    })
    playerMeter = Math.max(0, playerMeter - rebuttal)
    ickLog.push({
      name: ickTurn.selectedIck.name,
      power: ickTurn.selectedIck.power,
      damage: rebuttal,
      doubled: ickTurn.isDoubled,
    })
  }

  const deterministicSwing = (roundNumber + targetId.length) % 7
  const tierPenalty = tierConfig.tier * 3
  const won = opponentMeter + deterministicSwing >= playerMeter + 10 + tierPenalty
  const connectionDelta = won
    ? tierConfig.winConnectionDelta
    : tierConfig.lossConnectionDelta

  return {
    won,
    connectionDelta,
    delta: connectionDelta,
    battleState: {
      phase: 'resolved',
      tier: tierConfig.tier,
      lastTargetId: targetId,
      lastResult: won ? 'win' : 'loss',
      opponentState,
      playerMaxAttraction,
      opponentMaxAttraction: tierConfig.opponentMaxAttraction,
      playerMeter,
      opponentMeter,
      energy,
      cooldowns,
      ickTrackerByTarget,
      lastIcksUsed: ickLog,
    },
  }
}
