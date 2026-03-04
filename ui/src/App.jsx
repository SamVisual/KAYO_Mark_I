import { useState, useCallback, useEffect } from 'react'
import { Zap } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import Sidebar from './components/Sidebar.jsx'
import ChatView from './components/ChatView.jsx'
import TasksView from './components/TasksView.jsx'
import SettingsView from './components/SettingsView.jsx'
import SelfModView from './components/SelfModView.jsx'
import { useModel } from './hooks/useModel.js'
import { PROVIDERS } from './config/models.js'

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Du bist KAYO, ein persönlicher KI-Assistent mit der Fähigkeit zur Selbstmodifikation.

Wenn du Änderungen am KAYO-Quellcode vorschlägst, verwende EXAKT dieses Format:
<kayo:proposal>
{"file":"src/components/Beispiel.jsx","description":"Kurze Beschreibung","content":"...vollständiger neuer Dateiinhalt..."}
</kayo:proposal>

Regeln für Proposals:
- "file" ist immer ein relativer Pfad ab dem ui/-Verzeichnis (z.B. "src/App.jsx")
- "content" enthält den vollständigen neuen Dateiinhalt, niemals ein Diff
- Erkläre die Änderung im Text VOR dem Proposal-Block
- Maximal 3 Proposals pro Antwort
- Proposals nur wenn der User explizit Codeänderungen wünscht

