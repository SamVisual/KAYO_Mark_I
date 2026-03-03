import { useState, useCallback } from 'react'
import { Zap } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import Sidebar from './components/Sidebar.jsx'
import ChatView from './components/ChatView.jsx'
import TasksView from './components/TasksView.jsx'
import SettingsView from './components/SettingsView.jsx'

const DEMO_MESSAGES = [
  {
    id: '1',
    role: 'assistant',
    content: 'Hallo! Ich bin KAYO – dein persönlicher Assistent. Ich erinnere mich an unsere Gespräche und lerne dich kennen. Wie kann ich dir heute helfen?',
    ts: new Date(Date.now() - 3 * 60000),
  },
  {
    id: '2',
    role: 'user',
    content: 'Hey KAYO! Zeig mir mal, wie du aussiehst.',
    ts: new Date(Date.now() - 2 * 60000),
  },
  {
    id: '3',
    role: 'assistant',
    content: 'Das hier bin ich – KAYO Mark I. Dunkles Interface, klare Struktur, kein unnötiges Rauschen. Sobald die KI-Verbindung aktiv ist, stehe ich dir mit Langzeitgedächtnis, Aufgaben-Tracking und echten Antworten zur Seite.',
    ts: new Date(Date.now() - 90000),
  },
]

const PLACEHOLDER_REPLIES = [
  'Verstanden. Die Anthropic-Verbindung wird in Kürze aktiviert – dann antworte ich mit vollem Kontext aus unserem Langzeitgedächtnis.',
  'Guter Punkt. Im Demo-Modus kann ich noch nicht wirklich antworten, aber ich merke mir alles für später.',
  'Interessant. Sobald das Python-Backend verbunden ist, kann ich das wirklich verarbeiten.',
  'Notiert. Wenn die API-Verbindung steht, werde ich darauf eingehen können.',
]

// ── Title Bar ─────────────────────────────────────────────────────────────────
// data-tauri-drag-region makes the bar draggable without Electron preload scripts
function TitleBar() {
  const win = getCurrentWindow()

  const controls = [
    { label: '−', action: () => win.minimize(),        hover: 'hover:bg-white/10'   },
    { label: '⬜', action: () => win.toggleMaximize(), hover: 'hover:bg-white/10', small: true },
    { label: '✕', action: () => win.close(),           hover: 'hover:bg-red-500/80', hoverText: 'hover:text-white' },
  ]

  return (
    <div
      data-tauri-drag-region
      className="drag flex items-center justify-between shrink-0 px-4"
      style={{ height: 40, borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Left: Logo + name */}
      <div className="no-drag flex items-center gap-2 pointer-events-none">
        <div
          className="w-5 h-5 rounded-md flex items-center justify-center accent-glow"
          style={{ background: 'linear-gradient(135deg, #818cf8, #a78bfa)' }}
        >
          <Zap size={11} className="text-white" />
        </div>
        <span className="text-xs font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>
          KAYO Mark I
        </span>
      </div>

      {/* Right: Window controls */}
      <div className="no-drag flex items-center gap-0.5">
        {controls.map(({ label, action, hover, hoverText, small }) => (
          <button
            key={label}
            onClick={action}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors duration-150 ${hover} ${hoverText ?? ''}`}
            style={{ color: 'rgba(255,255,255,0.4)', fontSize: small ? 9 : 13 }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView]       = useState('chat')
  const [messages, setMessages] = useState(DEMO_MESSAGES)
  const [isTyping, setIsTyping] = useState(false)

  const handleSend = useCallback((text) => {
    const userMsg = { id: String(Date.now()), role: 'user', content: text, ts: new Date() }
    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)

    setTimeout(() => {
      const reply = PLACEHOLDER_REPLIES[Math.floor(Math.random() * PLACEHOLDER_REPLIES.length)]
      setIsTyping(false)
      setMessages(prev => [
        ...prev,
        { id: String(Date.now() + 1), role: 'assistant', content: reply, ts: new Date() },
      ])
    }, 900 + Math.random() * 700)
  }, [])

  return (
    // Root window shell — semi-transparent dark layer over the OS acrylic blur
    <div
      className="flex flex-col h-full"
      style={{
        background:    'rgba(9, 9, 18, 0.87)',
        borderRadius:  10,
        overflow:      'hidden',
        boxShadow:     '0 0 0 1px rgba(255,255,255,0.07), 0 24px 60px rgba(0,0,0,0.55)',
      }}
    >
      <TitleBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar currentView={view} onNavigate={setView} />
        <main className="flex-1 min-w-0">
          {view === 'chat'     && <ChatView messages={messages} isTyping={isTyping} onSend={handleSend} />}
          {view === 'tasks'    && <TasksView />}
          {view === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  )
}
