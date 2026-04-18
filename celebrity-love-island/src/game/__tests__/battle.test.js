import { describe, expect, it, vi } from 'vitest'
import celebrityQuotes from '../../data/celebrity_quotes.json'
import {
  BATTLE_TIER_CONFIG,
  QUOTE_MINIGAME_TIMER_SECONDS,
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

  it('creates a quote challenge before each opponent ick with 1 correct and 2 decoys', () => {
    const targetId = 'kim_kardashian'
    const targetQuotePool = celebrityQuotes[targetId]
    const result = resolveBattleEncounter({
      connectionScore: 0,
      roundNumber: 2,
      targetId,
      tier: 1,
      previousBattle: createInitialBattleState(),
    })

    expect(result.battleState.lastQuoteChallenges).toHaveLength(3)

    result.battleState.lastQuoteChallenges.forEach((challenge) => {
      expect(challenge.targetId).toBe(targetId)
      expect(challenge.options).toHaveLength(3)
      expect(new Set(challenge.options).size).toBe(3)
      expect(challenge.correctOptionIndex).toBeGreaterThanOrEqual(0)
      expect(challenge.correctOptionIndex).toBeLessThan(3)
      expect(challenge.timerSeconds).toBe(QUOTE_MINIGAME_TIMER_SECONDS)
      expect(challenge.outcome).toBe('timeout')
      expect(challenge.won).toBe(false)

      const correctQuote = challenge.options[challenge.correctOptionIndex]
      expect(targetQuotePool).toContain(correctQuote)

      const decoys = challenge.options.filter(
        (_, optionIndex) => optionIndex !== challenge.correctOptionIndex,
      )
      decoys.forEach((quote) => {
        expect(targetQuotePool).not.toContain(quote)
      })
    })
  })

  it('halves ick damage when quote minigame is answered correctly within 30 seconds', () => {
    const targetId = 'kim_kardashian'
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    const baseline = resolveBattleEncounter({
      connectionScore: 0,
      roundNumber: 4,
      targetId,
      tier: 1,
      previousBattle: createInitialBattleState(),
    })

    const winningAttempts = baseline.battleState.lastQuoteChallenges.map((challenge) => ({
      selectedOptionIndex: challenge.correctOptionIndex,
      responseTimeSeconds: 10,
    }))

    const withWins = resolveBattleEncounter({
      connectionScore: 0,
      roundNumber: 4,
      targetId,
      tier: 1,
      previousBattle: createInitialBattleState(),
      quoteAttempts: winningAttempts,
    })
    randomSpy.mockRestore()

    withWins.battleState.lastIcksUsed.forEach((ick, index) => {
      expect(ick.quoteMinigameWon).toBe(true)
      expect(ick.quoteMinigameOutcome).toBe('win')
      expect(ick.damage).toBe(Math.max(1, Math.round(baseline.battleState.lastIcksUsed[index].damage / 2)))
    })
  })

  it('treats answers after 30 seconds as timeout and does not halve damage', () => {
    const targetId = 'kim_kardashian'
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
    const baseline = resolveBattleEncounter({
      connectionScore: 0,
      roundNumber: 5,
      targetId,
      tier: 1,
      previousBattle: createInitialBattleState(),
    })

    const lateAttempts = baseline.battleState.lastQuoteChallenges.map((challenge) => ({
      selectedOptionIndex: challenge.correctOptionIndex,
      responseTimeSeconds: QUOTE_MINIGAME_TIMER_SECONDS + 1,
    }))

    const timedOut = resolveBattleEncounter({
      connectionScore: 0,
      roundNumber: 5,
      targetId,
      tier: 1,
      previousBattle: createInitialBattleState(),
      quoteAttempts: lateAttempts,
    })
    randomSpy.mockRestore()

    timedOut.battleState.lastQuoteChallenges.forEach((challenge) => {
      expect(challenge.outcome).toBe('timeout')
      expect(challenge.won).toBe(false)
    })

    timedOut.battleState.lastIcksUsed.forEach((ick, index) => {
      expect(ick.quoteMinigameOutcome).toBe('timeout')
      expect(ick.quoteMinigameWon).toBe(false)
      expect(ick.damage).toBe(baseline.battleState.lastIcksUsed[index].damage)
    })
  })
})
