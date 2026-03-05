import { useState, useCallback, useEffect } from 'react'
import { Zap } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api/core'
import Sidebar from './components/Sidebar.jsx'
import ChatView from './components/ChatView.jsx'
import TasksView from './components/TasksView.jsx'
import SettingsView from './components/SettingsView.jsx'

const SYSTEM_PROMPT = `Du bist KAYO, ein persönlicher KI-Assistent. Du bist direkt, ehrlich und hilfreich.
Du antwortest auf Deutsch, es sei denn, der Nutzer spricht eine andere Sprache.
Halte deine Antworten kurz und prägnant, außer wenn Details gefragt sind.`

const WELCOME_MSG = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hallo! Ich bin KAYO – dein persönlicher Assistent. Wie kann ich dir heute helfen?',
  ts: new Date(),
}

// ── Title Bar ─────────────────────────────────────────────────────────────────

const appWindow = getCurrentWindow()

function TitleBar() {
  const controls = [
    { label: '−', action: () => appWindow.minimize(),        hover: 'hover:bg-white/10' },
    { label: '⬜', action: () => appWindow.toggleMaximize(), hover: 'hover:bg-white/10', small: true },
    { label: '✕', action: () => appWindow.close(),           hover: 'hover:bg-red-500/80', hoverText: 'hover:text-white' },
  ]

  return (
    <div
      data-tauri-drag-region
      className="drag flex items-center justify-between shrink-0 px-4"
      style={{ height: 40, borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
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
  const [error, setError]       = useState(null)
  const [hasKey, setHasKey]     = useState(false)

  // Check API key status on mount and when switching back to chat
  useEffect(() => {
    invoke('has_api_key').then(setHasKey).catch(() => setHasKey(false))
  }, [view])

  const handleSend = useCallback(async (text) => {
    setError(null)

    const userMsg = { id: String(Date.now()), role: 'user', content: text, ts: new Date() }
    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)

    try {
      // Build message history for the API (only role + content)
      const history = [...messages, userMsg]
        .filter(m => m.id !== 'welcome')
        .map(({ role, content }) => ({ role, content }))

      const reply = await invoke('chat', {
        system:   SYSTEM_PROMPT,
        messages: history,
      })

      setMessages(prev => [
        ...prev,
        { id: String(Date.now() + 1), role: 'assistant', content: reply, ts: new Date() },
      ])
    } catch (e) {
      const errMsg = String(e)
      setError(errMsg)
      // Show error as system message so user sees it inline
      setMessages(prev => [
        ...prev,
        { id: String(Date.now() + 1), role: 'assistant', content: `Fehler: ${errMsg}`, ts: new Date(), isError: true },
      ])
    } finally {
      setIsTyping(false)
    }
  }, [messages])

  return (
    <div
      className="flex flex-col h-full"
      style={{
        background:   'rgba(9, 9, 18, 0.87)',
        borderRadius: 10,
        overflow:     'hidden',
        boxShadow:    '0 0 0 1px rgba(255,255,255,0.07), 0 24px 60px rgba(0,0,0,0.55)',
      }}
    >
      <TitleBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar currentView={view} onNavigate={setView} />
        <main className="flex-1 min-w-0">
          {view === 'chat'     && <ChatView messages={messages} isTyping={isTyping} onSend={handleSend} error={error} hasKey={hasKey} onGoSettings={() => setView('settings')} />}
          {view === 'tasks'    && <TasksView />}
          {view === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  )
}
