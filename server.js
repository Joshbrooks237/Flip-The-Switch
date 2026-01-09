import 'dotenv/config'
import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import Stripe from 'stripe'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const ELEVEN_LABS_API_KEY = process.env.ELEVEN_LABS_API_KEY
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null

const app = express()

// Stripe webhook needs raw body
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

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    console.log('💰 Payment successful for:', session.customer_email)
    // In a real app, you'd store this in a database
  }

  res.json({ received: true })
})

app.use(express.json())

// Serve static files from the Vite build
app.use(express.static(join(__dirname, 'dist')))

// Health check for Railway
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '🎚️ FLIP THE SWITCH is running' })
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
      mode: 'subscription', // or 'payment' for one-time
      success_url: `${req.headers.origin || 'http://localhost:5173'}/?success=true`,
      cancel_url: `${req.headers.origin || 'http://localhost:5173'}/?canceled=true`,
    })

    res.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

// Check subscription status (simple version - in production use a database)
app.get('/api/stripe/status', async (req, res) => {
  // For now, just return free tier info
  // In production, you'd check the user's subscription in your database
  res.json({ 
    isPro: false, 
    freeFlipsRemaining: 5,
    price: '$2.99/month'
  })
})

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
