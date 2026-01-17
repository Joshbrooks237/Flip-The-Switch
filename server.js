import 'dotenv/config'
import express from 'express'
import OpenAI from 'openai'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const ELEVEN_LABS_API_KEY = process.env.ELEVEN_LABS_API_KEY

const app = express()
app.use(express.json())

// Flip negative thoughts to positive
app.post('/api/flip', async (req, res) => {
  const { thought, apiKey } = req.body

  const key = apiKey || OPENAI_API_KEY
  if (!thought || !key) {
    return res.status(400).json({ error: 'Missing thought or API key' })
  }

  try {
    console.log('Calling OpenAI API...')
    const openai = new OpenAI({ apiKey: key })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 500,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `You are a compassionate, warm friend helping someone who's having a hard moment. Your job is to take their negative thoughts and FLIP THE SCRIPT positive.

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

You're not a therapist giving clinical advice. You're a friend who sees them clearly and reminds them of the truth when their brain (or someone else) is lying to them.`
        },
        {
          role: 'user',
          content: thought
        }
      ]
    })

    console.log('OpenAI response received')
    const flipped = completion.choices[0].message.content
    res.json({ flipped })
  } catch (error) {
    console.error('OpenAI error:', error.message || error)
    res.status(500).json({ error: 'Failed to process thought', details: error.message })
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
        model_id: 'eleven_monolingual_v1',
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

// ============ STATIC FILES AFTER API ROUTES ============

// Serve static files from the Vite build
app.use(express.static(join(__dirname, 'dist')))

// SPA fallback - serve index.html for all other routes (MUST BE LAST)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`🎚️  FLIP THE SWITCH server running on port ${PORT}`)
  console.log(`   OpenAI key loaded: ${!!OPENAI_API_KEY}`)
  console.log(`   Eleven Labs key loaded: ${!!ELEVEN_LABS_API_KEY}`)
})
