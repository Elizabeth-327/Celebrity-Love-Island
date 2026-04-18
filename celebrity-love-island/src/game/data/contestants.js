export const PLAYER_ID = 'player'

export const CAREER_OPTIONS = [
  'actor',
  'singer',
  'athlete',
  'model',
  'comedian',
  'writer',
]

const INITIAL_CELEBRITIES = [
  {
    id: 'taylor_swift',
    name: 'Taylor Swift',
    allies: ['selena_gomez'],
    rivals: ['kanye_west'],
  },
  {
    id: 'zendaya',
    name: 'Zendaya',
    allies: ['timothee_chalamet'],
    rivals: ['drake'],
  },
  {
    id: 'timothee_chalamet',
    name: 'Timothee Chalamet',
    allies: ['zendaya'],
    rivals: ['justin_bieber'],
  },
  {
    id: 'selena_gomez',
    name: 'Selena Gomez',
    allies: ['taylor_swift'],
    rivals: ['hailey_bieber'],
  },
  {
    id: 'hailey_bieber',
    name: 'Hailey Bieber',
    allies: ['justin_bieber'],
    rivals: ['selena_gomez'],
  },
  {
    id: 'justin_bieber',
    name: 'Justin Bieber',
    allies: ['hailey_bieber'],
    rivals: ['timothee_chalamet'],
  },
  {
    id: 'kanye_west',
    name: 'Kanye West',
    allies: ['drake'],
    rivals: ['taylor_swift'],
  },
  {
    id: 'drake',
    name: 'Drake',
    allies: ['kanye_west'],
    rivals: ['zendaya'],
  },
  {
    id: 'chris_rock',
    name: 'Chris Rock',
    allies: ['drake'],
    rivals: ['kanye_west'],
  },
]

const BOMB_SHELLS = [
  {
    id: 'rihanna',
    name: 'Rihanna',
    allies: ['drake'],
    rivals: ['hailey_bieber'],
  },
  {
    id: 'bad_bunny',
    name: 'Bad Bunny',
    allies: ['zendaya'],
    rivals: ['timothee_chalamet'],
  },
  {
    id: 'dua_lipa',
    name: 'Dua Lipa',
    allies: ['taylor_swift'],
    rivals: ['selena_gomez'],
  },
  {
    id: 'sabrina_carpenter',
    name: 'Sabrina Carpenter',
    allies: ['taylor_swift'],
    rivals: ['drake'],
  },
  {
    id: 'doja_cat',
    name: 'Doja Cat',
    allies: ['justin_bieber'],
    rivals: ['kanye_west'],
  },
]

function decorateContestant(contestant, isPlayer = false) {
  return {
    ...contestant,
    isPlayer,
    status: 'active',
  }
}

export function createInitialContestants() {
  const player = decorateContestant(
    {
      id: PLAYER_ID,
      name: 'You',
      career: 'actor',
      allies: [],
      rivals: [],
    },
    true,
  )

  const celebEntries = INITIAL_CELEBRITIES.map((contestant) =>
    decorateContestant(contestant),
  )

  return [player, ...celebEntries].reduce((acc, contestant) => {
    acc[contestant.id] = contestant
    return acc
  }, {})
}

export function createBombshellQueue() {
  return BOMB_SHELLS.map((contestant) => decorateContestant(contestant))
}

