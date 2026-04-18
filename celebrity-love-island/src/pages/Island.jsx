import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import LoveIsland from '../assets/backgrounds/island_drawn.png'
import AdjussiNakedImg from '../assets/characters/players/adjussi_naked.png'
import AhjummaNakedImg from '../assets/characters/players/ahjumma_naked.png'
import KimImg from '../assets/characters/celebs/kim_kardashian.png'
import KanyeImg from '../assets/characters/celebs/kanye_west.png'
import ArianaImg from '../assets/characters/celebs/ariana_grande.png'
import DrakeImg from '../assets/characters/celebs/drake.png'
import JustinImg from '../assets/characters/celebs/justin_bieber.png'
import KendrickImg from '../assets/characters/celebs/kendrick_lamar.png'
import KylieImg from '../assets/characters/celebs/kylie_jenner.png'
import NickiImg from '../assets/characters/celebs/nicki_minaj.png'
import SelenaImg from '../assets/characters/celebs/selena_gomez.png'
import { PLAYER_ID, getRelationshipEdgeValue } from '../game/data/contestants'

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
]

// [left, bottom, height] values that place each person on the island.
const POSITIONS = [
  { left: '8%', bottom: '14%', size: '17vh' },
  { left: '24%', bottom: '17%', size: '17vh' },
  { left: '43%', bottom: '19%', size: '17vh' },
  { left: '61%', bottom: '17%', size: '17vh' },
  { left: '77%', bottom: '14%', size: '17vh' },
  { left: '20%', bottom: '38%', size: '14vh' },
  { left: '44%', bottom: '41%', size: '14vh' },
  { left: '67%', bottom: '38%', size: '14vh' },
  { left: '34%', bottom: '57%', size: '12vh' },
  { left: '55%', bottom: '59%', size: '12vh' },
]

function buildInitialIslandGraph() {
  const graph = {
    [PLAYER_ID]: {},
  }
  const celebrityIds = CELEBRITY_NODES.map((node) => node.id)

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

export default function Island({ selectedSkin }) {
  const skin = selectedSkin ?? 'adjussi'
  const nodes = useMemo(
    () => [
      { id: PLAYER_ID, name: 'You', img: NAKED_IMGS[skin] },
      ...CELEBRITY_NODES,
    ],
    [skin],
  )
  const nodeIds = useMemo(() => nodes.map((node) => node.id), [nodes])
  const nodesById = useMemo(
    () => Object.fromEntries(nodes.map((node) => [node.id, node])),
    [nodes],
  )
  const [connectionGraph] = useState(() => buildInitialIslandGraph())
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [nodeCenters, setNodeCenters] = useState({})
  const stageRef = useRef(null)
  const nodeRefs = useRef({})

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

  const renderedEdges = useMemo(() => {
    const placedLabelRects = []

    return visibleEdges
      .map((edge, index) => {
        const fromCenter = nodeCenters[edge.fromId]
        const toCenter = nodeCenters[edge.toId]
        if (!fromCenter || !toCenter) {
          return null
        }

        const pairKey = toPairKey(edge.fromId, edge.toId)
        const isBidirectional = bidirectionalPairs.has(pairKey)
        const geometry = isBidirectional
          ? buildBidirectionalCurveGeometry({
              fromId: edge.fromId,
              toId: edge.toId,
              fromCenter,
              toCenter,
              nodeCenters,
            })
          : buildCurveGeometry(fromCenter, toCenter, 0)
        const scoreLabel = formatSignedScore(edge.score)
        const labelWidth = Math.max(38, scoreLabel.length * 8 + 14)
        const labelHeight = 18
        const { position, rect } = chooseLabelPositionOneByOne({
          geometry,
          labelWidth,
          labelHeight,
          nodeCenters,
          placedRects: placedLabelRects,
        })
        placedLabelRects.push(rect)

        const arrowPoint = getQuadraticPoint(geometry, 0.62)
        const arrowTangent = normalizeVector(getQuadraticTangent(geometry, 0.62))
        const arrowStartX = arrowPoint.x - arrowTangent.x * 7
        const arrowStartY = arrowPoint.y - arrowTangent.y * 7
        const arrowEndX = arrowPoint.x + arrowTangent.x * 9
        const arrowEndY = arrowPoint.y + arrowTangent.y * 9

        return {
          key: `${edge.fromId}-${edge.toId}-${index}`,
          geometry,
          scoreLabel,
          labelWidth,
          labelHeight,
          labelPosition: position,
          arrowStartX,
          arrowStartY,
          arrowEndX,
          arrowEndY,
        }
      })
      .filter(Boolean)
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
      <div className="island-stage" ref={stageRef}>
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
            <marker
              id="island-arrow-inline"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#a33976" />
            </marker>
          </defs>

          {renderedEdges.map((renderedEdge) => {
            return (
              <g key={renderedEdge.key} className="island-edge-group">
                <path
                  d={renderedEdge.geometry.pathD}
                  className="island-edge-path"
                  markerEnd="url(#island-arrow)"
                />
                <line
                  x1={renderedEdge.arrowStartX}
                  y1={renderedEdge.arrowStartY}
                  x2={renderedEdge.arrowEndX}
                  y2={renderedEdge.arrowEndY}
                  className="island-edge-inline-arrow"
                  markerEnd="url(#island-arrow-inline)"
                />
                <rect
                  x={renderedEdge.labelPosition.x - renderedEdge.labelWidth / 2}
                  y={renderedEdge.labelPosition.y - renderedEdge.labelHeight / 2}
                  width={renderedEdge.labelWidth}
                  height={renderedEdge.labelHeight}
                  rx="9"
                  className="island-edge-label-bg"
                />
                <text
                  x={renderedEdge.labelPosition.x}
                  y={renderedEdge.labelPosition.y}
                  className="island-edge-label"
                >
                  {renderedEdge.scoreLabel}
                </text>
              </g>
            )
          })}
        </svg>

        {nodes.map((node, index) => {
          const position = POSITIONS[index]
          const isSelected = selectedNodeId === node.id
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
              className={`island-character ${isSelected ? 'island-character--selected' : ''}`}
              style={{
                left: position.left,
                bottom: position.bottom,
                height: position.size,
                animationDelay: delay,
              }}
              onLoad={recomputeNodeCenters}
              onClick={() => setSelectedNodeId(node.id)}
            />
          )
        })}

        <div className="island-graph-status">
          {selectedNodeId
            ? `Showing connections for ${nodesById[selectedNodeId]?.name ?? selectedNodeId}`
            : 'Click a person to display connection lines and scores.'}
        </div>
        {selectedNodeId && (
          <div className="island-graph-values">
            <h3>Visible Connection Values</h3>
            <ul>
              {edgeSummaryRows.map((row) => (
                <li key={row}>{row}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
