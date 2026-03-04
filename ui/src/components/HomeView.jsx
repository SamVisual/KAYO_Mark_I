import { useState, useRef, useCallback } from 'react'
import { ArrowUp, AtSign, ChevronRight, Zap, Code2, Sun, TrendingUp } from 'lucide-react'

// ── Agent tab definitions ─────────────────────────────────────────────────────

const AGENTS = [
  { id: 'claude',   label: 'Claude',   Icon: Zap,         color: '#00d4ff' },
  { id: 'coder',    label: 'Coder',    Icon: Code2,        color: '#4ade80' },
  { id: 'alltag',   label: 'Alltag',   Icon: Sun,          color: '#fb923c' },
  { id: 'finanzen', label: 'Finanzen', Icon: TrendingUp,   color: '#facc15' },
]

// ── Recent session card ───────────────────────────────────────────────────────

function RecentCard({ title, snippet, time, onClick, delay }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`rainbow-border-top relative flex flex-col gap-2 p-4 rounded-lg text-left w-full transition-all duration-200 anim-fade-up ${delay}`}
      style={{
        background:  hovered ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        border:      `1px solid ${hovered ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)'}`,
        boxShadow:   hovered ? '0 4px 24px rgba(0,0,0,0.3)' : 'none',
        transform:   hovered ? 'translateY(-1px)' : 'none',
      }}
    >
      <p className="text-xs font-semibold text-white/60 truncate">{title}</p>
      <p
        className="text-xs leading-relaxed line-clamp-2"
        style={{ color: 'rgba(255,255,255,0.35)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {snippet}
      </p>
      <p className="font-mono-label text-white/20 mt-auto">{time}</p>
    </button>
  )
}

// ── Home input bar ────────────────────────────────────────────────────────────

