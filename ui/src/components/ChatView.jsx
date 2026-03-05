import { useRef, useEffect } from 'react'
import { Bot, AlertTriangle } from 'lucide-react'
import MessageBubble from './MessageBubble.jsx'
import InputBar from './InputBar.jsx'

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5 mb-3 anim-slide-left">
      <KayoAvatar />
      <div
        className="flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-bl-sm"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border:     '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <span className="typing-dot w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.5)' }} />
        <span className="typing-dot w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.5)' }} />
        <span className="typing-dot w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.5)' }} />
      </div>
    </div>
  )
}

export function KayoAvatar({ size = 28 }) {
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{
        width:      size,
        height:     size,
        background: 'linear-gradient(135deg, #818cf8, #a78bfa)',
        boxShadow:  '0 2px 12px rgba(129,140,248,0.35)',
      }}
    >
      <Bot size={Math.round(size * 0.46)} className="text-white" />
    </div>
  )
}

function ApiKeyBanner({ onGoSettings }) {
  return (
    <div
      className="mx-6 mt-3 px-4 py-3 rounded-xl flex items-center gap-3 anim-fade-up cursor-pointer"
      style={{
        background: 'rgba(250,204,21,0.08)',
        border:     '1px solid rgba(250,204,21,0.2)',
      }}
      onClick={onGoSettings}
    >
      <AlertTriangle size={16} style={{ color: '#facc15', flexShrink: 0 }} />
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
        Kein API Key hinterlegt. <span style={{ color: '#facc15', textDecoration: 'underline' }}>Einstellungen öffnen</span>
      </p>
    </div>
  )
}

export default function ChatView({ messages, isTyping, onSend, hasKey, onGoSettings }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-3">
          <KayoAvatar size={34} />
          <div>
            <p className="text-sm font-semibold leading-tight" style={{ color: 'rgba(255,255,255,0.9)' }}>KAYO</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>Persönlicher Assistent · Mark I</p>
          </div>
        </div>

        {/* Live status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <span
            className={`w-2 h-2 rounded-full ${hasKey ? 'status-glow' : ''}`}
            style={{ background: hasKey ? '#4ade80' : '#facc15' }}
          />
          <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {hasKey ? 'Aktiv' : 'Kein Key'}
          </span>
        </div>
      </div>

      {/* API Key warning */}
      {!hasKey && <ApiKeyBanner onGoSettings={onGoSettings} />}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-2xl mx-auto flex flex-col">
          {messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              groupWithPrev={i > 0 && messages[i - 1].role === msg.role}
            />
          ))}
          {isTyping && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 px-6 pb-5 pt-2">
        <div className="max-w-2xl mx-auto">
          <InputBar onSend={onSend} disabled={isTyping} />
        </div>
      </div>
    </div>
  )
}
