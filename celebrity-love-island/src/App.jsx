import { useState } from 'react'
import './App.css'
import Intro from './pages/Intro'
import IntroduceCelebs from './pages/IntroduceCelebs'
import ChooseYourSkin from './pages/ChooseYourSkin'
import ChooseCareer from './pages/ChooseCareer'
import ChooseYourClothes from './pages/ChooseYourClothes'
import Island from './pages/Island'
import BattleDemo from './pages/BattleDemo'
import SeasonResult from './pages/SeasonResult'
import { PLAYER_ID, getRelationshipEdgeValue } from './game/data/contestants'
import { getStartingMoveIdsForCareer } from './game/data/moves'
import { SEASON_LENGTH, isBombshellRound, isEliminationRound } from './game/roundPolicy'

const STARTING_CELEBRITY_IDS = [
  'kim_kardashian',
  'kanye_west',
  'ariana_grande',
  'drake',
  'justin_bieber',
  'kendrick_lamar',
  'kylie_jenner',
  'nicki_minaj',
  'selena_gomez',
]
const BOMB_SHELL_BY_ROUND = {
  2: { id: 'erika_kirk', name: 'Erika Kirk' },
  4: { id: 'rihanna', name: 'Rihanna' },
  6: { id: 'beyonce', name: 'Beyonce' },
  8: { id: 'jay_z', name: 'Jay-Z' },
}
const CELEBRITY_NAMES_BY_ID = {
  kim_kardashian: 'Kim Kardashian',
  kanye_west: 'Kanye West',
  ariana_grande: 'Ariana Grande',
  drake: 'Drake',
  justin_bieber: 'Justin Bieber',
  kendrick_lamar: 'Kendrick Lamar',
  kylie_jenner: 'Kylie Jenner',
  nicki_minaj: 'Nicki Minaj',
  selena_gomez: 'Selena Gomez',
  erika_kirk: 'Erika Kirk',
  rihanna: 'Rihanna',
  beyonce: 'Beyonce',
  jay_z: 'Jay-Z',
}

function getBombshellForRound(roundNumber) {
  return BOMB_SHELL_BY_ROUND[roundNumber] ?? null
}

function formatContestantName(contestantId) {
  if (contestantId === PLAYER_ID) {
    return 'You'
  }
  return CELEBRITY_NAMES_BY_ID[contestantId] ?? contestantId
}

function roundTo2(value) {
  return Math.round(value * 100) / 100
}

function computeIncomingConnectionStats(contestantId, graph, activeCelebrityIds) {
  const incomingSourceIds =
    contestantId === PLAYER_ID
      ? [...activeCelebrityIds]
      : [PLAYER_ID, ...activeCelebrityIds.filter((id) => id !== contestantId)]

  let incomingSum = 0
  let strongIncomingCount = 0

  incomingSourceIds.forEach((fromId) => {
    const value = graph[fromId]?.[contestantId]
    if (typeof value !== 'number') {
      return
    }
    incomingSum += value
    if (value >= 50) {
      strongIncomingCount += 1
    }
  })

  const decayPenalty = 100 * Math.exp(-strongIncomingCount)
  const adjustedSum = incomingSum - decayPenalty

  return {
    contestantId,
    incomingSum,
    strongIncomingCount,
    decayPenalty,
    adjustedSum,
  }
}

function buildEliminationRanking(graph, activeCelebrityIds) {
  const contestantIds = [PLAYER_ID, ...activeCelebrityIds]
  return contestantIds
    .map((contestantId) =>
      computeIncomingConnectionStats(contestantId, graph, activeCelebrityIds),
    )
    .sort(
      (a, b) =>
        a.adjustedSum - b.adjustedSum ||
        a.incomingSum - b.incomingSum ||
        a.contestantId.localeCompare(b.contestantId),
    )
}

function buildFinalRanking(graph, activeCelebrityIds) {
  const contestantIds = [PLAYER_ID, ...activeCelebrityIds]
  return contestantIds
    .map((contestantId) =>
      computeIncomingConnectionStats(contestantId, graph, activeCelebrityIds),
    )
    .sort(
      (a, b) =>
        b.adjustedSum - a.adjustedSum ||
        b.incomingSum - a.incomingSum ||
        a.contestantId.localeCompare(b.contestantId),
    )
}

function removeContestantFromGraph(graph, contestantId) {
  const nextGraph = Object.fromEntries(
    Object.entries(graph).map(([fromId, outgoing]) => [fromId, { ...outgoing }]),
  )

  delete nextGraph[contestantId]
  Object.keys(nextGraph).forEach((fromId) => {
    if (
      nextGraph[fromId] &&
      Object.prototype.hasOwnProperty.call(nextGraph[fromId], contestantId)
    ) {
      delete nextGraph[fromId][contestantId]
    }
  })

  return nextGraph
}

