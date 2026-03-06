import { useState, useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Zap } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import Sidebar from './components/Sidebar.jsx'
import ChatView from './components/ChatView.jsx'
import TasksView from './components/TasksView.jsx'
import SettingsView from './components/SettingsView.jsx'

const STORAGE_KEY = 'kayo.settings.v1'

const DEFAULT_SETTINGS = {
  apiKey: '',
  model: 'claude-3-5-sonnet-latest',
  systemPrompt: 'Du bist KAYO, ein hilfreicher persönlicher KI-Assistent. Antworte präzise und freundlich auf Deutsch.',
}

const AVAILABLE_MODELS = [
  { value: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet (latest)' },
  { value: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku (latest)' },
  { value: 'claude-3-opus-latest', label: 'Claude 3 Opus (latest)' },
]

// ── Title Bar ─────────────────────────────────────────────────────────────────
function TitleBar() {
  const win = getCurrentWindow()

  const controls = [
    { label: '−', action: () => win.minimize(), hover: 'hover:bg-white/10' },
    { label: '⬜', action: () => win.toggleMaximize(), hover: 'hover:bg-white/10', small: true },
    { label: '✕', action: () => win.close(), hover: 'hover:bg-red-500/80', hoverText: 'hover:text-white' },
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

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export default function App() {
  const [view, setView] = useState('chat')
  const [settings, setSettings] = useState(loadSettings)
  const [messages, setMessages] = useState([
    {
      id: '1',
      role: 'assistant',
      content: 'Hallo! Trage deinen API-Key in den Einstellungen ein, dann können wir direkt loschatten.',
      ts: new Date(),
    },
  ])
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const handleSend = useCallback(async (text) => {
    const userMsg = { id: String(Date.now()), role: 'user', content: text, ts: new Date() }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)

    if (!settings.apiKey.trim()) {
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          content: 'Bitte hinterlege zuerst einen API-Key in den Einstellungen.',
          ts: new Date(),
        },
      ])
      return
    }

    setIsTyping(true)
    try {
      const historyForApi = nextMessages.map(({ role, content }) => ({ role, content }))
      const answer = await invoke('chat', {
        apiKey: settings.apiKey,
        model: settings.model,
        system: settings.systemPrompt,
        messages: historyForApi,
        maxTokens: 1024,
      })

      setMessages(prev => [
        ...prev,
        { id: String(Date.now() + 2), role: 'assistant', content: answer, ts: new Date() },
      ])
    } catch (error) {
      const errText = typeof error === 'string' ? error : 'Unbekannter Fehler beim API-Aufruf.'
      setMessages(prev => [
        ...prev,
        { id: String(Date.now() + 2), role: 'assistant', content: `Fehler: ${errText}`, ts: new Date() },
      ])
    } finally {
      setIsTyping(false)
    }
  }, [messages, settings])

  return (
    <div
      className="flex flex-col h-full"
      style={{
        background: 'rgba(9, 9, 18, 0.87)',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.07), 0 24px 60px rgba(0,0,0,0.55)',
      }}
    >
      <TitleBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar currentView={view} onNavigate={setView} />
        <main className="flex-1 min-w-0">
          {view === 'chat' && (
            <ChatView
              messages={messages}
              isTyping={isTyping}
              onSend={handleSend}
              model={settings.model}
              models={AVAILABLE_MODELS}
              onModelChange={(model) => setSettings(prev => ({ ...prev, model }))}
              hasApiKey={Boolean(settings.apiKey.trim())}
            />
          )}
          {view === 'tasks' && <TasksView />}
          {view === 'settings' && (
            <SettingsView
              settings={settings}
              models={AVAILABLE_MODELS}
              onChange={setSettings}
            />
          )}
        </main>
      </div>
    </div>
  )
}
