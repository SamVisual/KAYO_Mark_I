import { useState, useRef, useCallback } from 'react'
import { ArrowUp } from 'lucide-react'

export default function InputBar({ onSend, disabled }) {
  const [value, setValue] = useState('')
  const textareaRef       = useRef(null)

  const send = useCallback(() => {
    const text = value.trim()
    if (!text || disabled) return
    onSend(text)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, disabled, onSend])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const handleInput = (e) => {
    setValue(e.target.value)
    const el    = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  const canSend = value.trim().length > 0 && !disabled

  return (
    <div
      className="flex items-end gap-3 px-4 py-3 rounded-2xl transition-all duration-200"
      style={{
        background:     'rgba(255,255,255,0.05)',
        border:         `1px solid ${canSend ? 'rgba(129,140,248,0.3)' : 'rgba(255,255,255,0.09)'}`,
        backdropFilter: 'blur(8px)',
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKey}
        placeholder="Schreib etwas… (Enter zum Senden)"
        rows={1}
        disabled={disabled}
        className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed"
        style={{
          color:      'rgba(255,255,255,0.88)',
          caretColor: '#818cf8',
          maxHeight:  '160px',
          overflowY:  'auto',
        }}
      />

      <button
        onClick={send}
        disabled={!canSend}
        aria-label="Nachricht senden"
        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-150"
        style={{
          background: canSend
            ? 'linear-gradient(135deg, #818cf8, #a78bfa)'
            : 'rgba(255,255,255,0.07)',
          opacity:   canSend ? 1 : 0.45,
          transform: canSend ? 'scale(1)' : 'scale(0.88)',
          boxShadow: canSend ? '0 2px 12px rgba(129,140,248,0.4)' : 'none',
        }}
      >
        <ArrowUp size={15} className="text-white" />
      </button>
    </div>
  )
}
