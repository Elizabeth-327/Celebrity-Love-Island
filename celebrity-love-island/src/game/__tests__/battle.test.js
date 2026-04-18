import { describe, expect, it } from 'vitest'
import {
  BATTLE_TIER_CONFIG,
  createInitialBattleState,
  resolveBattleEncounter,
} from '../battle'

describe('battle ick usage', () => {
  it('does not repeat icks within a cycle', () => {
    const result = resolveBattleEncounter({
      connectionScore: 0,
      roundNumber: 1,
      targetId: 'unknown_target',
      previousBattle: createInitialBattleState(),
    })

    const names = result.battleState.lastIcksUsed.map((ick) => ick.name)
    expect(new Set(names).size).toBe(names.length)
    expect(result.battleState.lastIcksUsed.every((ick) => !ick.doubled)).toBe(true)
  })

  it('resets after all icks are used and doubles damage on reused cycle', () => {
    const first = resolveBattleEncounter({
      connectionScore: 0,
      roundNumber: 1,
      targetId: 'unknown_target',
      previousBattle: createInitialBattleState(),
    })

    const second = resolveBattleEncounter({
      connectionScore: 0,
      roundNumber: 1,
      targetId: 'unknown_target',
      previousBattle: first.battleState,
    })

    expect(second.battleState.lastIcksUsed.every((ick) => ick.doubled)).toBe(true)
    expect(second.battleState.lastIcksUsed[0].damage).toBe(
      first.battleState.lastIcksUsed[0].damage * 2,
    )
  })

  it('uses celebrity-specific icks when available', () => {
    const result = resolveBattleEncounter({
      connectionScore: 0,
      roundNumber: 2,
      targetId: 'kim_kardashian',
      previousBattle: createInitialBattleState(),
    })

    const kimIcks = new Set([
      'Puts her shoes on her bed',
      'Pimps out her daughter',
      'Married Kanye West',
      'Stole $120,000',
      'Wears Balenciaga poots',
      "Hangs out with her sister's cheating baby daddy",
      'Owns a cyber truck',
    ])

    expect(result.battleState.lastIcksUsed.length).toBe(3)
    expect(result.battleState.lastIcksUsed.every((ick) => kimIcks.has(ick.name))).toBe(true)
  })

  it('applies tier max attraction and tier-based connection deltas', () => {
    const resultByTier = [1, 2, 3].map((tier) =>
      resolveBattleEncounter({
        connectionScore: 0,
        roundNumber: 2,
        targetId: 'kim_kardashian',
        tier,
        previousBattle: createInitialBattleState(),
      }),
    )

    resultByTier.forEach((result, index) => {
      const tier = index + 1
      const config = BATTLE_TIER_CONFIG[tier]
      expect(result.battleState.tier).toBe(tier)
      expect(result.battleState.opponentMaxAttraction).toBe(config.opponentMaxAttraction)
      expect(Math.abs(result.connectionDelta)).toBe(Math.abs(config.winConnectionDelta))
      expect(result.connectionDelta).toBe(
        result.won ? config.winConnectionDelta : config.lossConnectionDelta,
      )
    })
  })

  it('scales ick damage by tier before doubled-cycle bonus', () => {
    const tier1 = resolveBattleEncounter({
      connectionScore: 0,
      roundNumber: 4,
      targetId: 'kim_kardashian',
      tier: 1,
      previousBattle: createInitialBattleState(),
    })
    const tier3 = resolveBattleEncounter({
      connectionScore: 0,
      roundNumber: 4,
      targetId: 'kim_kardashian',
      tier: 3,
      previousBattle: createInitialBattleState(),
    })

    const tier1FirstDamage = tier1.battleState.lastIcksUsed[0].damage
    const tier3FirstDamage = tier3.battleState.lastIcksUsed[0].damage

    expect(tier3FirstDamage).toBeGreaterThan(tier1FirstDamage)
    expect(tier1.battleState.lastIcksUsed[0].doubled).toBe(false)
    expect(tier3.battleState.lastIcksUsed[0].doubled).toBe(false)
  })
})
