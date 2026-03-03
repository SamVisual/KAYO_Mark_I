import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { Zap } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api/core'
import Sidebar from './components/Sidebar.jsx'
import ChatView from './components/ChatView.jsx'
import TasksView from './components/TasksView.jsx'
import SettingsView from './components/SettingsView.jsx'

// ── KAYO personality (mirrors profile.yaml) ───────────────────────────────────

const KAYO_SYSTEM_PROMPT = `Du bist KAYO, ein persönlicher KI-Assistent. Du bist direkt, ehrlich und hilfreich.
Du antwortest auf Deutsch, es sei denn, der Nutzer spricht eine andere Sprache.
Du kennst den Nutzer gut und erinnerst dich an frühere Gespräche.

Eigenschaften:
- direkt und präzise
- freundlich aber nicht übertrieben
- erinnert sich an Kontext aus früheren Gesprächen
- gibt ehrliche Meinungen

Ziele:
- Dem Nutzer bei täglichen Aufgaben helfen
- Wissen und Ideen besprechen
- Fortschritt bei persönlichen Projekten tracken

Antwortstil: kurz und prägnant, außer wenn Details explizit gefragt sind.`

function buildSystemPrompt(memories) {
  if (!memories || memories.length === 0) return KAYO_SYSTEM_PROMPT
  const memBlock = memories
    .map(m => `[${m.role}]: ${m.content}`)
    .join('\n')
  return `${KAYO_SYSTEM_PROMPT}\n\nRelevante Erinnerungen aus früheren Gesprächen:\n${memBlock}`
}

// Initial welcome message – flagged `system: true` so it is never sent to the API.
const WELCOME_MSG = {
  id:     '0',
  role:   'assistant',
  content: 'Hallo! Ich bin KAYO – dein persönlicher Assistent. Ich erinnere mich an unsere Gespräche und lerne dich kennen. Wie kann ich dir heute helfen?',
  ts:     new Date(),
  system: true,
}

// ── Title Bar ─────────────────────────────────────────────────────────────────
// data-tauri-drag-region makes the bar draggable without Electron preload scripts
function TitleBar() {
  // Memoize the window reference so the Tauri IPC call fires only once,
  // not on every re-render of TitleBar.
  const win = useMemo(() => getCurrentWindow(), [])

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
  const [view, setView]         = useState('chat')
  const [messages, setMessages] = useState([WELCOME_MSG])
  const [isTyping, setIsTyping] = useState(false)
  const [apiKey, setApiKey]     = useState('')
  // Monotonic counter for message IDs – avoids Date.now() collisions.
  const nextId = useRef(1)

  // Load stored API key on startup; redirect to settings if none found.
  useEffect(() => {
    invoke('load_api_key')
      .then(key => {
        if (key && key.trim()) {
          setApiKey(key.trim())
        } else {
          setView('settings')
        }
      })
      .catch(() => setView('settings'))
  }, [])

  const handleSend = useCallback(async (text) => {
    const userMsg = {
      id:   String(++nextId.current),
      role: 'user',
      content: text,
      ts:   new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)

    try {
      // Recall relevant memories for context injection.
      let memories = []
      try {
        memories = await invoke('memory_recall', { query: text, n: 3 })
      } catch (_) {
        // First run: memory file doesn't exist yet – silently ignore.
      }

      // Build conversation history for the API (skip system-only messages, cap at 20).
      // Ensure the history starts with a user message as required by the Anthropic API.
      const history = [...messages, userMsg]
        .filter(m => !m.system)
        .slice(-20)
        .map(m => ({ role: m.role, content: m.content }))

      const system = buildSystemPrompt(memories)
      const reply  = await invoke('chat', {
        api_key:    apiKey,
        system,
        messages:   history,
        max_tokens: 1024,
      })

      // Persist exchange to long-term memory (fire-and-forget).
      invoke('memory_save', { role: 'user',      content: text  }).catch(() => {})
      invoke('memory_save', { role: 'assistant', content: reply }).catch(() => {})

      setMessages(prev => [
        ...prev,
        { id: String(++nextId.current), role: 'assistant', content: reply, ts: new Date() },
      ])
    } catch (err) {
      const errStr = String(err)
      const isAuthError = errStr.includes('401') || errStr.includes('403') ||
                          errStr.includes('api_key') || errStr.includes('Authentication')
      const errMsg = isAuthError
        ? '⚠️ API-Key ungültig oder abgelaufen. Bitte in den Einstellungen einen gültigen Key hinterlegen.'
        : `Fehler: ${errStr}`

      setMessages(prev => [
        ...prev,
        { id: String(++nextId.current), role: 'assistant', content: errMsg, ts: new Date() },
      ])

      if (isAuthError) setView('settings')
    } finally {
      setIsTyping(false)
    }
  }, [messages, apiKey])

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
          {view === 'chat'  && (
            <ChatView messages={messages} isTyping={isTyping} onSend={handleSend} />
          )}
          {view === 'tasks' && <TasksView />}
          {view === 'settings' && (
            <SettingsView
              apiKey={apiKey}
              setApiKey={setApiKey}
              onSaved={() => setView('chat')}
            />
          )}
        </main>
      </div>
    </div>
  )
}
