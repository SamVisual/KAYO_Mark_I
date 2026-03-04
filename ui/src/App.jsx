import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { Zap, Bot, Brain, FolderOpen, Clock } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api/core'

const IS_TAURI = typeof window !== 'undefined' && '__TAURI__' in window
import Sidebar      from './components/Sidebar.jsx'
import HomeView     from './components/HomeView.jsx'
import ChatView     from './components/ChatView.jsx'
import TasksView    from './components/TasksView.jsx'
import SettingsView from './components/SettingsView.jsx'

// ── KAYO personality (mirrors profile.yaml) ───────────────────────────────────

const KAYO_BASE_PROMPT = `Du bist KAYO, ein persönlicher KI-Assistent. Du bist direkt, ehrlich und hilfreich.
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

const AGENT_CONTEXT = {
  claude:   '',
  coder:    'Fokus auf Programmierung, Code-Review, technische Lösungen und Architektur. Antworte mit Codebeispielen wenn hilfreich.',
  alltag:   'Fokus auf Alltag, Tagesplanung, persönliche Produktivität und Aufgabenmanagement.',
  finanzen: 'Fokus auf persönliche Finanzen, Budgetierung, Sparen und Investmentgrundlagen.',
}

function buildSystemPrompt(memories, agentKey) {
  let prompt = KAYO_BASE_PROMPT
  const extra = AGENT_CONTEXT[agentKey] ?? ''
  if (extra) prompt += `\n\n${extra}`
  if (memories?.length > 0) {
    const memBlock = memories.map(m => `[${m.role}]: ${m.content}`).join('\n')
    prompt += `\n\nRelevante Erinnerungen aus früheren Gesprächen:\n${memBlock}`
  }
  return prompt
}

// Factory so every "Neuer Chat" gets a fresh timestamp (BUG #5).
function makeWelcomeMsg() {
  return {
    id:      '0',
    role:    'assistant',
    content: 'Hallo! Ich bin KAYO – dein persönlicher Assistent. Ich erinnere mich an unsere Gespräche und lerne dich kennen. Wie kann ich dir heute helfen?',
    ts:      new Date(),
    system:  true,
  }
}

// ── Coming-soon placeholder ───────────────────────────────────────────────────

const VIEW_META = {
  agents:  { label: 'Agenten',    Icon: Bot        },
  memory:  { label: 'Gedächtnis', Icon: Brain      },
  files:   { label: 'Dateien',    Icon: FolderOpen },
  history: { label: 'Verlauf',    Icon: Clock      },
}

function ComingSoon({ view }) {
  const { label, Icon } = VIEW_META[view] ?? { label: view, Icon: Zap }
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 anim-fade-up">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.15)' }}
      >
        <Icon size={22} style={{ color: 'rgba(0,212,255,0.5)' }} />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</p>
        <p className="font-mono-label mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>kommt bald</p>
      </div>
    </div>
  )
}

// ── Title Bar ─────────────────────────────────────────────────────────────────

function TitleBar() {
  const win                           = useMemo(() => IS_TAURI ? getCurrentWindow() : null, [])
  const [hoveredCtrl, setHoveredCtrl] = useState(null)

  const controls = [
    { id: 'min',   label: '−',  action: () => win?.minimize(),        hoverBg: 'rgba(255,255,255,0.1)'  },
    { id: 'max',   label: '⬜', action: () => win?.toggleMaximize(), hoverBg: 'rgba(255,255,255,0.1)', small: true },
    { id: 'close', label: '✕',  action: () => win?.close(),           hoverBg: 'rgba(239,68,68,0.75)'  },
  ]

  return (
    <div
      data-tauri-drag-region
      className="drag flex items-center justify-end shrink-0 px-3"
      style={{ height: 36, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="no-drag flex items-center gap-0.5">
        {controls.map(({ id, label, action, hoverBg, small }) => (
          <button
            key={id}
            onClick={action}
            onMouseEnter={() => setHoveredCtrl(id)}
            onMouseLeave={() => setHoveredCtrl(null)}
            className="w-8 h-7 rounded flex items-center justify-center transition-colors duration-100"
            style={{
              background: hoveredCtrl === id ? hoverBg : 'transparent',
              color:      hoveredCtrl === id && id === 'close' ? '#fff' : 'rgba(255,255,255,0.35)',
              fontSize:   small ? 9 : 12,
            }}
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
  const [view, setView]               = useState('home')
  const [messages, setMessages]       = useState(() => [makeWelcomeMsg()])
  const [isTyping, setIsTyping]       = useState(false)
  const [apiKey, setApiKey]           = useState('')
  const [activeAgent, setActiveAgent] = useState('claude')
  const nextId                        = useRef(1)

  // Load stored API key on startup; redirect to settings if missing.
  useEffect(() => {
    invoke('load_api_key')
      .then(key => {
        if (key?.trim()) setApiKey(key.trim())
        else setView('settings')
      })
      .catch(() => setView('settings'))
  }, [])

  // ── Core chat pipeline ──
  const handleSend = useCallback(async (text) => {
    const userMsg = {
      id:      String(++nextId.current),
      role:    'user',
      content: text,
      ts:      new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)

    try {
      let memories = []
      try { memories = await invoke('memory_recall', { query: text, n: 3 }) } catch (_) {}

      // Build history starting from first user message (Anthropic API requirement).
      const history = [...messages, userMsg]
        .filter(m => !m.system)
        .slice(-20)
        .map(m => ({ role: m.role, content: m.content }))

      const system = buildSystemPrompt(memories, activeAgent)
      const reply  = await invoke('chat', {
        api_key:    apiKey,
        system,
        messages:   history,
        max_tokens: 1024,
      })

      // Persist exchange sequentially to avoid race condition (BUG #2):
      // both saves modify the same JSON file; concurrent writes lose one entry.
      invoke('memory_save', { role: 'user', content: text })
        .then(() => invoke('memory_save', { role: 'assistant', content: reply }))
        .catch(() => {})

      setMessages(prev => [
        ...prev,
        { id: String(++nextId.current), role: 'assistant', content: reply, ts: new Date() },
      ])
    } catch (err) {
      const s      = String(err)
      const isAuth = s.includes('401') || s.includes('403') ||
                     s.includes('api_key') || s.includes('Authentication')
      const msg = isAuth
        ? '⚠️ API-Key ungültig oder nicht gesetzt. Bitte in den Einstellungen konfigurieren.'
        : `Fehler: ${s}`

      setMessages(prev => [
        ...prev,
        { id: String(++nextId.current), role: 'assistant', content: msg, ts: new Date() },
      ])
      if (isAuth) setView('settings')
    } finally {
      setIsTyping(false)
    }
  }, [messages, apiKey, activeAgent])

  // From Home: switch to Chat view and send in one go.
  const handleHomeSend = useCallback((text) => {
    setView('chat')
    handleSend(text)
  }, [handleSend])

  // Reset to fresh Home view.
  const handleNewChat = useCallback(() => {
    setMessages([makeWelcomeMsg()])
    nextId.current = 1
    setView('home')
  }, [])

  return (
    <div
      className="flex flex-col h-full"
      style={{
        background:   '#0d0d0d',
        borderRadius: 10,
        overflow:     'hidden',
        boxShadow:    '0 0 0 1px rgba(255,255,255,0.06), 0 24px 60px rgba(0,0,0,0.7)',
      }}
    >
      {/* Film-grain texture overlay (defined in index.css) */}
      <div className="grain-overlay" />

      {IS_TAURI && <TitleBar />}

      <div className="flex flex-1 min-h-0">
        <Sidebar
          currentView={view}
          onNavigate={setView}
          onNewChat={handleNewChat}
          activeAgent={activeAgent}
          onContextChange={setActiveAgent}
        />

        <main className="flex-1 min-w-0 relative">
          {view === 'home' && (
            <HomeView
              messages={messages}
              activeAgent={activeAgent}
              onAgentChange={setActiveAgent}
              onSend={handleHomeSend}
              isTyping={isTyping}
              onContinueChat={() => setView('chat')}
            />
          )}

          {view === 'chat' && (
            <ChatView
              messages={messages}
              isTyping={isTyping}
              onSend={handleSend}
              activeAgent={activeAgent}
            />
          )}

          {view === 'settings' && (
            <SettingsView
              apiKey={apiKey}
              setApiKey={setApiKey}
              onSaved={() => setView('home')}
            />
          )}

          {/* Legacy tasks view */}
          {view === 'tasks' && <TasksView />}

          {/* Coming-soon stubs */}
          {['agents', 'memory', 'files', 'history'].includes(view) && (
            <ComingSoon view={view} />
          )}
        </main>
      </div>
    </div>
  )
}
