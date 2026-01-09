import 'dotenv/config'
import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const ELEVEN_LABS_API_KEY = process.env.ELEVEN_LABS_API_KEY

const app = express()
app.use(express.json())

// Serve static files from the Vite build
app.use(express.static(join(__dirname, 'dist')))

// Flip negative thoughts to positive
app.post('/api/flip', async (req, res) => {
  const { thought, apiKey, language, darkHumor } = req.body

  const key = apiKey || ANTHROPIC_API_KEY
  if (!thought || !key) {
    return res.status(400).json({ error: 'Missing thought or API key' })
  }

  const langInstruction = language === 'es' 
    ? '\n\nIMPORTANT: Respond ONLY in Spanish (Español). Use warm, natural Spanish.'
    : ''

  const humorStyles = {
    0: '', // Gentle - default warm and sincere
    1: '\n\nHUMOR STYLE: Be a bit witty and playful. Light sarcasm is okay. Still supportive but with a wink.',
    2: '\n\nHUMOR STYLE: Use dark humor. Be sardonic and dry. Think "well, at least you\'re not dead yet" energy. Still ultimately supportive but with an edge. Acknowledge the absurdity of existence.',
    3: '\n\nHUMOR STYLE: Full gallows humor. Morbid, absurdist, dark comedy. Think "we\'re all gonna die anyway so your problems are cosmically meaningless, which is actually liberating." Laugh at the void. Still end on a weirdly supportive note but get there through existential darkness and dark jokes.'
  }
  
  const humorInstruction = humorStyles[darkHumor] || ''

  try {
    const anthropic = new Anthropic({ apiKey: key })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: `You are a compassionate, warm friend helping someone who's having a hard moment. Your job is to take their negative thoughts and FLIP THE SCRIPT positive.${humorInstruction}${langInstruction}

People will come to you in different ways:
- They might be hard on themselves: "I'm such a failure"
- They might report what others said: "My boss called me useless"
- They might vent AT you: "You're stupid" or "This is dumb"
- They might just YELL the exact words someone screamed at them: "YOU'RE WORTHLESS" or "NOBODY LOVES YOU"

ALL of these get flipped with warmth. No context needed. If someone types raw angry words, assume those words were thrown at them and they need to hear the opposite. Meet everything with compassion.

IMPORTANT GUIDELINES:
- Never dismiss their feelings. Validate first, then offer perspective.
- Avoid toxic positivity ("just think positive!"). Be real and genuine.
- Identify cognitive distortions (catastrophizing, black-and-white thinking, personalization) and gently challenge them.
- Keep it conversational and warm, like a good friend would talk.
- Be concise but meaningful. 2-4 sentences max.
- If someone reports what others called them, remind them that other people's words don't define their worth.
- If someone is rude to you, don't take it personally—just reflect back kindness.
- Use "you" not "I" - you're talking TO them.
- If they're expressing something really dark, acknowledge it seriously and remind them they matter.

You're not a therapist giving clinical advice. You're a friend who sees them clearly and reminds them of the truth when their brain (or someone else) is lying to them.`,
      messages: [
        {
          role: 'user',
          content: thought
        }
      ]
    })

    const flipped = message.content[0].text
    res.json({ flipped })
  } catch (error) {
    console.error('Anthropic error:', error)
    res.status(500).json({ error: 'Failed to process thought' })
  }
})

// Text to speech with Eleven Labs
app.post('/api/speak', async (req, res) => {
  const { text, apiKey, voiceId } = req.body

  const key = apiKey || ELEVEN_LABS_API_KEY
  if (!text || !key) {
    return res.status(400).json({ error: 'Missing text or API key' })
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': key
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.6,
          similarity_boost: 0.75
        }
      })
    })

    if (!response.ok) {
      throw new Error('Eleven Labs API error')
    }

    const audioBuffer = await response.arrayBuffer()
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.byteLength
    })
    res.send(Buffer.from(audioBuffer))
  } catch (error) {
    console.error('Eleven Labs error:', error)
    res.status(500).json({ error: 'Failed to generate speech' })
  }
})

// SPA fallback - serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`🎚️  FLIP THE SWITCH server running on port ${PORT}`)
})
