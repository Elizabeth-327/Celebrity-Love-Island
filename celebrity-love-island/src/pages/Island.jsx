import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TypingText from '../components/TypingText'
import LoveIsland from '../assets/backgrounds/island_drawn.png'
import AdjussiNakedImg from '../assets/characters/players/adjussi_naked.png'
import AhjummaNakedImg from '../assets/characters/players/ahjumma_naked.png'
import KimImg from '../assets/characters/chibi_celebs/kim_kardashian_chibi.png'
import KanyeImg from '../assets/characters/chibi_celebs/kanye_west_chibi.png'
import ArianaImg from '../assets/characters/chibi_celebs/ariana_grande_chibi.png'
import DrakeImg from '../assets/characters/chibi_celebs/drake_chibi.png'
import JustinImg from '../assets/characters/chibi_celebs/justin_bieber_chibi.png'
import KendrickImg from '../assets/characters/chibi_celebs/kendrick_lamar_chibi.png'
import KylieImg from '../assets/characters/chibi_celebs/kylie_jenner_chibi.png'
import NickiImg from '../assets/characters/chibi_celebs/nicki_minaj_chibi.png'
import SelenaImg from '../assets/characters/chibi_celebs/selena_gomez_chibi.png'
import ErikaImg from '../assets/characters/chibi_celebs/erika_kirk_chibi.png'
import RihannaImg from '../assets/characters/celebs/rihanna.png'
import BeyonceImg from '../assets/characters/chibi_celebs/beyonce_chibi.png'
import JayZImg from '../assets/characters/chibi_celebs/jay_z_chibi.png'
import { PLAYER_ID, getRelationshipEdgeValue } from '../game/data/contestants'

const MAX_DUMMY_CHATS = 2
const BATTLE_TIERS = [1, 2, 3]
const BATTLE_DIFFICULTY_LABELS = {
  1: 'Easy',
  2: 'Medium',
  3: 'Hard',
}

const NAKED_IMGS = {
  adjussi: AdjussiNakedImg,
  ahjumma: AhjummaNakedImg,
}

const CELEBRITY_NODES = [
  { id: 'kim_kardashian', name: 'Kim Kardashian', img: KimImg },
  { id: 'kanye_west', name: 'Kanye West', img: KanyeImg },
  { id: 'ariana_grande', name: 'Ariana Grande', img: ArianaImg },
  { id: 'drake', name: 'Drake', img: DrakeImg },
  { id: 'justin_bieber', name: 'Justin Bieber', img: JustinImg },
  { id: 'kendrick_lamar', name: 'Kendrick Lamar', img: KendrickImg },
  { id: 'kylie_jenner', name: 'Kylie Jenner', img: KylieImg },
  { id: 'nicki_minaj', name: 'Nicki Minaj', img: NickiImg },
  { id: 'selena_gomez', name: 'Selena Gomez', img: SelenaImg },
  { id: 'erika_kirk', name: 'Erika Kirk', img: ErikaImg },
  { id: 'rihanna', name: 'Rihanna', img: RihannaImg },
  { id: 'beyonce', name: 'Beyonce', img: BeyonceImg },
  { id: 'jay_z', name: 'Jay-Z', img: JayZImg },
]
const CELEBRITY_NODE_LOOKUP = Object.fromEntries(
  CELEBRITY_NODES.map((node) => [node.id, node]),
)
const BOMB_SHELL_IDS = ['erika_kirk', 'rihanna', 'beyonce', 'jay_z']
const DEFAULT_ACTIVE_CELEBRITY_IDS = CELEBRITY_NODES
  .map((node) => node.id)
  .filter((id) => !BOMB_SHELL_IDS.includes(id))

// cx/cy/rx/ry must stay in sync with computePositions below
const ELLIPSE = { cx: 44, cy: 60, rx: 42, ry: 23 }