function HomeInput({ onSend, disabled }) {
  const [value, setValue]     = useState('')
  const [focused, setFocused] = useState(false)
  const textareaRef           = useRef(null)

  const send = useCallback(() => {
    const text = value.trim()
    if (!text || disabled) return
    onSend(text)
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }, [value, disabled, onSend])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const handleInput = (e) => {
    setValue(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }

  const canSend = value.trim().length > 0 && !disabled

  return (
    <div
      className="flex items-end gap-3 px-4 py-3.5 rounded-xl transition-all duration-200"
      style={{
        background:     'rgba(255,255,255,0.04)',
        border:         `1px solid ${focused || canSend ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
        backdropFilter: 'blur(12px)',
        boxShadow:      focused ? '0 0 0 3px rgba(0,212,255,0.06)' : 'none',
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKey}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Sag KAYO was du brauchst...  @ für Agenten"
        rows={1}
        disabled={disabled}
        className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed"
        style={{
          color:      'rgba(255,255,255,0.85)',
          caretColor: '#00d4ff',
          maxHeight:  '140px',
          overflowY:  'auto',
        }}
      />

      {/* @ shortcut hint */}
      <button
        onClick={() => {
          setValue(v => v + '@')
          textareaRef.current?.focus()
        }}
        tabIndex={-1}
        className="shrink-0 p-1.5 rounded-md transition-colors duration-150"
        style={{ color: 'rgba(255,255,255,0.22)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(0,212,255,0.7)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.22)')}
      >
        <AtSign size={14} />
      </button>

      <button
        onClick={send}
        disabled={!canSend}
        aria-label="Nachricht senden"
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-150"
        style={{
          background: canSend ? '#00d4ff' : 'rgba(255,255,255,0.07)',
          opacity:    canSend ? 1 : 0.4,
          transform:  canSend ? 'scale(1)' : 'scale(0.88)',
          boxShadow:  canSend ? '0 2px 14px rgba(0,212,255,0.45)' : 'none',
        }}
      >
        <ArrowUp size={14} style={{ color: canSend ? '#000' : 'rgba(255,255,255,0.5)' }} />
      </button>
    </div>
  )
}

// ── Main HomeView ─────────────────────────────────────────────────────────────

export default function HomeView({
  messages,
  activeAgent,
  onAgentChange,
  onSend,
  isTyping,
  onContinueChat,
}) {
  // Derive recent messages from history (last 3 user messages, skip system flag)
  const recentMsgs = messages
    .filter(m => !m.system && m.role === 'user')
    .slice(-3)
    .reverse()

  // Whether there's an ongoing conversation to continue
  const hasHistory = messages.filter(m => !m.system).length > 0

  // Fallback starter prompts when no history
  const STARTERS = [
    { title: 'Was steht heute an?',          snippet: 'Plane deinen Tag, setze Prioritäten und behalte den Überblick über offene Aufgaben.' },
    { title: 'Hilf mir beim Coden',          snippet: 'Code Review, Debugging, Architektur-Fragen – KAYO kennt deinen Stack.' },
    { title: 'Ideen entwickeln',             snippet: 'Brainstorming, Konzepte ausarbeiten, Entscheidungen strukturieren.' },
  ]

  function relativeTime(ts) {
    const diff = Date.now() - ts.getTime()
    const min  = Math.floor(diff / 60000)
    if (min < 2)  return 'gerade eben'
    if (min < 60) return `vor ${min} Min`
    const h = Math.floor(min / 60)
    if (h  < 24) return `vor ${h} Std`
    return `vor ${Math.floor(h / 24)} Tagen`
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[680px] mx-auto px-8 pt-16 pb-6 flex flex-col gap-10">

          {/* ── Greeting ── */}
          <div className="anim-fade-up">
            <p
              className="font-mono-label mb-2"
              style={{ color: 'rgba(0,212,255,0.7)' }}
            >
              Guten Tag
            </p>
            <h1
              className="font-bold leading-tight"
              style={{ fontSize: 38, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em' }}
            >
              Hey Sam,
            </h1>
            <h1
              className="font-semibold leading-tight"
              style={{ fontSize: 38, color: 'rgba(255,255,255,0.45)', letterSpacing: '-0.02em' }}
            >
              was bauen wir heute?
            </h1>
          </div>

          {/* ── Agent tabs ── */}
          <div className="anim-fade-up anim-delay-1">
            <p
              className="font-mono-label uppercase tracking-widest mb-3"
              style={{ color: 'rgba(255,255,255,0.25)' }}
            >
              Aktive Agenten
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {AGENTS.map(({ id, label, Icon, color }) => {
                const active = activeAgent === id
                return (
                  <button
                    key={id}
                    onClick={() => onAgentChange(id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150"
                    style={{
                      background: active ? `${color}18` : 'rgba(255,255,255,0.04)',
                      border:     `1px solid ${active ? `${color}50` : 'rgba(255,255,255,0.08)'}`,
                      color:      active ? color : 'rgba(255,255,255,0.4)',
                      boxShadow:  active ? `0 0 12px ${color}22` : 'none',
                    }}
                  >
                    <Icon size={12} />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Recent / Starters ── */}
          <div className="anim-fade-up anim-delay-2">
            <div className="flex items-center justify-between mb-3">
              <p
                className="font-mono-label uppercase tracking-widest"
                style={{ color: 'rgba(255,255,255,0.25)' }}
              >
                {hasHistory ? 'Zuletzt' : 'Starten mit'}
              </p>
              {hasHistory && (
                <button
                  onClick={onContinueChat}
                  className="flex items-center gap-1 text-xs font-medium transition-colors duration-150"
                  style={{ color: 'rgba(0,212,255,0.6)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#00d4ff')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(0,212,255,0.6)')}
                >
                  Gespräch fortsetzen <ChevronRight size={12} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {hasHistory
                ? recentMsgs.map((msg, i) => (
                    <RecentCard
                      key={msg.id}
                      title={`Nachricht ${i === 0 ? '(zuletzt)' : ''}`}
                      snippet={msg.content}
                      time={relativeTime(msg.ts)}
                      onClick={onContinueChat}
                      delay={`anim-delay-${i + 1}`}
                    />
                  ))
                : STARTERS.map((s, i) => (
                    <RecentCard
                      key={s.title}
                      title={s.title}
                      snippet={s.snippet}
                      time="Klicken zum Starten"
                      onClick={() => onSend(s.title)}
                      delay={`anim-delay-${i + 1}`}
                    />
                  ))
              }
              {/* Fill remaining slots if fewer than 3 recent messages */}
              {hasHistory && recentMsgs.length < 3 &&
                STARTERS.slice(recentMsgs.length).map((s, i) => (
                  <RecentCard
                    key={s.title}
                    title={s.title}
                    snippet={s.snippet}
                    time="Klicken zum Starten"
                    onClick={() => onSend(s.title)}
                    delay={`anim-delay-${recentMsgs.length + i + 1}`}
                  />
                ))
              }
            </div>
          </div>

        </div>
      </div>

      {/* ── Fixed bottom input ── */}
      <div className="shrink-0 px-8 pb-6 pt-3">
        <div className="max-w-[680px] mx-auto">
          <HomeInput onSend={onSend} disabled={isTyping} />
        </div>
      </div>
    </div>
  )
}
