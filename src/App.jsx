import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [thought, setThought] = useState('')
  const [response, setResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('flipSettings')
    return saved ? JSON.parse(saved) : { anthropicKey: '', elevenLabsKey: '', voiceId: 'EXAVITQu4vr4xnSDxMaL', language: 'en', darkHumor: 0 }
  })

  const voices = [
    // American English
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', desc: 'Female, American 🇺🇸' },
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', desc: 'Female, American 🇺🇸' },
    { id: 'jsCqWAovK2LkecY7zXl4', name: 'Freya', desc: 'Female, American (young) 🇺🇸' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', desc: 'Male, American 🇺🇸' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', desc: 'Male, American 🇺🇸' },
    { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', desc: 'Male, American (deep) 🇺🇸' },
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', desc: 'Male, American 🇺🇸' },
    // British English
    { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', desc: 'Female, British 🇬🇧' },
    { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy', desc: 'Female, British 🇬🇧' },
    { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', desc: 'Male, British 🇬🇧' },
    // Spanish - Spain
    { id: 'g5CIjZEefAph4nQFvHAz', name: 'Valentino', desc: 'Male, España 🇪🇸' },
    { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', desc: 'Female, España 🇪🇸' },
    // Spanish - Latin America
    { id: 'pqHfZKP75CvOlQylNhV4', name: 'Diego', desc: 'Male, México 🇲🇽' },
    { id: 'XB0fDUnXU5powFXDhCwa', name: 'Sofía', desc: 'Female, México 🇲🇽' },
    { id: 'bVMeCyTHy58xNoL34h3p', name: 'Carlos', desc: 'Male, Argentina 🇦🇷' },
    { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', desc: 'Female, Colombia 🇨🇴' },
    { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Elena', desc: 'Female, Latina 🌎' },
    { id: 'iP95p4xoKVk53GoZ742B', name: 'Mateo', desc: 'Male, Latino 🌎' },
  ]

  const languages = [
    { code: 'en', name: 'English 🇺🇸' },
    { code: 'es', name: 'Español 🇪🇸' },
  ]
  
  const audioRef = useRef(null)
  const mediaRecorderRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('flipSettings', JSON.stringify(settings))
  }, [settings])

  const flipThought = async () => {
    if (!thought.trim() || isLoading) return

    setIsLoading(true)
    setResponse('')

    try {
      const res = await fetch('/api/flip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          thought: thought.trim(),
          apiKey: settings.anthropicKey || '',
          language: settings.language || 'en',
          darkHumor: settings.darkHumor || 0
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
          apiKey: settings.elevenLabsKey || '',
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      const chunks = []

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data)
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        stream.getTracks().forEach(track => track.stop())
        
        // Use Web Speech API for transcription (free!)
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
          // Already handled by speech recognition below
        }
      }

      mediaRecorderRef.current = mediaRecorder
      
      // Use Speech Recognition API instead
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = false
        
        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript
          setThought(transcript)
          setIsRecording(false)
        }
        
        recognition.onerror = () => {
          setIsRecording(false)
        }
        
        recognition.onend = () => {
          setIsRecording(false)
        }
        
        recognition.start()
        setIsRecording(true)
      }
    } catch (error) {
      console.error('Error accessing microphone:', error)
      setIsRecording(false)
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
              <label htmlFor="anthropicKey">Anthropic API Key</label>
              <input
                id="anthropicKey"
                type="password"
                placeholder="sk-ant-..."
                value={settings.anthropicKey}
                onChange={(e) => setSettings(s => ({ ...s, anthropicKey: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="elevenLabsKey">Eleven Labs API Key</label>
              <input
                id="elevenLabsKey"
                type="password"
                placeholder="Your Eleven Labs key"
                value={settings.elevenLabsKey}
                onChange={(e) => setSettings(s => ({ ...s, elevenLabsKey: e.target.value }))}
              />
            </div>

<div className="form-group">
              <label htmlFor="darkHumor">
                Humor Style: {settings.darkHumor === 0 ? '🌸 Gentle' : settings.darkHumor === 1 ? '😏 Witty' : settings.darkHumor === 2 ? '🖤 Dark' : '💀 Gallows'}
              </label>
              <input
                id="darkHumor"
                type="range"
                min="0"
                max="3"
                value={settings.darkHumor || 0}
                onChange={(e) => setSettings(s => ({ ...s, darkHumor: parseInt(e.target.value) }))}
                className="humor-slider"
              />
              <div className="humor-labels">
                <span>Gentle</span>
                <span>Witty</span>
                <span>Dark</span>
                <span>Gallows</span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="language">Response Language</label>
              <select
                id="language"
                value={settings.language || 'en'}
                onChange={(e) => setSettings(s => ({ ...s, language: e.target.value }))}
              >
                {languages.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="voiceId">Voice</label>
              <select
                id="voiceId"
                value={settings.voiceId || 'EXAVITQu4vr4xnSDxMaL'}
                onChange={(e) => setSettings(s => ({ ...s, voiceId: e.target.value }))}
              >
                {voices.map(voice => (
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

      <audio 
        ref={audioRef} 
        onEnded={() => setIsPlaying(false)}
        onError={() => setIsPlaying(false)}
      />
      </div>
  )
}

export default App