function buildConnectionGraph(activeCelebrityIds) {
  const graph = {
    [PLAYER_ID]: {},
  }

  activeCelebrityIds.forEach((fromId) => {
    graph[fromId] = {}
    activeCelebrityIds.forEach((toId) => {
      if (fromId === toId) {
        return
      }
      graph[fromId][toId] = getRelationshipEdgeValue(fromId, toId)
    })
    graph[fromId][PLAYER_ID] = 0
  })

  return graph
}

function addBombshellToGraph(currentGraph, bombshellId, currentActiveCelebrityIds) {
  const nextGraph = Object.fromEntries(
    Object.entries(currentGraph).map(([fromId, outgoing]) => [fromId, { ...outgoing }]),
  )
  const existingCelebrityIds = [...currentActiveCelebrityIds]

  nextGraph[bombshellId] = {}
  existingCelebrityIds.forEach((existingId) => {
    nextGraph[bombshellId][existingId] = getRelationshipEdgeValue(bombshellId, existingId)
  })
  nextGraph[bombshellId][PLAYER_ID] = 0

  existingCelebrityIds.forEach((existingId) => {
    nextGraph[existingId] = nextGraph[existingId] ?? {}
    nextGraph[existingId][bombshellId] = getRelationshipEdgeValue(existingId, bombshellId)
  })

  nextGraph[PLAYER_ID] = nextGraph[PLAYER_ID] ?? {}
  return nextGraph
}

function buildInitialSeasonState() {
  const defaultMoveIds = getStartingMoveIdsForCareer('actor')
  return {
    roundNumber: 1,
    activeCelebrityIds: [...STARTING_CELEBRITY_IDS],
    connectionGraph: buildConnectionGraph(STARTING_CELEBRITY_IDS),
    playerMoveIds: defaultMoveIds.length > 0 ? defaultMoveIds : [],
    roundArrivalSummary: null,
    bombshellEventText: null,
    roundPhaseFlashMessages: [],
  }
}

function buildInitialMoveIdsForCareer(career) {
  const careerMoveIds = getStartingMoveIdsForCareer(career ?? 'actor')
  if (careerMoveIds.length > 0) {
    return careerMoveIds
  }
  return getStartingMoveIdsForCareer('actor')
}

