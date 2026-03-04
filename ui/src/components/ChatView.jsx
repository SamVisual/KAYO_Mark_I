import { useRef, useEffect } from 'react'
import MessageBubble from './MessageBubble.jsx'
import InputBar from './InputBar.jsx'
import { KayoAvatar } from './KayoAvatar.jsx'

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5 mb-3 anim-slide-left">
      <KayoAvatar />
      <div
        className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-bl-sm"
        style={{
          background: 'rgba(255,255,255,0.055)',
          border:     '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <span className="typing-dot w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.45)' }} />
        <span className="typing-dot w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.45)' }} />
        <span className="typing-dot w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.45)' }} />
      </div>
    </div>
  )
}

export default function ChatView({ messages, isTyping, onSend, activeAgent }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  return (
    <div className="flex flex-col h-full">
      {/* ── Chat header ── */}
      <div
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.055)' }}
      >
        <div className="flex items-center gap-3">
          <KayoAvatar size={32} />
          <div>
            <p className="text-sm font-semibold leading-tight text-white/85">KAYO</p>
            <p className="font-mono-label" style={{ color: 'rgba(255,255,255,0.32)' }}>
              Persönlicher Assistent · Mark I
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Active agent badge */}
          {activeAgent && activeAgent !== 'claude' && (
            <span
              className="font-mono-label px-2 py-1 rounded-md capitalize"
              style={{
                background: 'rgba(0,212,255,0.08)',
                border:     '1px solid rgba(0,212,255,0.2)',
                color:      'rgba(0,212,255,0.7)',
              }}
            >
              {activeAgent}
            </span>
          )}

          {/* Live status */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full status-glow" style={{ background: '#4ade80' }} />
            <span className="font-mono-label" style={{ color: 'rgba(255,255,255,0.38)' }}>Aktiv</span>
          </div>
        </div>
      </div>

      {/* ── Message list ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-2xl mx-auto flex flex-col">
          {messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              groupWithPrev={i > 0 && messages[i - 1].role === msg.role}
            />
          ))}
          {/* aria-live region announces typing state to screen readers */}
          <div aria-live="polite" aria-label={isTyping ? 'KAYO schreibt…' : undefined}>
            {isTyping && <TypingIndicator />}
          </div>
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input area ── */}
      <div className="shrink-0 px-6 pb-5 pt-2">
        <div className="max-w-2xl mx-auto">
          <InputBar onSend={onSend} disabled={isTyping} />
        </div>
      </div>
    </div>
  )
}