function getSumTagTransform(nodeCenter, stageEl) {
  if (!stageEl) return 'translate(-50%, -50%)'
  const { cx, cy, rx, ry } = ELLIPSE
  const normDx = (nodeCenter.x - cx / 100 * stageEl.offsetWidth) / (rx / 100 * stageEl.offsetWidth)
  const normDy = (nodeCenter.y - cy / 100 * stageEl.offsetHeight) / (ry / 100 * stageEl.offsetHeight)
  const sideGap = '12px'
  const vertGap = '70px'
  if (Math.abs(normDy) >= Math.abs(normDx)) {
    return normDy > 0
      ? `translate(-50%, ${vertGap})`                        // bottom → tag below
      : `translate(-50%, calc(-100% - ${vertGap}))`          // top → tag above
  }
  return normDx < 0
    ? `translate(calc(-100% - ${sideGap}), -50%)`            // left → tag to left
    : `translate(${sideGap}, -50%)`                          // right → tag to right
}

function computePositions(n) {
  const { cx, cy, rx, ry } = ELLIPSE

  // For 11 nodes: 3 bottom, 2 left, 3 top, 3 right — avoids stacking on the sides
  const ANGLES_11 = [90, 110, 150, 210, 250, 270, 290, 330, 0, 30, 70].map(d => d * Math.PI / 180)
  // For 10 nodes: player(0)/Kim(1)/Selena(9) bottom cluster; Drake(4)/Justin(5)/Kendrick(6) top cluster
  const ANGLES_10 = [90, 105, 155, 235, 255, 270, 285, 305, 15, 75].map(d => d * Math.PI / 180)

  const angles = n === 11
    ? ANGLES_11
    : n === 10
    ? ANGLES_10
    : Array.from({ length: n }, (_, i) => Math.PI / 2 + i * ((2 * Math.PI) / n))

  const topClusterIndices = n === 10 ? new Set([4, 5, 6]) : new Set()

  return angles.map((angle, i) => {
    const left = cx + rx * Math.cos(angle)
    const top  = cy + ry * Math.sin(angle)
    const baseBottom = 100 - top
    const extraBottom = topClusterIndices.has(i) ? 8 : 0
    return { left: `${left.toFixed(1)}%`, bottom: `calc(${(baseBottom).toFixed(1)}% + ${extraBottom}vh)`, size: '22vh' }
  })
}

function buildInitialIslandGraph(activeCelebrityIds = DEFAULT_ACTIVE_CELEBRITY_IDS) {
  const graph = {
    [PLAYER_ID]: {},
  }
  const celebrityIds = [...activeCelebrityIds]

  celebrityIds.forEach((fromId) => {
    graph[fromId] = {}
    celebrityIds.forEach((toId) => {
      if (fromId === toId) {
        return
      }
      graph[fromId][toId] = getRelationshipEdgeValue(fromId, toId)
    })
    graph[fromId][PLAYER_ID] = 0
  })

  return graph
}

function buildVisibleEdges(selectedNodeId, nodeIds, graph) {
  if (!selectedNodeId) {
    return []
  }

  if (selectedNodeId === PLAYER_ID) {
    return nodeIds
      .filter((id) => id !== PLAYER_ID)
      .map((celebrityId) => ({
        fromId: celebrityId,
        toId: PLAYER_ID,
        score: graph[celebrityId]?.[PLAYER_ID] ?? 0,
      }))
  }

  const visibleEdges = []
  const others = nodeIds.filter((id) => id !== selectedNodeId)

  others.forEach((otherId) => {
    const outgoing = graph[selectedNodeId]?.[otherId]
    if (typeof outgoing === 'number') {
      visibleEdges.push({
        fromId: selectedNodeId,
        toId: otherId,
        score: outgoing,
      })
    }

    const incoming = graph[otherId]?.[selectedNodeId]
    if (typeof incoming === 'number') {
      visibleEdges.push({
        fromId: otherId,
        toId: selectedNodeId,
        score: incoming,
      })
    }
  })

  return visibleEdges
}

function toPairKey(a, b) {
  return [a, b].sort().join('|')
}

