import relationshipMatrix from '../../data/celebrity_relationships.json'

const RELATIONSHIP_NAME_KEY = ''
const INITIAL_CELEBRITY_COUNT = 9

export const PLAYER_ID = 'player'

export const CAREER_OPTIONS = [
  'actor',
  'singer',
  'athlete',
  'model',
  'construction worker',
  'fast food worker',
]

function toContestantId(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const CELEBRITY_ROWS = relationshipMatrix.filter(
  (row) => typeof row[RELATIONSHIP_NAME_KEY] === 'string' && row[RELATIONSHIP_NAME_KEY].trim(),
)

const CELEBRITY_NAMES = CELEBRITY_ROWS.map((row) => row[RELATIONSHIP_NAME_KEY].trim())

const NAME_TO_ID = Object.fromEntries(
  CELEBRITY_NAMES.map((name) => [name, toContestantId(name)]),
)

const ID_TO_NAME = Object.fromEntries(
  Object.entries(NAME_TO_ID).map(([name, id]) => [id, name]),
)

const RELATIONSHIP_GRAPH_BY_ID = Object.fromEntries(
  CELEBRITY_ROWS.map((row) => {
    const sourceName = row[RELATIONSHIP_NAME_KEY].trim()
    const sourceId = NAME_TO_ID[sourceName]
    const edges = {}

    Object.entries(row).forEach(([targetName, edgeValue]) => {
      if (
        targetName === RELATIONSHIP_NAME_KEY ||
        targetName === sourceName ||
        typeof edgeValue !== 'number'
      ) {
        return
      }

      const targetId = NAME_TO_ID[targetName]
      if (!targetId) {
        return
      }

      edges[targetId] = edgeValue
    })

    return [sourceId, edges]
  }),
)

function deriveAlliesAndRivals(contestantId) {
  const entries = Object.entries(RELATIONSHIP_GRAPH_BY_ID[contestantId] ?? {})

  const allies = entries
    .filter(([, value]) => value >= 40)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([id]) => id)

  const rivals = entries
    .filter(([, value]) => value <= -25)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)
    .map(([id]) => id)

  return { allies, rivals }
}

function createCelebrityContestantFromId(id) {
  const { allies, rivals } = deriveAlliesAndRivals(id)
  return {
    id,
    name: ID_TO_NAME[id] ?? id,
    allies,
    rivals,
    isPlayer: false,
    status: 'active',
  }
}

function createPlayerContestant() {
  return {
    id: PLAYER_ID,
    name: 'You',
    career: CAREER_OPTIONS[0],
    allies: [],
    rivals: [],
    isPlayer: true,
    status: 'active',
  }
}

export function getRelationshipEdgeValue(fromId, toId) {
  return RELATIONSHIP_GRAPH_BY_ID[fromId]?.[toId] ?? 0
}

export function createInitialContestants() {
  const startingCelebrities = CELEBRITY_NAMES
    .slice(0, INITIAL_CELEBRITY_COUNT)
    .map((name) => NAME_TO_ID[name])
    .map((id) => createCelebrityContestantFromId(id))

  return [createPlayerContestant(), ...startingCelebrities].reduce((acc, contestant) => {
    acc[contestant.id] = contestant
    return acc
  }, {})
}

export function createBombshellQueue() {
  return CELEBRITY_NAMES
    .slice(INITIAL_CELEBRITY_COUNT)
    .map((name) => NAME_TO_ID[name])
    .map((id) => createCelebrityContestantFromId(id))
}

