import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [thought, setThought] = useState('')
  const [response, setResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const FREE_FLIPS = 3
  const [isPro, setIsPro] = useState(() => localStorage.getItem('flipPro') === 'true')
  const [flipsToday, setFlipsToday] = useState(() => {
    const saved = localStorage.getItem('flipCount')
    if (saved) {
      const { count, date } = JSON.parse(saved)
      // Reset if it's a new day
      if (date !== new Date().toDateString()) {
        return 0
      }
      return count
    }
    return 0
  })

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('flipSettings')
    return saved ? JSON.parse(saved) : {
      voiceId: 'EXAVITQu4vr4xnSDxMaL', // Default: Sarah
      accent: 'american'
    }
  })

  // Voices organized by accent
  const voices = {
    american: [
      { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', desc: 'Female 🇺🇸' },
      { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', desc: 'Female 🇺🇸' },
      { id: 'jsCqWAovK2LkecY7zXl4', name: 'Freya', desc: 'Female 🇺🇸' },
      { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', desc: 'Male 🇺🇸' },
      { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', desc: 'Male 🇺🇸' },
      { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', desc: 'Male 🇺🇸' },
      { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', desc: 'Male 🇺🇸' }
    ],
    british: [
      { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', desc: 'Female 🇬🇧' },
      { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy', desc: 'Female 🇬🇧' },
      { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', desc: 'Male 🇬🇧' },
      { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', desc: 'Male 🇬🇧' }
    ],
    australian: [
      { id: 'LcqN2tRlIq9W2KjZVbDJ', name: 'Olivia', desc: 'Female 🇦🇺' }
    ],
    spanish: [
      { id: 'g5CIjZEefAph4nQFvHAz', name: 'Valentino', desc: 'Male 🇪🇸' },
      { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', desc: 'Female 🇪🇸' },
      { id: 'pqHfZKP75CvOlQylNhV4', name: 'Diego', desc: 'Male 🇲🇽' },
      { id: 'XB0fDUnXU5powFXDhCwa', name: 'Sofía', desc: 'Female 🇲🇽' },
      { id: 'bVMeCyTHy58xNoL34h3p', name: 'Carlos', desc: 'Male 🇦🇷' },
      { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', desc: 'Female 🇨🇴' },
      { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Elena', desc: 'Female 🌎' },
      { id: 'iP95p4xoKVk53GoZ742B', name: 'Mateo', desc: 'Male 🌎' }
    ],
    french: [
      { id: '9tbHKVDTJ7lUR2MXYbJ6', name: 'Denis', desc: 'Male 🇫🇷' },
      { id: 'oWAxZDx7w5VEj9dCyTpo', name: 'Charlotte', desc: 'Female 🇫🇷' }
    ],
    german: [
      { id: 'ODq5zmih8GrVes37Dizd', name: 'Arnold', desc: 'Male 🇩🇪' }
    ]
  }

  const accents = [
    { code: 'american', name: 'American 🇺🇸' },
    { code: 'british', name: 'British 🇬🇧' },
    { code: 'australian', name: 'Australian 🇦🇺' },
    { code: 'spanish', name: 'Spanish 🌎' },
    { code: 'french', name: 'French 🇫🇷' },
    { code: 'german', name: 'German 🇩🇪' }
  ]
  
  const audioRef = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('flipSettings', JSON.stringify(settings))
  }, [settings])

  // Check for successful payment return or admin code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'true') {
      setIsPro(true)
      localStorage.setItem('flipPro', 'true')
      window.history.replaceState({}, '', '/') // Clean URL
    }
    // Secret admin code: ?rriobrave=1
    if (params.get('rriobrave') === '1') {
      setIsPro(true)
      setFlipsToday(0)
      localStorage.setItem('flipPro', 'true')
      localStorage.removeItem('flipCount')
      window.history.replaceState({}, '', '/') // Clean URL
      alert('🎚️ PRO MODE ACTIVATED - You are now Pro!')
    }
  }, [])

  // Save flip count
  useEffect(() => {
    localStorage.setItem('flipCount', JSON.stringify({
      count: flipsToday,
      date: new Date().toDateString()
    }))
  }, [flipsToday])

  const flipThought = async () => {
    if (!thought.trim() || isLoading) return

    // Check usage limit (unless Pro)
    if (!isPro && flipsToday >= FREE_FLIPS) {
      setShowPaywall(true)
      return
    }

    setIsLoading(true)
    setResponse('')
    setFlipsToday(prev => prev + 1)

    try {
      const res = await fetch('/api/flip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thought: thought.trim()
        })
      })

      if (!res.ok) throw new Error('Failed to flip thought')

      const data = await res.json()
      setResponse(data.flipped)
    } catch (error) {
      console.error('Error:', error)
      setResponse("Hey, something went wrong on our end—but that doesn't change the fact that you're doing your best right now. Take a breath. You've got this.")
    } finally {
      setIsLoading(false)
    }
  }

  const speakResponse = async () => {
    if (!response || isPlaying) return

    setIsPlaying(true)

    try {
      const res = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: response,
          voiceId: settings.voiceId || 'EXAVITQu4vr4xnSDxMaL' // Default: Sarah
        })
      })

      if (!res.ok) throw new Error('Failed to generate speech')

      const audioBlob = await res.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      if (audioRef.current) {
        audioRef.current.src = audioUrl
        audioRef.current.play()
      }
    } catch (error) {
      console.error('Error:', error)
      setIsPlaying(false)
    }
  }

  const startRecording = async () => {
    // If already recording, stop it
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsRecording(false)
      return
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SpeechRecognition) {
        alert('Speech recognition is not supported in this browser. Please use a modern browser like Chrome, Safari, or Edge.')
        return
      }

      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US' // Default language

      recognition.onstart = () => {
        setIsRecording(true)
        // Provide haptic feedback if available (iOS)
        if (navigator.vibrate) {
          navigator.vibrate(50)
        }
      }

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        if (transcript && transcript.trim()) {
          setThought(transcript.trim())
        }
        setIsRecording(false)
      }

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        setIsRecording(false)

        // Show user-friendly error messages
        if (event.error === 'not-allowed') {
          alert('Microphone access denied. Please allow microphone access and try again.')
        } else if (event.error === 'no-speech') {
          alert('No speech detected. Please speak clearly and try again.')
        } else if (event.error === 'network') {
          alert('Network error. Please check your connection and try again.')
        }
      }

      recognition.onend = () => {
        setIsRecording(false)
      }

      recognitionRef.current = recognition
      recognition.start()

    } catch (error) {
      console.error('Error starting speech recognition:', error)
      setIsRecording(false)
      alert('Failed to start speech recognition. Please try again.')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      flipThought()
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <img src="/switch.svg" alt="" className="logo-icon" />
          <h1>FLIP THE SWITCH</h1>
        </div>
        <p className="tagline">Transform your thoughts. You don't suck...that much.</p>
        {!isPro && (
          <p className="flip-counter">
            {FREE_FLIPS - flipsToday} free flips left today
            <button className="upgrade-link" onClick={() => setShowPaywall(true)}>Go Pro</button>
          </p>
        )}
        {isPro && <p className="pro-badge">⭐ PRO</p>}
      </header>

      <main className="main">
        <section className="input-panel">
          <label className="input-label" htmlFor="thought">What's on your mind?</label>
          <div className="input-wrapper">
            <textarea
              id="thought"
              className="thought-input"
              placeholder="Yell what they yelled at you. Or vent. Or be hard on yourself. I'll flip it."
              value={thought}
              onChange={(e) => setThought(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="actions">
            <button 
              className={`btn btn-secondary ${isRecording ? 'btn-recording' : ''}`}
              onClick={startRecording}
              disabled={isRecording || isLoading}
            >
              <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
              {isRecording ? 'Listening...' : 'Speak'}
            </button>
            <button 
              className="btn btn-primary"
              onClick={flipThought}
              disabled={!thought.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  Flipping...
                </>
              ) : (
                <>
                  <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="17 1 21 5 17 9"/>
                    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                    <polyline points="7 23 3 19 7 15"/>
                    <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                  </svg>
                  Flip It
                </>
              )}
            </button>
          </div>
        </section>

        <section className="response-panel">
          <div className="response-header">
            <span className="response-label">The Truth</span>
            <div className="status-indicator">
              <span className={`status-dot ${isLoading ? 'thinking' : response ? 'active' : ''}`}></span>
              <span>{isLoading ? 'Thinking...' : response ? 'Ready' : 'Waiting'}</span>
            </div>
          </div>
          
          <div className="response-content">
            {response ? (
              <p className="response-text">{response}</p>
            ) : (
              <div className="response-empty">
                <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <p>Say the worst. I'll flip it back with truth.</p>
              </div>
            )}
          </div>

          {response && (
            <div className="voice-output">
              <button 
                className={`btn btn-voice ${isPlaying ? 'playing' : ''}`}
                onClick={speakResponse}
                disabled={isPlaying}
              >
                <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                </svg>
                {isPlaying ? 'Playing...' : 'Hear It'}
              </button>
            </div>
          )}
        </section>
      </main>

      <button 
        className="settings-btn"
        onClick={() => setShowSettings(true)}
        aria-label="Settings"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Settings</h2>
            

            <div className="form-group">
              <label htmlFor="accent">Voice Accent</label>
              <select
                id="accent"
                value={settings.accent || 'american'}
                onChange={(e) => setSettings(s => ({
                  ...s,
                  accent: e.target.value,
                  voiceId: voices[e.target.value][0].id // Set to first voice of new accent
                }))}
              >
                {accents.map(accent => (
                  <option key={accent.code} value={accent.code}>{accent.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="voiceId">Voice</label>
              <select
                id="voiceId"
                value={settings.voiceId}
                onChange={(e) => setSettings(s => ({ ...s, voiceId: e.target.value }))}
              >
                {voices[settings.accent || 'american'].map(voice => (
                  <option key={voice.id} value={voice.id}>{voice.name} - {voice.desc}</option>
                ))}
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowSettings(false)}>
                Close
        </button>
            </div>
          </div>
        </div>
      )}

      {showPaywall && (
        <div className="modal-overlay" onClick={() => setShowPaywall(false)}>
          <div className="modal paywall-modal" onClick={(e) => e.stopPropagation()}>
            <h2>You've used your free flips! 🎚️</h2>
            <p className="paywall-message">
              Look, mental health support shouldn't be expensive. That's why we keep it cheap.
            </p>

            <div className="price-box">
              <span className="price">$2.99</span>
              <span className="price-period">/month</span>
            </div>

            <ul className="pro-features">
              <li>✓ Unlimited flips</li>
              <li>✓ All voices & accents</li>
              <li>✓ Support someone with PTSD building cool shit</li>
            </ul>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowPaywall(false)}>
                Maybe tomorrow
              </button>
            </div>
          </div>
        </div>
      )}

      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onError={() => setIsPlaying(false)}
      />
      </div>
  )
}

export default App
