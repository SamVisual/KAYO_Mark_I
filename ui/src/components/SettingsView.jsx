import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Settings, Eye, EyeOff, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'

export default function SettingsView({ apiKey, setApiKey, onSaved }) {
  const [inputKey, setInputKey] = useState(apiKey ?? '')
  const [showKey, setShowKey]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [feedback, setFeedback] = useState(null) // { type: 'ok' | 'error', msg: string }
  const [memCount, setMemCount] = useState(null)
  const [clearing, setClearing] = useState(false)

  // Keep input in sync if parent updates the key (e.g. on first load).
  useEffect(() => {
    setInputKey(apiKey ?? '')
  }, [apiKey])

  // Fetch memory entry count on mount.
  useEffect(() => {
    invoke('memory_count')
      .then(n => setMemCount(n))
      .catch(() => setMemCount(0))
  }, [])

  async function handleSave() {
    const key = inputKey.trim()
    if (!key) {
      setFeedback({ type: 'error', msg: 'Bitte einen API-Key eingeben.' })
      return
    }
    setSaving(true)
    setFeedback(null)
    try {
      await invoke('save_api_key', { key })
      setApiKey(key)
      setFeedback({ type: 'ok', msg: 'API-Key gespeichert!' })
      setTimeout(() => onSaved?.(), 800)
    } catch (err) {
      setFeedback({ type: 'error', msg: `Fehler beim Speichern: ${err}` })
    } finally {
      setSaving(false)
    }
  }

  async function handleClearMemory() {
    setClearing(true)
    setFeedback(null)
    try {
      await invoke('memory_clear')
      setMemCount(0)
      setFeedback({ type: 'ok', msg: 'Gedächtnis gelöscht.' })
    } catch (err) {
      setFeedback({ type: 'error', msg: `Fehler: ${err}` })
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-8 anim-fade-up">
      <div className="max-w-lg w-full mx-auto flex flex-col gap-8">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.25)' }}
          >
            <Settings size={18} style={{ color: '#818cf8' }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white/80">Einstellungen</h2>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>KAYO Mark I</p>
          </div>
        </div>

        {/* ── API Key ── */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Anthropic API-Key
          </label>

          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={inputKey}
              onChange={e => setInputKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="sk-ant-api03-..."
              className="w-full pr-10 py-2.5 px-3 rounded-lg text-sm outline-none transition-colors"
              style={{
                background:   'rgba(255,255,255,0.05)',
                border:       '1px solid rgba(255,255,255,0.1)',
                color:        'rgba(255,255,255,0.8)',
              }}
              onFocus={e  => (e.target.style.borderColor = 'rgba(129,140,248,0.6)')}
              onBlur={e   => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
            <button
              onClick={() => setShowKey(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: 'rgba(255,255,255,0.3)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
              tabIndex={-1}
            >
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Wird lokal in deinem App-Datenverzeichnis gespeichert – nie an Dritte übertragen.
            Erhältlich auf{' '}
            <span style={{ color: 'rgba(129,140,248,0.7)' }}>console.anthropic.com</span>
          </p>

          <button
            onClick={handleSave}
            disabled={saving}
            className="self-start px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #818cf8, #a78bfa)', color: '#fff' }}
          >
            {saving ? 'Speichern…' : 'Speichern & Starten'}
          </button>
        </div>

        {/* ── Feedback ── */}
        {feedback && (
          <div
            className="flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg"
            style={{
              background: feedback.type === 'ok'
                ? 'rgba(34,197,94,0.1)'
                : 'rgba(239,68,68,0.1)',
              border: `1px solid ${feedback.type === 'ok'
                ? 'rgba(34,197,94,0.25)'
                : 'rgba(239,68,68,0.25)'}`,
              color: feedback.type === 'ok' ? '#4ade80' : '#f87171',
            }}
          >
            {feedback.type === 'ok'
              ? <CheckCircle2 size={14} />
              : <AlertCircle   size={14} />
            }
            {feedback.msg}
          </div>
        )}

        {/* ── Divider ── */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

        {/* ── Memory ── */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Langzeitgedächtnis
          </label>

          <div
            className="flex items-center justify-between px-4 py-3 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Gespeicherte Erinnerungen
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {memCount === null
                  ? 'Lade…'
                  : `${memCount} Eintrag${memCount !== 1 ? 'e' : ''}`}
              </p>
            </div>

            <button
              onClick={handleClearMemory}
              disabled={clearing || memCount === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity disabled:opacity-30"
              style={{
                background: 'rgba(239,68,68,0.12)',
                color:      '#f87171',
                border:     '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <Trash2 size={12} />
              {clearing ? 'Löschen…' : 'Alles löschen'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
