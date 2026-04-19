import { useEffect, useMemo, useState } from 'react'
import TypingText from '../components/TypingText'
import chatVillaBg from '../assets/backgrounds/love-island-usa-season-7-villa.png'
import AdjussiNakedImg from '../assets/characters/players/adjussi_naked.png'
import AhjummaNakedImg from '../assets/characters/players/ahjumma_naked.png'
import speechBubbleImg from '../assets/speech_bubble.png'
import nametagImg from '../assets/nametag.png'
import {
  KimImg,
  KanyeImg,
  ArianaImg,
  DrakeImg,
  JustinImg,
  KendrickImg,
  KylieImg,
  NickiImg,
  SelenaImg,
  ErikaImg,
  RihannaImg,
  BeyonceImg,
  JayZImg,
} from '../assets/characters/chibi_celebs'
import celebrityDialogues from '../data/celebrity_dialogues.json'

const DEFAULT_CHAT_CELEBRITY_ID = 'kim_kardashian'
const CELEBRITY_RESPONSE_DELAY_MS = 2200
const PLAYER_SPRITES = {
  adjussi: AdjussiNakedImg,
  ahjumma: AhjummaNakedImg,
}

const CELEBRITY_CONFIG = {
  kim_kardashian: { name: 'Kim Kardashian', sprite: KimImg },
  kanye_west: { name: 'Kanye West', sprite: KanyeImg },
  ariana_grande: { name: 'Ariana Grande', sprite: ArianaImg },
  drake: { name: 'Drake', sprite: DrakeImg },
  justin_bieber: { name: 'Justin Bieber', sprite: JustinImg },
  kendrick_lamar: { name: 'Kendrick Lamar', sprite: KendrickImg },
  kylie_jenner: { name: 'Kylie Jenner', sprite: KylieImg },
  nicki_minaj: { name: 'Nicki Minaj', sprite: NickiImg },
  selena_gomez: { name: 'Selena Gomez', sprite: SelenaImg },
  erika_kirk: { name: 'Erika Kirk', sprite: ErikaImg },
  rihanna: { name: 'Rihanna', sprite: RihannaImg },
  beyonce: { name: 'Beyonce', sprite: BeyonceImg },
  jay_z: { name: 'Jay-Z', sprite: JayZImg },
}

