import { KayoAvatar } from './ChatView.jsx'

function fmt(date) {
  return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(date)
}

export default function MessageBubble({ message, groupWithPrev }) {
  const isKayo   = message.role === 'assistant'
  const spacing  = groupWithPrev ? 'mb-1' : 'mb-4'
  const showMeta = !groupWithPrev

  const isError = message.isError

  if (isKayo) {
    return (
      <div className={`flex items-end gap-2.5 ${spacing} anim-slide-left`}>
        {/* Avatar – hidden when grouped */}
        <div style={{ width: 28, height: 28, flexShrink: 0, marginBottom: 4, opacity: showMeta ? 1 : 0 }}>
          <KayoAvatar size={28} />
        </div>

        <div className="max-w-[76%]">
          <div
            className="px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm leading-relaxed"
            style={{
              background: isError ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.065)',
              border:     isError ? '1px solid rgba(248,113,113,0.25)' : '1px solid rgba(255,255,255,0.09)',
              color:      isError ? '#f87171' : 'rgba(255,255,255,0.88)',
            }}
          >
            {message.content}
          </div>
          {showMeta && (
            <p className="text-xs mt-1 ml-1" style={{ color: 'rgba(255,255,255,0.26)' }}>
              KAYO · {fmt(message.ts)}
            </p>
          )}
        </div>
      </div>
    )
  }

  // User bubble — right-aligned
  return (
    <div className={`flex flex-col items-end ${spacing} anim-slide-right`}>
      <div className="max-w-[76%]">
        <div
          className="px-4 py-2.5 rounded-2xl rounded-br-sm text-sm leading-relaxed"
          style={{
            background: 'linear-gradient(135deg, rgba(129,140,248,0.22), rgba(167,139,250,0.18))',
            border:     '1px solid rgba(129,140,248,0.28)',
            color:      'rgba(255,255,255,0.92)',
          }}
        >
          {message.content}
        </div>
        {showMeta && (
          <p className="text-xs mt-1 mr-1 text-right" style={{ color: 'rgba(255,255,255,0.26)' }}>
            Du · {fmt(message.ts)}
          </p>
        )}
      </div>
    </div>
  )
}
