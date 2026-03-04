import { useState, useCallback, useEffect } from 'react'
import { Zap } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api/core'
import Sidebar from './components/Sidebar.jsx'
import ChatView from './components/ChatView.jsx'
import TasksView from './components/TasksView.jsx'
import SettingsView from './components/SettingsView.jsx'
import useMemory from './hooks/useMemory.js'

const BASE_SYSTEM_PROMPT = `# Deine Identität
Du bist KAYO, ein persönlicher KI-Assistent. Du bist direkt, ehrlich und hilfreich.
Du antwortest auf Deutsch, es sei denn, der Nutzer spricht eine andere Sprache.
Du kennst den Nutzer gut und erinnerst dich an frühere Gespräche.

## Eigenschaften
- direkt und präzise
- freundlich aber nicht übertrieben
- erinnert sich an Kontext aus früheren Gesprächen
- gibt ehrliche Meinungen

## Ziele
- Dem Nutzer bei täglichen Aufgaben helfen
- Wissen und Ideen besprechen
- Fortschritt bei persönlichen Projekten tracken

## Präferenzen
- Sprache: Deutsch
- Antwortstil: kurz und prägnant, außer wenn Details gefragt sind`

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

// ── Build system prompt with memory context ──────────────────────────────────
function buildSystemPrompt(memories) {
  if (!memories || memories.length === 0) return BASE_SYSTEM_PROMPT
  const memoryLines = memories.map(m => {
    const role = m.metadata?.role === 'user' ? 'Nutzer' : 'KAYO'
    return `- [${role}] ${m.content}`
  }).join('\n')
  return `${BASE_SYSTEM_PROMPT}

## Relevante Erinnerungen aus früheren Gesprächen
${memoryLines}
Nutze diese Erinnerungen wenn relevant, erwähne sie aber nicht explizit außer der Nutzer fragt danach.`
}

// ── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView]         = useState('chat')
  const [messages, setMessages] = useState([
    {
      id: '1',
      role: 'assistant',
      content: 'Hallo! Ich bin KAYO – dein persönlicher Assistent. Wie kann ich dir helfen?',
      ts: new Date(),
    },
  ])
  const [isTyping, setIsTyping] = useState(false)
  const [apiKey, setApiKey]     = useState(() => localStorage.getItem('kayo_api_key') || '')
  const memory = useMemory()

  // On mount: try to load API key from environment variable
  useEffect(() => {
    if (!apiKey) {
      invoke('get_env_api_key').then(key => {
        if (key) {
          setApiKey(key)
          localStorage.setItem('kayo_api_key', key)
        }
      }).catch(() => {})
    }
  }, [])

  const handleApiKeyChange = useCallback((key) => {
    setApiKey(key)
    localStorage.setItem('kayo_api_key', key)
  }, [])

  const handleSend = useCallback(async (text) => {
    const userMsg = { id: String(Date.now()), role: 'user', content: text, ts: new Date() }
    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)

    if (!apiKey) {
      setIsTyping(false)
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: 'Bitte gib deinen Anthropic API-Key in den Einstellungen ein, damit ich antworten kann.',
          ts: new Date(),
        },
      ])
      setView('settings')
      return
    }

    try {
      // Search semantic memory for relevant past conversations
      const memories = await memory.searchMemory(text, 5)
      const systemPrompt = buildSystemPrompt(memories)

      const apiMessages = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }))

      const reply = await invoke('chat', {
        apiKey,
        system: systemPrompt,
        messages: apiMessages,
        maxTokens: 1024,
      })

      setMessages(prev => [
        ...prev,
        { id: String(Date.now() + 1), role: 'assistant', content: reply, ts: new Date() },
      ])

      // Save both messages to long-term memory
      memory.addMessage(text, 'user')
      memory.addMessage(reply, 'assistant')
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: `Fehler: ${String(err)}`,
          ts: new Date(),
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }, [apiKey, messages, memory])

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
          {view === 'settings' && <SettingsView apiKey={apiKey} onApiKeyChange={handleApiKeyChange} />}
        </main>
      </div>
    </div>
  )
}
