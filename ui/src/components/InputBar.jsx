import { useState, useRef, useCallback } from 'react'
import { ArrowUp, AtSign } from 'lucide-react'

export default function InputBar({ onSend, disabled }) {
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
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  const canSend = value.trim().length > 0 && !disabled

  return (
    <div
      className="flex items-end gap-3 px-4 py-3 rounded-xl transition-all duration-200"
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
        placeholder="Schreib etwas…  @ für Agenten  (Enter senden)"
        rows={1}
        disabled={disabled}
        className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed"
        style={{
          color:      'rgba(255,255,255,0.85)',
          caretColor: '#00d4ff',
          maxHeight:  '160px',
          overflowY:  'auto',
        }}
      />

      <button
        onClick={() => { setValue(v => v + '@'); textareaRef.current?.focus() }}
        tabIndex={-1}
        className="shrink-0 p-1.5 rounded-md transition-colors duration-150"
        style={{ color: 'rgba(255,255,255,0.22)' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(0,212,255,0.7)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.22)')}
      >
        <AtSign size={13} />
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
          boxShadow:  canSend ? '0 2px 14px rgba(0,212,255,0.4)' : 'none',
        }}
      >
        <ArrowUp size={14} style={{ color: canSend ? '#000' : 'rgba(255,255,255,0.5)' }} />
      </button>
    </div>
  )
}