function buildCurveGeometry(from, to, offset = 0) {
  const deltaX = to.x - from.x
  const deltaY = to.y - from.y
  const distance = Math.hypot(deltaX, deltaY) || 1
  const normalX = -deltaY / distance
  const normalY = deltaX / distance
  const controlX = (from.x + to.x) / 2 + normalX * offset
  const controlY = (from.y + to.y) / 2 + normalY * offset
  const labelX = 0.25 * from.x + 0.5 * controlX + 0.25 * to.x
  const labelY = 0.25 * from.y + 0.5 * controlY + 0.25 * to.y

  return {
    fromX: from.x,
    fromY: from.y,
    controlX,
    controlY,
    toX: to.x,
    toY: to.y,
    pathD: `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`,
    labelX,
    labelY,
  }
}

function getPairNormal(centerA, centerB) {
  const deltaX = centerB.x - centerA.x
  const deltaY = centerB.y - centerA.y
  const distance = Math.hypot(deltaX, deltaY) || 1
  return {
    x: -deltaY / distance,
    y: deltaX / distance,
  }
}

function buildBidirectionalCurveGeometry({
  fromId,
  toId,
  fromCenter,
  toCenter,
  nodeCenters,
  offsetMagnitude = 32,
}) {
  const [firstId, secondId] = [fromId, toId].sort()
  const firstCenter = nodeCenters[firstId]
  const secondCenter = nodeCenters[secondId]

  if (!firstCenter || !secondCenter) {
    return buildCurveGeometry(fromCenter, toCenter, 0)
  }

  const normal = getPairNormal(firstCenter, secondCenter)
  const followsSortedDirection = fromId === firstId && toId === secondId
  const offsetSign = followsSortedDirection ? 1 : -1
  const controlX = (fromCenter.x + toCenter.x) / 2 + normal.x * offsetMagnitude * offsetSign
  const controlY = (fromCenter.y + toCenter.y) / 2 + normal.y * offsetMagnitude * offsetSign
  const labelX = 0.25 * fromCenter.x + 0.5 * controlX + 0.25 * toCenter.x
  const labelY = 0.25 * fromCenter.y + 0.5 * controlY + 0.25 * toCenter.y

  return {
    fromX: fromCenter.x,
    fromY: fromCenter.y,
    controlX,
    controlY,
    toX: toCenter.x,
    toY: toCenter.y,
    pathD: `M ${fromCenter.x} ${fromCenter.y} Q ${controlX} ${controlY} ${toCenter.x} ${toCenter.y}`,
    labelX,
    labelY,
  }
}

function getQuadraticPoint(geometry, t) {
  const mt = 1 - t
  return {
    x:
      mt * mt * geometry.fromX +
      2 * mt * t * geometry.controlX +
      t * t * geometry.toX,
    y:
      mt * mt * geometry.fromY +
      2 * mt * t * geometry.controlY +
      t * t * geometry.toY,
  }
}

function getQuadraticTangent(geometry, t) {
  const mt = 1 - t
  return {
    x:
      2 * mt * (geometry.controlX - geometry.fromX) +
      2 * t * (geometry.toX - geometry.controlX),
    y:
      2 * mt * (geometry.controlY - geometry.fromY) +
      2 * t * (geometry.toY - geometry.controlY),
  }
}

function normalizeVector(vector) {
  const magnitude = Math.hypot(vector.x, vector.y) || 1
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
  }
}

function getSpriteClearance(point, nodeCenters) {
  const centers = Object.values(nodeCenters)
  if (centers.length === 0) {
    return Infinity
  }

  return centers.reduce((minimum, center) => {
    const distance = Math.hypot(point.x - center.x, point.y - center.y)
    return Math.min(minimum, distance)
  }, Infinity)
}

function rectanglesOverlap(rectA, rectB, padding = 0) {
  return !(
    rectA.right + padding < rectB.left ||
    rectA.left - padding > rectB.right ||
    rectA.bottom + padding < rectB.top ||
    rectA.top - padding > rectB.bottom
  )
}

function getCurveLabelCandidates(geometry, nodeCenters) {
  const candidates = []
  const sampleCount = 36
  const startT = 0.12
  const endT = 0.88

  for (let i = 0; i <= sampleCount; i += 1) {
    const t = startT + ((endT - startT) * i) / sampleCount
    const point = getQuadraticPoint(geometry, t)
    const spriteClearance = getSpriteClearance(point, nodeCenters)
    candidates.push({
      x: point.x,
      y: point.y,
      spriteClearance,
    })
  }

  candidates.sort((a, b) => b.spriteClearance - a.spriteClearance)
  return candidates
}

