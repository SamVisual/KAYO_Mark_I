import { memo } from 'react'
import { KayoAvatar } from './KayoAvatar.jsx'

function fmt(date) {
  return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(date)
}

export default memo(function MessageBubble({ message, groupWithPrev }) {
  const isKayo   = message.role === 'assistant'
  const spacing  = groupWithPrev ? 'mb-1' : 'mb-4'
  const showMeta = !groupWithPrev

  if (isKayo) {
    return (
      <div className={`flex items-end gap-2.5 ${spacing} anim-slide-left`}>
        {/* Avatar – hidden when grouped to keep visual alignment */}
        <div style={{ width: 28, height: 28, flexShrink: 0, marginBottom: 4, opacity: showMeta ? 1 : 0 }}>
          <KayoAvatar size={28} />
        </div>

        <div className="max-w-[76%]">
          <div
            className="px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm leading-relaxed whitespace-pre-wrap"
            style={{
              background: 'rgba(255,255,255,0.055)',
              border:     '1px solid rgba(255,255,255,0.09)',
              color:      'rgba(255,255,255,0.88)',
            }}
          >
            {message.content}
          </div>
          {showMeta && (
            <p className="font-mono-label mt-1 ml-1" style={{ color: 'rgba(255,255,255,0.22)' }}>
              KAYO · {fmt(message.ts)}
            </p>
          )}
        </div>
      </div>
    )
  }

  // User bubble — right-aligned, cyan tint
  return (
    <div className={`flex flex-col items-end ${spacing} anim-slide-right`}>
      <div className="max-w-[76%]">
        <div
          className="px-4 py-2.5 rounded-2xl rounded-br-sm text-sm leading-relaxed whitespace-pre-wrap"
          style={{
            background: 'rgba(0,212,255,0.1)',
            border:     '1px solid rgba(0,212,255,0.22)',
            color:      'rgba(255,255,255,0.9)',
          }}
        >
          {message.content}
        </div>
        {showMeta && (
          <p className="font-mono-label mt-1 mr-1 text-right" style={{ color: 'rgba(255,255,255,0.22)' }}>
            Du · {fmt(message.ts)}
          </p>
        )}
      </div>
    </div>
  )
})