Antworte präzise und hilfreich auf Deutsch.`

// ── Proposal parser ───────────────────────────────────────────────────────────
const PROPOSAL_RE = /<kayo:proposal>\s*([\s\S]*?)\s*<\/kayo:proposal>/g

function extractProposals(text) {
  const out = []
  let m
  PROPOSAL_RE.lastIndex = 0
  while ((m = PROPOSAL_RE.exec(text)) !== null) {
    try { out.push(JSON.parse(m[1])) } catch { /* skip malformed */ }
  }
  return out
}

function stripProposals(text) {
  return text.replace(/<kayo:proposal>[\s\S]*?<\/kayo:proposal>/g, '').trim()
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-[100] pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className="px-4 py-2.5 rounded-xl text-xs font-medium anim-fade-up max-w-xs"
          style={{
            background: t.type === 'error'
              ? 'rgba(239,68,68,0.18)'
              : t.type === 'info'
                ? 'rgba(129,140,248,0.18)'
                : 'rgba(74,222,128,0.18)',
            border: `1px solid ${
              t.type === 'error'  ? 'rgba(239,68,68,0.35)'
              : t.type === 'info' ? 'rgba(129,140,248,0.35)'
              :                     'rgba(74,222,128,0.35)'
            }`,
            color: t.type === 'error'  ? '#fca5a5'
                 : t.type === 'info'   ? '#a5b4fc'
                 :                       '#86efac',
            backdropFilter: 'blur(12px)',
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}

function useToast() {
  const [toasts, setToasts] = useState([])
  const addToast = useCallback((message, type = 'info', duration = 4500) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])
  return { toasts, addToast }
}

// ── Title Bar ─────────────────────────────────────────────────────────────────
function TitleBar() {
  const win = getCurrentWindow()
  const controls = [
    { label: '−',  action: () => win.minimize(),        hover: 'hover:bg-white/10'    },
    { label: '⬜', action: () => win.toggleMaximize(), hover: 'hover:bg-white/10', small: true },
    { label: '✕',  action: () => win.close(),           hover: 'hover:bg-red-500/80', hoverText: 'hover:text-white' },
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

// ── Root App ──────────────────────────────────────────────────────────────────
const DEMO_MESSAGES = [
  {
    id:      '1',
    role:    'assistant',
    content: 'Hallo! Ich bin KAYO – dein persönlicher Assistent mit Selbstmodifikations-Fähigkeit. Wähle ein Modell, hinterlege deinen API Key und bitte mich, den Code zu ändern – Vorschläge werden sicher gestaged und im Code-Tab zur Überprüfung bereitgestellt.',
    ts:      new Date(Date.now() - 3 * 60000),
  },
]

export default function App() {
  const [view,       setView]       = useState('chat')
  const [messages,   setMessages]   = useState(DEMO_MESSAGES)
  const [isTyping,   setIsTyping]   = useState(false)
  const [keyStatus,  setKeyStatus]  = useState({ anthropic: false, openai: false, google: false })
  const [stageBadge, setStageBadge] = useState(0)

  const { selectedProvider, selectedModel, setProvider, setModel } = useModel()
  const { toasts, addToast } = useToast()

  const refreshKeyStatus = useCallback(async () => {
    const result = {}
    await Promise.all(
      Object.keys(PROVIDERS).map(async (pk) => {
        result[pk] = await invoke('has_api_key', { provider: pk }).catch(() => false)
      })
    )
    setKeyStatus(result)
  }, [])

  useEffect(() => {
    refreshKeyStatus()
    invoke('get_staged_count').then(n => setStageBadge(n)).catch(() => {})
  }, [refreshKeyStatus])

  // ── Message send handler ──────────────────────────────────────────────────
  const handleSend = useCallback(async (text) => {
    const userMsg = { id: String(Date.now()), role: 'user', content: text, ts: new Date() }
    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))

      const rawReply = await invoke('chat', {
        provider:   selectedProvider,
        model:      selectedModel,
        system:     SYSTEM_PROMPT,
        messages:   history,
        maxTokens:  2048,
      })

      // Parse code proposals and auto-stage them
      const proposals = extractProposals(rawReply)
      const cleanText = stripProposals(rawReply)

      if (proposals.length > 0) {
        let staged = 0
        for (const p of proposals) {
          try {
            await invoke('stage_change', {
              filePath:    p.file,
              newContent:  p.content,
              description: p.description ?? `Änderung in ${p.file}`,
            })
            staged++
          } catch (e) {
            addToast(`Staging fehlgeschlagen (${p.file}): ${e}`, 'error')
          }
        }
        if (staged > 0) {
          setStageBadge(n => n + staged)
          addToast(
            `${staged} Codeänderung${staged !== 1 ? 'en' : ''} gestaged – im Code-Tab prüfen`,
            'info',
          )
        }
      }

      setMessages(prev => [
        ...prev,
        {
          id:      String(Date.now() + 1),
          role:    'assistant',
          content: cleanText || '(Nur Code-Proposals – im Code-Tab prüfen)',
          ts:      new Date(),
        },
      ])
    } catch (err) {
      const errStr = String(err)

      if (errStr.startsWith('NO_API_KEY:')) {
        const prov = errStr.split(':')[1]
        const name = PROVIDERS[prov]?.name ?? prov
        addToast(`Kein API Key für ${name} – bitte in den Einstellungen hinterlegen.`, 'error')
        setView('settings')
      } else if (errStr.includes('401') || errStr.includes('invalid_api_key') || errStr.includes('Unauthorized')) {
        addToast(`API Key für ${PROVIDERS[selectedProvider]?.name ?? selectedProvider} ungültig.`, 'error')
      } else if (errStr.includes('Network error') || errStr.includes('connection')) {
        addToast(`Verbindung zu ${PROVIDERS[selectedProvider]?.name ?? selectedProvider} fehlgeschlagen.`, 'error')
      } else {
        addToast(`Fehler: ${errStr}`, 'error')
      }
    } finally {
      setIsTyping(false)
    }
  }, [messages, selectedProvider, selectedModel, addToast])

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
        <Sidebar currentView={view} onNavigate={setView} stageBadge={stageBadge} />
        <main className="flex-1 min-w-0">
          {view === 'chat' && (
            <ChatView
              messages={messages}
              isTyping={isTyping}
              onSend={handleSend}
              selectedProvider={selectedProvider}
              selectedModel={selectedModel}
              setProvider={setProvider}
              setModel={setModel}
              keyStatus={keyStatus}
              onOpenSettings={() => setView('settings')}
            />
          )}
          {view === 'tasks'    && <TasksView />}
          {view === 'code'     && (
            <SelfModView onStageCountChange={count => setStageBadge(count)} />
          )}
          {view === 'settings' && (
            <SettingsView onKeyStatusChange={status => setKeyStatus(status)} />
          )}
        </main>
      </div>
      <Toast toasts={toasts} />
    </div>
  )
}