function App() {
  const [page, setPage] = useState('intro')
  const [selectedSkin, setSelectedSkin] = useState(null)
  const [selectedCareer, setSelectedCareer] = useState(null)
  const [selectedBattleCelebrityId, setSelectedBattleCelebrityId] = useState('kim_kardashian')
  const [selectedBattleTier, setSelectedBattleTier] = useState(1)
  const [battleExitSummary, setBattleExitSummary] = useState(null)
  const [seasonResult, setSeasonResult] = useState(null)
  const [roundNumber, setRoundNumber] = useState(() => buildInitialSeasonState().roundNumber)
  const [activeCelebrityIds, setActiveCelebrityIds] = useState(
    () => buildInitialSeasonState().activeCelebrityIds,
  )
  const [connectionGraph, setConnectionGraph] = useState(
    () => buildInitialSeasonState().connectionGraph,
  )
  const [playerMoveIds, setPlayerMoveIds] = useState(
    () => buildInitialSeasonState().playerMoveIds,
  )
  const [roundArrivalSummary, setRoundArrivalSummary] = useState(
    () => buildInitialSeasonState().roundArrivalSummary,
  )
  const [bombshellEventText, setBombshellEventText] = useState(
    () => buildInitialSeasonState().bombshellEventText,
  )
  const [roundPhaseFlashMessages, setRoundPhaseFlashMessages] = useState(
    () => buildInitialSeasonState().roundPhaseFlashMessages,
  )

  const resetSeasonState = (career = 'actor') => {
    const initialState = buildInitialSeasonState()
    setRoundNumber(initialState.roundNumber)
    setActiveCelebrityIds(initialState.activeCelebrityIds)
    setConnectionGraph(initialState.connectionGraph)
    setPlayerMoveIds(buildInitialMoveIdsForCareer(career))
    setRoundArrivalSummary(initialState.roundArrivalSummary)
    setBombshellEventText(initialState.bombshellEventText)
    setRoundPhaseFlashMessages(initialState.roundPhaseFlashMessages)
    setSelectedBattleCelebrityId('kim_kardashian')
    setSelectedBattleTier(1)
    setSeasonResult(null)
  }

  const handleBattleComplete = ({ nextGraph, graphUpdateSummary, nextPlayerMoveIds }) => {
    const currentRound = roundNumber
    const nextRound = currentRound + 1
    let nextActiveCelebrityIds = [...activeCelebrityIds]
    let updatedGraph = nextGraph ?? connectionGraph
    let nextBombshellText = null
    let eliminationSummaryLine = null
    let eliminationRankingLines = []
    const nextRoundFlashMessages = []

    if (isEliminationRound(nextRound)) {
      const eliminationRanking = buildEliminationRanking(updatedGraph, nextActiveCelebrityIds)
      const eliminated = eliminationRanking[0]
      eliminationRankingLines = eliminationRanking.map((entry, index) => {
        const rankLabel = `${index + 1}. ${formatContestantName(entry.contestantId)}`
        const metrics =
          `incoming ${roundTo2(entry.incomingSum)}, strong>=50 ${entry.strongIncomingCount}, ` +
          `penalty ${roundTo2(entry.decayPenalty)}, final ${roundTo2(entry.adjustedSum)}`
        return index === 0 ? `${rankLabel} | ${metrics} <- eliminated` : `${rankLabel} | ${metrics}`
      })

      if (eliminated) {
        const eliminatedName = formatContestantName(eliminated.contestantId)
        nextRoundFlashMessages.push(`${eliminatedName} has been dumped from the island.`)
        eliminationSummaryLine =
          `Elimination: ${eliminatedName} was kicked off ` +
          `(incoming sum ${roundTo2(eliminated.incomingSum)}, strong>=50 ${eliminated.strongIncomingCount}, ` +
          `minus ${roundTo2(eliminated.decayPenalty)}, final ${roundTo2(eliminated.adjustedSum)}).`

        if (eliminated.contestantId === PLAYER_ID) {
          setBattleExitSummary({
            battleWon: false,
            targetName: 'Elimination Phase',
            targetToPlayerBefore: 'N/A',
            targetToPlayerAfter: 'N/A',
            pairings: [],
            leftOutId: null,
            logLines: [
              eliminationSummaryLine,
              'Elimination ranking (lowest to highest):',
              ...eliminationRankingLines,
              'Game over: you had the lowest elimination connection sum.',
            ],
          })
          setPage('intro')
          return
        }

        nextActiveCelebrityIds = nextActiveCelebrityIds.filter(
          (id) => id !== eliminated.contestantId,
        )
        updatedGraph = removeContestantFromGraph(updatedGraph, eliminated.contestantId)
      }
    }

    const roundBombshell = getBombshellForRound(nextRound)
    if (
      isBombshellRound(nextRound) &&
      roundBombshell &&
      !nextActiveCelebrityIds.includes(roundBombshell.id)
    ) {
      updatedGraph = addBombshellToGraph(updatedGraph, roundBombshell.id, nextActiveCelebrityIds)
      nextActiveCelebrityIds = [...nextActiveCelebrityIds, roundBombshell.id]
      nextBombshellText = `Bombshell enters: ${roundBombshell.name}!`
      nextRoundFlashMessages.push(`Bombshell enters: ${roundBombshell.name}.`)
    }

    const roundSummaryLines = [
      ...(eliminationSummaryLine ? [eliminationSummaryLine] : []),
      ...(eliminationRankingLines.length > 0
        ? ['Elimination ranking (lowest to highest):', ...eliminationRankingLines]
        : []),
      ...(graphUpdateSummary?.finalNetStepLines ?? []),
    ]
    const netCelebrityConnectionChanges = (graphUpdateSummary?.finalNetStepLines ?? []).filter(
      (entry) => {
        const key = typeof entry === 'object' && entry !== null ? entry.key : ''
        if (!key) {
          return true
        }
        return !key.startsWith(`${PLAYER_ID}-`) && !key.endsWith(`-${PLAYER_ID}`)
      },
    )

    if (currentRound >= SEASON_LENGTH) {
      const finalRanking = buildFinalRanking(updatedGraph, nextActiveCelebrityIds)
      const playerEntry = finalRanking.find((entry) => entry.contestantId === PLAYER_ID)
      const highestNonPlayerScore = finalRanking
        .filter((entry) => entry.contestantId !== PLAYER_ID)
        .reduce(
          (highest, entry) => Math.max(highest, entry.adjustedSum),
          Number.NEGATIVE_INFINITY,
        )
      const playerWon = (playerEntry?.adjustedSum ?? Number.NEGATIVE_INFINITY) > highestNonPlayerScore

      setSeasonResult({
        playerWon,
        seasonLength: SEASON_LENGTH,
        ranking: finalRanking.map((entry) => ({
          ...entry,
          name: formatContestantName(entry.contestantId),
        })),
      })
      setPage('season_result')
      return
    }

    setRoundNumber(nextRound)
    setActiveCelebrityIds(nextActiveCelebrityIds)
    setConnectionGraph(updatedGraph)
    if (Array.isArray(nextPlayerMoveIds) && nextPlayerMoveIds.length > 0) {
      setPlayerMoveIds([...new Set(nextPlayerMoveIds)])
    }
    setBombshellEventText(nextBombshellText)
    setRoundPhaseFlashMessages(nextRoundFlashMessages)
    setRoundArrivalSummary({
      round: nextRound,
      title: `Round ${nextRound} Begins`,
      edgeChanges: roundSummaryLines,
      netConnectionChanges: netCelebrityConnectionChanges,
    })
    setPage('island')
  }

  if (page === 'battle_demo') {
    return (
      <BattleDemo
        selectedBattleCelebrityId={selectedBattleCelebrityId}
        selectedBattleTier={selectedBattleTier}
        selectedCareer={selectedCareer}
        initialOwnedMoveIds={playerMoveIds}
        initialConnectionGraph={connectionGraph}
        onBattleComplete={handleBattleComplete}
        onBackToIntro={(summary) => {
          setBattleExitSummary(summary ?? null)
          setPage('intro')
        }}
      />
    )
  }

  if (page === 'introduce_celebs') {
    return <IntroduceCelebs onNext={() => setPage('choose_your_skin')} />
  }

  if (page === 'choose_your_skin') {
    return (
      <ChooseYourSkin
        onNext={(skin) => {
          setSelectedSkin(skin)
          setPage('choose_career')
        }}
      />
    )
  }

  if (page === 'choose_career') {
    return (
      <ChooseCareer
        onNext={(career) => {
          setSelectedCareer(career)
          setPage('choose_your_clothes')
        }}
      />
    )
  }

  if (page === 'choose_your_clothes') {
    return (
      <ChooseYourClothes
        selectedSkin={selectedSkin}
        onNext={() => {
          resetSeasonState(selectedCareer ?? 'actor')
          setPage('island')
        }}
      />
    )
  }

  if (page === 'island') {
    return (
      <Island
        selectedSkin={selectedSkin}
        selectedCareer={selectedCareer}
        roundNumber={roundNumber}
        seasonLength={SEASON_LENGTH}
        activeCelebrityIds={activeCelebrityIds}
        connectionGraph={connectionGraph}
        onConnectionGraphChange={setConnectionGraph}
        roundArrivalSummary={roundArrivalSummary}
        bombshellEventText={bombshellEventText}
        roundPhaseFlashMessages={roundPhaseFlashMessages}
        onDismissRoundArrivalSummary={() => setRoundArrivalSummary(null)}
        onDismissBombshellEventText={() => setBombshellEventText(null)}
        onDismissRoundPhaseFlashMessage={() => {
          setRoundPhaseFlashMessages((current) => current.slice(1))
        }}
        onStartBattle={(celebrityId, tier) => {
          if (celebrityId) {
            setSelectedBattleCelebrityId(celebrityId)
          }
          if (tier === 1 || tier === 2 || tier === 3) {
            setSelectedBattleTier(tier)
          }
          setRoundArrivalSummary(null)
          setBombshellEventText(null)
          setRoundPhaseFlashMessages([])
          setPage('battle_demo')
        }}
      />
    )
  }

  if (page === 'season_result') {
    return (
      <SeasonResult
        result={seasonResult}
        onPlayAgain={() => {
          setBattleExitSummary(null)
          setSeasonResult(null)
          setSelectedSkin(null)
          setSelectedCareer(null)
          resetSeasonState('actor')
          setPage('intro')
        }}
      />
    )
  }

  return (
    <Intro
      onStart={() => {
        setBattleExitSummary(null)
        setSeasonResult(null)
        setSelectedSkin(null)
        setSelectedCareer(null)
        resetSeasonState('actor')
        setPage('introduce_celebs')
      }}
      onSkip={() => {
        setBattleExitSummary(null)
        setSeasonResult(null)
        setSelectedSkin(null)
        setSelectedCareer(null)
        resetSeasonState('actor')
        setPage('choose_your_skin')
      }}
      battleExitSummary={battleExitSummary}
      onDismissBattleExitSummary={() => setBattleExitSummary(null)}
    />
  )
}

export default App