function toChoiceLabel(choiceKey) {
  return String(choiceKey)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function buildFallbackDialogue(celebrityName) {
  return {
    intro: `Hey, I'm ${celebrityName}. What's your vibe?`,
    firstChoices: [
      {
        key: 'hit_on',
        playerLine: `I'm trying to get to know you, ${celebrityName}.`,
        celebrityLine: `Okay, you're getting my attention.`,
        scoreDelta: 2,
        followUps: [
          {
            key: 'double_down',
            playerLine: "Let's keep this energy going.",
            celebrityFinal: "Alright, let's see where this goes.",
            scoreDelta: 2,
          },
          {
            key: 'joke',
            playerLine: "I promise I'm funnier after one more line.",
            celebrityFinal: "I'll allow it this once.",
            scoreDelta: 0,
          },
          {
            key: 'introduce_yourself',
            playerLine: 'I came here to make real connections.',
            celebrityFinal: "Respect. That's what this is about.",
            scoreDelta: 1,
          },
        ],
      },
      {
        key: 'joke',
        playerLine: 'So... should we pretend this is not awkward?',
        celebrityLine: "It's a little awkward, yeah.",
        scoreDelta: -1,
        followUps: [
          {
            key: 'damage_control',
            playerLine: "Fair. Let me reset and try again.",
            celebrityFinal: 'Better.',
            scoreDelta: 1,
          },
          {
            key: 'hit_on',
            playerLine: "You're still the best person in this villa to me.",
            celebrityFinal: 'That helped.',
            scoreDelta: 2,
          },
          {
            key: 'introduce_yourself',
            playerLine: "I'm here for chemistry, not chaos.",
            celebrityFinal: "We'll see if you mean that.",
            scoreDelta: 0,
          },
        ],
      },
      {
        key: 'introduce_yourself',
        playerLine: "I'm here to make a serious connection.",
        celebrityLine: "Okay, I'm listening.",
        scoreDelta: 1,
        followUps: [
          {
            key: 'double_down',
            playerLine: 'I want to focus on us this round.',
            celebrityFinal: "That's bold. I respect it.",
            scoreDelta: 2,
          },
          {
            key: 'hit_on',
            playerLine: "And yes, I definitely think you're attractive.",
            celebrityFinal: 'Smooth.',
            scoreDelta: 1,
          },
          {
            key: 'joke',
            playerLine: "Also I panic-joke when I'm nervous.",
            celebrityFinal: "At least you're honest.",
            scoreDelta: 0,
          },
        ],
      },
    ],
  }
}

function normalizeDialogueTree(celebrityId, celebrityName) {
  const raw = celebrityDialogues?.[celebrityId]
  if (!raw || typeof raw !== 'object') {
    return buildFallbackDialogue(celebrityName)
  }

  const rawFirstChoices =
    raw.first_choices && typeof raw.first_choices === 'object' ? raw.first_choices : {}

  const firstChoices = Object.entries(rawFirstChoices)
    .map(([firstChoiceKey, firstChoiceValue]) => {
      if (!firstChoiceValue || typeof firstChoiceValue !== 'object') {
        return null
      }

      const celebrityResponse =
        firstChoiceValue.celebrity_response && typeof firstChoiceValue.celebrity_response === 'object'
          ? firstChoiceValue.celebrity_response
          : null
      if (!celebrityResponse) {
        return null
      }

      const rawFollowUps =
        celebrityResponse.follow_up && typeof celebrityResponse.follow_up === 'object'
          ? celebrityResponse.follow_up
          : {}

      const followUps = Object.entries(rawFollowUps)
        .map(([followUpKey, followUpValue]) => {
          if (!followUpValue || typeof followUpValue !== 'object') {
            return null
          }

          return {
            key: followUpKey,
            playerLine: String(followUpValue.player_line ?? ''),
            celebrityFinal: String(followUpValue.celebrity_final ?? ''),
            scoreDelta: toNumber(followUpValue.score_delta, 0),
          }
        })
        .filter(Boolean)

      if (followUps.length === 0) {
        return null
      }

      return {
        key: firstChoiceKey,
        playerLine: String(firstChoiceValue.player_line ?? ''),
        celebrityLine: String(celebrityResponse.celebrity_line ?? ''),
        scoreDelta: toNumber(celebrityResponse.score_delta, 0),
        followUps,
      }
    })
    .filter(Boolean)

  if (firstChoices.length === 0) {
    return buildFallbackDialogue(celebrityName)
  }

  return {
    intro: String(raw.intro ?? `Hey, I'm ${celebrityName}.`),
    firstChoices,
  }
}

export default function ChatScreen({
  celebrityId = DEFAULT_CHAT_CELEBRITY_ID,
  selectedSkin = 'adjussi',
  onComplete,
}) {
  const playerSprite = PLAYER_SPRITES[selectedSkin] ?? PLAYER_SPRITES.adjussi
  const chatCelebrityId = CELEBRITY_CONFIG[celebrityId]
    ? celebrityId
    : DEFAULT_CHAT_CELEBRITY_ID
  const chatCelebrity = CELEBRITY_CONFIG[chatCelebrityId]
  const dialogueTree = useMemo(
    () => normalizeDialogueTree(chatCelebrityId, chatCelebrity.name),
    [chatCelebrityId, chatCelebrity.name],
  )

  const [phase, setPhase] = useState('pick_first')
  const [selectedFirstChoice, setSelectedFirstChoice] = useState(null)
  const [selectedFollowUp, setSelectedFollowUp] = useState(null)
  const [totalDelta, setTotalDelta] = useState(0)
  const [playerLineTyped, setPlayerLineTyped] = useState(false)

  useEffect(() => {
    setPhase('pick_first')
    setSelectedFirstChoice(null)
    setSelectedFollowUp(null)
    setTotalDelta(0)
    setPlayerLineTyped(false)
  }, [dialogueTree, chatCelebrityId])

  useEffect(() => {
    if (!playerLineTyped) {
      return undefined
    }
    if (phase !== 'waiting_first' && phase !== 'waiting_follow') {
      return undefined
    }

    const timeout = window.setTimeout(() => {
      if (phase === 'waiting_first') {
        setPhase('pick_follow')
      } else if (phase === 'waiting_follow') {
        setPhase('done')
      }
    }, CELEBRITY_RESPONSE_DELAY_MS)

    return () => window.clearTimeout(timeout)
  }, [phase, playerLineTyped])

  const signedDelta = totalDelta > 0 ? `+${totalDelta}` : String(totalDelta)
  const celebrityBubbleText =
    phase === 'pick_first' || phase === 'waiting_first'
      ? dialogueTree.intro
      : (phase === 'pick_follow' || phase === 'waiting_follow') && selectedFirstChoice
        ? selectedFirstChoice.celebrityLine
        : phase === 'done' && selectedFollowUp
          ? selectedFollowUp.celebrityFinal
          : dialogueTree.intro
  const playerBubbleText = selectedFollowUp
    ? selectedFollowUp.playerLine
    : selectedFirstChoice
      ? selectedFirstChoice.playerLine
      : ''
  const celebrityBubbleKey =
    phase === 'pick_first' || phase === 'waiting_first'
      ? `celeb-intro-${chatCelebrityId}`
      : (phase === 'pick_follow' || phase === 'waiting_follow') && selectedFirstChoice
        ? `celeb-follow-${selectedFirstChoice.key}`
        : phase === 'done' && selectedFollowUp
          ? `celeb-done-${selectedFollowUp.key}`
          : `celeb-fallback-${chatCelebrityId}`
  const playerBubbleKey = selectedFollowUp
    ? `player-follow-${selectedFollowUp.key}`
    : selectedFirstChoice
      ? `player-first-${selectedFirstChoice.key}`
      : `player-none-${chatCelebrityId}`

  const handleChooseFirst = (choice) => {
    if (!choice || phase !== 'pick_first') {
      return
    }

    setSelectedFirstChoice(choice)
    setTotalDelta(choice.scoreDelta)
    setPlayerLineTyped(false)
    setPhase('waiting_first')
  }

  const handleChooseFollowUp = (followUp) => {
    if (!followUp || phase !== 'pick_follow' || !selectedFirstChoice) {
      return
    }

    setSelectedFollowUp(followUp)
    setTotalDelta((current) => current + followUp.scoreDelta)
    setPlayerLineTyped(false)
    setPhase('waiting_follow')
  }

  const handleFinishChat = () => {
    if (phase !== 'done') {
      return
    }

    const firstLabel = selectedFirstChoice ? toChoiceLabel(selectedFirstChoice.key) : 'N/A'
    const followLabel = selectedFollowUp ? toChoiceLabel(selectedFollowUp.key) : 'N/A'
    onComplete?.({
      celebrityId: chatCelebrityId,
      totalDelta,
      transcriptSummary: `${firstLabel} -> ${followLabel}`,
    })
  }

  return (
    <div className="chat-screen">
      <div className="chat-screen-bg" style={{ backgroundImage: `url(${chatVillaBg})` }} />
      <div className="chat-overlay" />

      {phase === 'done' && (
        <button className="chat-back-btn" onClick={handleFinishChat}>
          ←
        </button>
      )}

      <div className="chat-celebrity-header">
        <img src={nametagImg} className="chat-nametag-bg" alt="" aria-hidden="true" />
        <div className="chat-nametag-content">
          <h2><span className="chat-celebrity-header-label">Chat with </span>{chatCelebrity.name}</h2>
          {phase === 'done' && (
            <p className="chat-celebrity-header-delta">Net Connection Change: {signedDelta}</p>
          )}
        </div>
      </div>

      <img
        className="chat-celebrity-sprite"
        src={chatCelebrity.sprite}
        alt={`${chatCelebrity.name} sprite`}
      />
      <div className="chat-bubble chat-bubble--celebrity">
        <img src={speechBubbleImg} className="chat-bubble-bg" alt="" aria-hidden="true" />
        <div className="chat-bubble-content">
          <TypingText
            key={celebrityBubbleKey}
            className="chat-bubble-text"
            text={celebrityBubbleText}
            speed={16}
          />
        </div>
      </div>
      <img className="chat-player-sprite" src={playerSprite} alt="Player sprite" />
      <div className="chat-bubble chat-bubble--player">
        <img src={speechBubbleImg} className="chat-bubble-bg chat-bubble-bg--flip" alt="" aria-hidden="true" />
        <div className="chat-bubble-content">
          <TypingText
            key={playerBubbleKey}
            className="chat-bubble-text"
            text={playerBubbleText}
            speed={20}
            onDone={
              (phase === 'waiting_first' || phase === 'waiting_follow') && playerBubbleText
                ? () => setPlayerLineTyped(true)
                : undefined
            }
          />
        </div>
      </div>

      {(phase === 'pick_first' || phase === 'pick_follow') && (
        <div className="chat-choice-strip">
          <p className="chat-choice-title">
            {phase === 'pick_first' ? 'Choose a reply type' : 'Choose a follow-up type'}
          </p>
          <div className="chat-choice-buttons">
            {phase === 'pick_first' &&
              dialogueTree.firstChoices.map((choice) => (
                <button
                  key={choice.key}
                  className="chat-option-btn"
                  onClick={() => handleChooseFirst(choice)}
                >
                  {toChoiceLabel(choice.key)}
                </button>
              ))}
            {phase === 'pick_follow' &&
              selectedFirstChoice?.followUps.map((followUp) => (
                <button
                  key={followUp.key}
                  className="chat-option-btn"
                  onClick={() => handleChooseFollowUp(followUp)}
                >
                  {toChoiceLabel(followUp.key)}
                </button>
              ))}
          </div>
        </div>
      )}

      {(phase === 'waiting_first' || phase === 'waiting_follow') && (
        <div className="chat-choice-strip">
          <p className="chat-choice-title">Waiting for response...</p>
        </div>
      )}

    </div>
  )
}
