import 'dotenv/config'
import express from 'express'
import OpenAI from 'openai'
import Stripe from 'stripe'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const ELEVEN_LABS_API_KEY = process.env.ELEVEN_LABS_API_KEY
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null

const app = express()

// Stripe webhook needs raw body - MUST be before express.json()
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(400).json({ error: 'Stripe not configured' })
  }

  const sig = req.headers['stripe-signature']
  let event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    console.log('💰 Payment successful for:', session.customer_email)
  }

  res.json({ received: true })
})

// Parse JSON for all other routes
app.use(express.json())

// ============ API ROUTES FIRST ============

// Health check for Railway
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '🎚️ FLIP THE SWITCH is running',
    hasOpenAIKey: !!OPENAI_API_KEY,
    hasElevenLabsKey: !!ELEVEN_LABS_API_KEY,
    hasStripeKey: !!STRIPE_SECRET_KEY
  })
})

// Create Stripe checkout session
app.post('/api/stripe/checkout', async (req, res) => {
  if (!stripe || !STRIPE_PRICE_ID) {
    return res.status(400).json({ error: 'Stripe not configured' })
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.origin || 'https://flip-the-switch-production.up.railway.app'}/?success=true`,
      cancel_url: `${req.headers.origin || 'https://flip-the-switch-production.up.railway.app'}/?canceled=true`,
    })

    res.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

// Check subscription status
app.get('/api/stripe/status', async (req, res) => {
  res.json({ 
    isPro: false, 
    freeFlipsRemaining: 3,
    price: '$2.99/month'
  })
})

// Flip negative thoughts to positive
app.post('/api/flip', async (req, res) => {
  const { thought, apiKey, language, darkHumor } = req.body

  const key = apiKey || OPENAI_API_KEY
  if (!thought || !key) {
    console.error('Missing thought or API key. Has key:', !!key)
    return res.status(400).json({ error: 'Missing thought or API key' })
  }

  const langInstruction = language === 'es'
    ? '\n\nIMPORTANT: Respond ONLY in Spanish (Español). Use warm, natural Spanish.'
    : ''

  const humorStyles = {
    0: '',
    1: '\n\nHUMOR STYLE: Be a bit witty and playful. Light sarcasm is okay. Still supportive but with a wink.',
    2: '\n\nHUMOR STYLE: Use dark humor. Be sardonic and dry. Think "well, at least you\'re not dead yet" energy. Still ultimately supportive but with an edge.',
    3: '\n\nHUMOR STYLE: Full gallows humor. Morbid, absurdist, dark comedy. Laugh at the void. Still end on a weirdly supportive note but get there through existential darkness.'
  }

  const humorInstruction = humorStyles[darkHumor] || ''

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
          content: `You are a compassionate, warm friend helping someone who's having a hard moment. Your job is to take their negative thoughts and FLIP THE SCRIPT positive.${humorInstruction}${langInstruction}

People will come to you in different ways:
- They might be hard on themselves: "I'm such a failure"
- They might report what others said: "My boss called me useless"
- They might vent AT you: "You're stupid" or "This is dumb"
- They might just YELL the exact words someone screamed at them: "YOU'RE WORTHLESS"

ALL of these get flipped with warmth. No context needed. Meet everything with compassion.

GUIDELINES:
- Validate first, then offer perspective.
- Avoid toxic positivity. Be real and genuine.
- Keep it conversational, like a good friend.
- Be concise: 2-4 sentences max.
- Use "you" not "I" - you're talking TO them.

You're a friend who reminds them of the truth when their brain is lying to them.`
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
  console.log(`   Stripe key loaded: ${!!STRIPE_SECRET_KEY}`)
})