function chooseLabelPositionOneByOne({
  geometry,
  labelWidth,
  labelHeight,
  nodeCenters,
  placedRects,
}) {
  const candidates = getCurveLabelCandidates(geometry, nodeCenters)
  let bestFallback = null

  for (const candidate of candidates) {
    const rect = {
      left: candidate.x - labelWidth / 2,
      top: candidate.y - labelHeight / 2,
      right: candidate.x + labelWidth / 2,
      bottom: candidate.y + labelHeight / 2,
    }
    const overlapCount = placedRects.reduce((count, placedRect) => {
      return count + (rectanglesOverlap(rect, placedRect, 6) ? 1 : 0)
    }, 0)

    if (overlapCount === 0) {
      return {
        position: { x: candidate.x, y: candidate.y },
        rect,
      }
    }

    if (
      !bestFallback ||
      overlapCount < bestFallback.overlapCount ||
      (overlapCount === bestFallback.overlapCount &&
        candidate.spriteClearance > bestFallback.spriteClearance)
    ) {
      bestFallback = {
        position: { x: candidate.x, y: candidate.y },
        rect,
        overlapCount,
        spriteClearance: candidate.spriteClearance,
      }
    }
  }

  if (bestFallback) {
    return {
      position: bestFallback.position,
      rect: bestFallback.rect,
    }
  }

  return {
    position: { x: geometry.labelX, y: geometry.labelY },
    rect: {
      left: geometry.labelX - labelWidth / 2,
      top: geometry.labelY - labelHeight / 2,
      right: geometry.labelX + labelWidth / 2,
      bottom: geometry.labelY + labelHeight / 2,
    },
  }
}

function formatSignedScore(value) {
  if (value > 0) {
    return `+${value}`
  }
  return String(value)
}

function getBattleDifficultyLabel(tier) {
  return BATTLE_DIFFICULTY_LABELS[tier] ?? BATTLE_DIFFICULTY_LABELS[1]
}

function roundTo2(value) {
  return Math.round(value * 100) / 100
}

function computeConnectionSum(contestantId, graph, activeCelebrityIds) {
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
  return roundTo2(incomingSum - decayPenalty)
}

export default function Island({
  selectedSkin,
  showIntro = false,
  roundNumber = 1,
  seasonLength = 8,
  activeCelebrityIds = DEFAULT_ACTIVE_CELEBRITY_IDS,
  connectionGraph: externalConnectionGraph,
  roundArrivalSummary,
  bombshellEventText,
  roundPhaseFlashMessages = [],
  chatState,
  roundChatLog = [],
  onDismissRoundArrivalSummary,
  onDismissBombshellEventText,
  onDismissRoundPhaseFlashMessage,
  onStartChat,
  onStartBattle,
}) {
  const skin = selectedSkin ?? 'adjussi'
  const nodes = useMemo(
    () => [
      { id: PLAYER_ID, name: 'You', img: NAKED_IMGS[skin] },
      ...activeCelebrityIds
        .map((id) => CELEBRITY_NODE_LOOKUP[id])
        .filter(Boolean),
    ],
    [activeCelebrityIds, skin],
  )
  const nodeIds = useMemo(() => nodes.map((node) => node.id), [nodes])
  const nodesById = useMemo(
    () => Object.fromEntries(nodes.map((node) => [node.id, node])),
    [nodes],
  )
  const fallbackConnectionGraph = useMemo(
    () => buildInitialIslandGraph(activeCelebrityIds),
    [activeCelebrityIds],
  )
  const chatsUsedThisRound = chatState?.chatsUsedThisRound ?? 0
  const maxChatsPerRound = chatState?.maxChatsPerRound ?? MAX_DUMMY_CHATS
  const chattedCelebrityIds = chatState?.chattedCelebrityIdsThisRound ?? []
  const [introPhase, setIntroPhase] = useState(showIntro ? 'typing' : 'done') // 'typing' | 'fading' | 'done'
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [hasClickedCelebrity, setHasClickedCelebrity] = useState(false)
  const [dummyChatPhase, setDummyChatPhase] = useState('chatting')
  const [selectedBattleTargetId, setSelectedBattleTargetId] = useState(null)
  const [selectedBattleTier, setSelectedBattleTier] = useState(null)
  const [showConnectionChanges, setShowConnectionChanges] = useState(false)
  const [isIslandUiCollapsed, setIsIslandUiCollapsed] = useState(false)
  const [nodeCenters, setNodeCenters] = useState({})
  const stageRef = useRef(null)
  const nodeRefs = useRef({})
  const connectionGraph = externalConnectionGraph ?? fallbackConnectionGraph
  const chatsRemaining = Math.max(0, maxChatsPerRound - chatsUsedThisRound)
  const positions = useMemo(() => computePositions(nodes.length), [nodes.length])

  const handleDummyChat = useCallback((celebrityId) => {
    if (celebrityId === PLAYER_ID || !activeCelebrityIds.includes(celebrityId)) {
      return
    }

    if (dummyChatPhase !== 'chatting') {
      return
    }
    if (chatsUsedThisRound >= maxChatsPerRound) {
      return
    }
    if (chattedCelebrityIds.includes(celebrityId)) {
      return
    }

    setSelectedNodeId(celebrityId)
    onStartChat?.(celebrityId)
  }, [
    activeCelebrityIds,
    chattedCelebrityIds,
    chatsUsedThisRound,
    dummyChatPhase,
    maxChatsPerRound,
    onStartChat,
  ])

  const handleNodeClick = useCallback((nodeId) => {
    setSelectedNodeId(nodeId)
    if (nodeId !== PLAYER_ID) {
      setHasClickedCelebrity(true)
    }

    if (
      dummyChatPhase === 'select_battle' &&
      nodeId !== PLAYER_ID &&
      activeCelebrityIds.includes(nodeId)
    ) {
      if (selectedBattleTargetId !== nodeId) {
        setSelectedBattleTier(null)
      }
      setSelectedBattleTargetId(nodeId)
    }
  }, [activeCelebrityIds, dummyChatPhase, selectedBattleTargetId])

  useEffect(() => {
    if (chatsUsedThisRound >= maxChatsPerRound) {
      setDummyChatPhase('select_battle')
    }
  }, [chatsUsedThisRound, maxChatsPerRound])

  const recomputeNodeCenters = useCallback(() => {
    if (!stageRef.current) {
      return
    }

    const stageRect = stageRef.current.getBoundingClientRect()
    const centers = {}
    nodes.forEach((node) => {
      const element = nodeRefs.current[node.id]
      if (!element) {
        return
      }
      const rect = element.getBoundingClientRect()
      centers[node.id] = {
        x: rect.left - stageRect.left + rect.width / 2,
        y: rect.top - stageRect.top + rect.height / 2,
      }
    })
    setNodeCenters(centers)
  }, [nodes])

  useEffect(() => {
    setDummyChatPhase('chatting')
    setSelectedBattleTargetId(null)
    setSelectedBattleTier(null)
    setShowConnectionChanges(false)
    setHasClickedCelebrity(false)
  }, [roundNumber, activeCelebrityIds])

  useEffect(() => {
    recomputeNodeCenters()
    window.addEventListener('resize', recomputeNodeCenters)
    return () => {
      window.removeEventListener('resize', recomputeNodeCenters)
    }
  }, [recomputeNodeCenters])

  const visibleEdges = useMemo(
    () => buildVisibleEdges(selectedNodeId, nodeIds, connectionGraph),
    [connectionGraph, nodeIds, selectedNodeId],
  )

  const bidirectionalPairs = useMemo(() => {
    const pairSet = new Set()
    visibleEdges.forEach((edge) => {
      const hasReverse = visibleEdges.some(
        (candidate) => candidate.fromId === edge.toId && candidate.toId === edge.fromId,
      )
      if (hasReverse) {
        pairSet.add(toPairKey(edge.fromId, edge.toId))
      }
    })
    return pairSet
  }, [visibleEdges])

  const edgeSummaryRows = useMemo(() => {
    return visibleEdges
      .map((edge) => {
        const fromName = nodesById[edge.fromId]?.name ?? edge.fromId
        const toName = nodesById[edge.toId]?.name ?? edge.toId
        return `${fromName} -> ${toName}: ${formatSignedScore(edge.score)}`
      })
      .sort((a, b) => a.localeCompare(b))
  }, [nodesById, visibleEdges])

  const selectedConnectionSum = useMemo(() => {
    if (!selectedNodeId) {
      return null
    }

    return computeConnectionSum(selectedNodeId, connectionGraph, activeCelebrityIds)
  }, [activeCelebrityIds, connectionGraph, selectedNodeId])

  const selectedNodeCenter = selectedNodeId ? nodeCenters[selectedNodeId] : null
  const shouldShowFirstRoundGuidance =
    roundNumber === 1 && (dummyChatPhase === 'chatting' || dummyChatPhase === 'select_battle')
  const islandStatusMessage = useMemo(() => {
    if (dummyChatPhase === 'chatting') {
      if (!hasClickedCelebrity) {
        return 'Click a celebrity to view their connections.'
      }
      return `Double click a celebrity to chat to them. Chats remaining: ${chatsRemaining}.`
    }

    if (dummyChatPhase === 'select_battle') {
      if (!selectedBattleTargetId) {
        return 'Select a celebrity you want to form a relationship with.'
      }
      if (!selectedBattleTier) {
        return 'Select difficulty.'
      }
      return 'Click Battle.'
    }

    if (selectedNodeId) {
      return `Showing connections for ${nodesById[selectedNodeId]?.name ?? selectedNodeId}`
    }

    return 'Click a person to display connection lines and scores.'
  }, [
    chatsRemaining,
    dummyChatPhase,
    hasClickedCelebrity,
    nodesById,
    selectedBattleTargetId,
    selectedNodeId,
  ])

  const renderedEdges = useMemo(() => {
    const processedPairs = new Set()
    const result = []

    function inlineArrow(geometry, t, reverse) {
      const point = getQuadraticPoint(geometry, t)
      const tangent = normalizeVector(getQuadraticTangent(geometry, t))
      const dx = reverse ? -tangent.x : tangent.x
      const dy = reverse ? -tangent.y : tangent.y
      return {
        x1: point.x - dx * 7, y1: point.y - dy * 7,
        x2: point.x + dx * 9, y2: point.y + dy * 9,
      }
    }

    visibleEdges.forEach((edge) => {
      const pairKey = toPairKey(edge.fromId, edge.toId)
      if (processedPairs.has(pairKey)) return
      processedPairs.add(pairKey)

      const fromCenter = nodeCenters[edge.fromId]
      const toCenter = nodeCenters[edge.toId]
      if (!fromCenter || !toCenter) return

      const geometry = buildCurveGeometry(fromCenter, toCenter, 0)
      const normal = getPairNormal(fromCenter, toCenter)
      const labelOffset = 16
      const isBidirectional = bidirectionalPairs.has(pairKey)

      // Forward arrow at t=0.75, label beside it
      const fwdArrow = inlineArrow(geometry, 0.75, false)
      const fwdPt = getQuadraticPoint(geometry, 0.75)
      const forwardLabel = {
        text: formatSignedScore(edge.score),
        x: fwdPt.x + normal.x * labelOffset,
        y: fwdPt.y + normal.y * labelOffset,
      }

      let revArrow = null
      let reverseLabel = null
      if (isBidirectional) {
        const reverseEdge = visibleEdges.find(
          (e) => e.fromId === edge.toId && e.toId === edge.fromId,
        )
        if (reverseEdge) {
          revArrow = inlineArrow(geometry, 0.25, true)
          const revPt = getQuadraticPoint(geometry, 0.25)
          reverseLabel = {
            text: formatSignedScore(reverseEdge.score),
            x: revPt.x + normal.x * labelOffset,
            y: revPt.y + normal.y * labelOffset,
          }
        }
      }

      result.push({ key: pairKey, geometry, fwdArrow, revArrow, forwardLabel, reverseLabel })
    })

    return result
  }, [bidirectionalPairs, nodeCenters, visibleEdges])

  return (
    <div
      className="app"
      style={{
        backgroundImage: `url(${LoveIsland})`,
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
      }}
    >
      <div className="island-stage" ref={stageRef} onClick={() => setSelectedNodeId(null)}>
        {introPhase === 'typing' && (
          <div
            className="island-intro-text"
            style={{ opacity: 1, transition: 'opacity 0.8s ease' }}
          >
            <TypingText
              text="It's time to start the game! Mingle with other contestants."
              speed={50}
              onDone={() => {
                setTimeout(() => setIntroPhase('fading'), 800)
                setTimeout(() => setIntroPhase('done'), 1800)
              }}
            />
          </div>
        )}
        {introPhase === 'fading' && (
          <div
            className="island-intro-text"
            style={{ opacity: 0, transition: 'opacity 0.8s ease' }}
          />
        )}

        <div
          className="island-round-tracker"
          style={{ opacity: introPhase === 'done' ? 1 : 0, transition: 'opacity 0.6s ease' }}
        >
          Round {roundNumber} / {seasonLength} &nbsp;|&nbsp; Chats left: {chatsRemaining}
        </div>
        <svg className="island-graph-overlay">
          <defs>
            <marker
              id="island-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#8f2a66" />
            </marker>
          </defs>

          {renderedEdges.map((renderedEdge) => (
            <g key={renderedEdge.key} className="island-edge-group">
              <path d={renderedEdge.geometry.pathD} className="island-edge-path" />
              <line {...renderedEdge.fwdArrow} className="island-edge-inline-arrow" markerEnd="url(#island-arrow)" />
              {renderedEdge.revArrow && (
                <line {...renderedEdge.revArrow} className="island-edge-inline-arrow" markerEnd="url(#island-arrow)" />
              )}
              <text x={renderedEdge.forwardLabel.x} y={renderedEdge.forwardLabel.y} className="island-edge-label">
                {renderedEdge.forwardLabel.text}
              </text>
              {renderedEdge.reverseLabel && (
                <text x={renderedEdge.reverseLabel.x} y={renderedEdge.reverseLabel.y} className="island-edge-label">
                  {renderedEdge.reverseLabel.text}
                </text>
              )}
            </g>
          ))}
        </svg>

        {nodes.map((node, index) => {
          const position = positions[index]
          const isSelected = selectedNodeId === node.id
          const isBattleTarget =
            dummyChatPhase === 'select_battle' && selectedBattleTargetId === node.id
          const delay = `${(index * 0.18).toFixed(2)}s`

          return (
            <img
              key={node.id}
              src={node.img}
              alt={node.name}
              ref={(element) => {
                if (element) {
                  nodeRefs.current[node.id] = element
                } else {
                  delete nodeRefs.current[node.id]
                }
              }}
              className={`island-character ${isSelected ? 'island-character--selected' : ''} ${isBattleTarget ? 'island-character--battle-target' : ''}`}
              style={{
                left: position.left,
                bottom: position.bottom,
                height: position.size,
                width: 'auto',
                minWidth: '9vw',
                animationDelay: delay,
              }}
              onLoad={recomputeNodeCenters}
              onClick={(e) => { e.stopPropagation(); handleNodeClick(node.id) }}
              onDoubleClick={(e) => { e.stopPropagation(); handleDummyChat(node.id) }}
            />
          )
        })}
        {selectedNodeId &&
          selectedNodeCenter &&
          selectedConnectionSum !== null && (
            <div
              className="island-connection-sum-tag"
              style={{
                left: `${selectedNodeCenter.x}px`,
                top: `${selectedNodeCenter.y}px`,
                transform: getSumTagTransform(selectedNodeCenter, stageRef.current),
              }}
            >
              {(nodesById[selectedNodeId]?.name ?? selectedNodeId)} sum: {formatSignedScore(selectedConnectionSum)}
            </div>
        )}

        {!isIslandUiCollapsed && (
          <>
            {shouldShowFirstRoundGuidance && (
              <div
                className="island-guidance"
                style={{ opacity: introPhase === 'done' ? 1 : 0, transition: 'opacity 0.6s ease' }}
              >
                <p>CLICK contestants to view connections</p>
                <p>DOUBLE-CLICK to have conversation with celeb</p>
              </div>
            )}
            {/* Visible Connection Values panel hidden */}
          </>
        )}

        {!isIslandUiCollapsed && (
          <div className="dummy-chat-panel" onClick={(event) => event.stopPropagation()}>
            {dummyChatPhase === 'chatting' ? (
              <>
                <p>Chats remaining: {chatsRemaining}</p>
                {chattedCelebrityIds.length > 0 && (
                  <p>
                    Chatted this round: {chattedCelebrityIds
                      .map((id) => nodesById[id]?.name ?? id)
                      .join(', ')}
                  </p>
                )}
                <button
                  className="dummy-chat-battle-btn"
                  onClick={() => setDummyChatPhase('select_battle')}
                >
                  Finish Chatting & Choose Battle Opponent
                </button>
              </>
            ) : (
              <>
                <h3>Select Celebrity To Battle</h3>
                <p>Click a celebrity sprite to select who you want to form a relationship with.</p>
                <p>
                  Selected: {selectedBattleTargetId ? (nodesById[selectedBattleTargetId]?.name ?? selectedBattleTargetId) : 'None'}
                </p>
                <div className="dummy-chat-tier-selector">
                  {BATTLE_TIERS.map((tier) => {
                    const isSelected = selectedBattleTier === tier
                    return (
                      <button
                      key={tier}
                      className={`dummy-chat-btn ${isSelected ? 'dummy-chat-btn--selected' : ''}`}
                      disabled={!selectedBattleTargetId}
                      onClick={() => setSelectedBattleTier(tier)}
                    >
                      {getBattleDifficultyLabel(tier)}
                      </button>
                    )
                  })}
                </div>
                <button
                  className="dummy-chat-battle-btn"
                  disabled={!selectedBattleTargetId || !selectedBattleTier}
                  onClick={() => onStartBattle?.(selectedBattleTargetId, selectedBattleTier)}
                >
                  Battle
                </button>
              </>
            )}
            {roundArrivalSummary && (
              <div className="round-connection-summary-toggle">
                <button
                  className="dummy-chat-battle-btn"
                  onClick={() => setShowConnectionChanges((current) => !current)}
                >
                  {showConnectionChanges ? 'Hide Connections Changes' : 'Connections Changes'}
                </button>
              </div>
            )}
            {roundArrivalSummary && showConnectionChanges && (
              <div className="round-arrival-summary">
                <div className="round-arrival-summary-head">
                  <h4>{roundArrivalSummary.title ?? `Round ${roundNumber} Summary`}</h4>
                  <button onClick={() => setShowConnectionChanges(false)}>Close</button>
                </div>
                <p>Net connection changes between celebrities from the last battle:</p>
                <ul>
                  {(roundArrivalSummary.netConnectionChanges ?? []).map((entry, index) => (
                    <li key={`${entry.key ?? entry.line ?? 'edge'}-${index}`}>
                      {entry.line ?? String(entry)}
                    </li>
                  ))}
                  {(roundArrivalSummary.netConnectionChanges ?? []).length === 0 && (
                    <li>No celebrity-to-celebrity net changes were recorded.</li>
                  )}
                </ul>
              </div>
            )}
            {bombshellEventText && (
              <div className="round-bombshell-entry">
                <span>{bombshellEventText}</span>
                <button onClick={() => onDismissBombshellEventText?.()}>Dismiss</button>
              </div>
            )}
            {roundChatLog.length > 0 && (
              <ul className="dummy-chat-log">
                {roundChatLog.map((line, index) => (
                  <li key={`${line}-${index}`}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {roundPhaseFlashMessages.length > 0 && (
          <div className="round-phase-flash-overlay">
            <div className="round-phase-flash-card">
              <p>{roundPhaseFlashMessages[0]}</p>
              <button onClick={() => onDismissRoundPhaseFlashMessage?.()}>
                {roundPhaseFlashMessages.length > 1 ? 'Next' : 'Continue'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
