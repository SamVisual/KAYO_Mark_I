import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Settings, Eye, EyeOff, Check, X } from 'lucide-react'
import { PROVIDERS } from '../config/models.js'

const PROVIDER_KEYS = Object.keys(PROVIDERS) // ['anthropic', 'openai', 'google']

// ── Single API key row ────────────────────────────────────────────────────────
function ApiKeyRow({ providerKey, providerName, isSet, onSaved, onCleared }) {
  const [editing, setEditing] = useState(false)
  const [value,   setValue]   = useState('')
  const [show,    setShow]    = useState(false)
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState('')

  async function handleSave() {
    if (!value.trim()) return
    setBusy(true)
    setError('')
    try {
      await invoke('save_api_key', { provider: providerKey, key: value.trim() })
      setValue('')
      setEditing(false)
      setShow(false)
      onSaved()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleClear() {
    setBusy(true)
    setError('')
    try {
      await invoke('clear_api_key', { provider: providerKey })
      setEditing(false)
      setValue('')
      onCleared()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') { setEditing(false); setValue(''); setError('') }
  }

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>
          {providerName}
        </span>
        {isSet && !editing && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}
          >
            aktiv
          </span>
        )}
      </div>

      {/* Status or input */}
      {!editing ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {isSet ? '●●●●●●●●●●●● (gesetzt)' : 'Kein API Key hinterlegt'}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {isSet && (
              <button
                onClick={handleClear}
                disabled={busy}
                className="text-xs px-2.5 py-1 rounded-lg transition-colors duration-150"
                style={{ color: 'rgba(255,100,100,0.7)', background: 'rgba(255,100,100,0.08)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,100,100,0.15)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,100,100,0.08)' }}
              >
                Entfernen
              </button>
            )}
            <button
              onClick={() => setEditing(true)}
              disabled={busy}
              className="text-xs px-2.5 py-1 rounded-lg transition-colors duration-150"
              style={{
                color:      'rgba(255,255,255,0.7)',
                background: 'rgba(255,255,255,0.07)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
            >
              {isSet ? 'Ändern' : 'Speichern'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(129,140,248,0.3)' }}
          >
            <input
              autoFocus
              type={show ? 'text' : 'password'}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`${providerName} API Key einfügen…`}
              className="flex-1 bg-transparent outline-none text-xs font-mono"
              style={{ color: 'rgba(255,255,255,0.85)', caretColor: '#818cf8' }}
            />
            <button
              onClick={() => setShow(v => !v)}
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              {show ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>

          {error && (
            <p className="text-[10px]" style={{ color: '#f87171' }}>{error}</p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={busy || !value.trim()}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all duration-150"
              style={{
                background: value.trim() ? 'linear-gradient(135deg,#818cf8,#a78bfa)' : 'rgba(255,255,255,0.07)',
                color:      value.trim() ? 'white' : 'rgba(255,255,255,0.3)',
              }}
            >
              <Check size={11} />
              Speichern
            </button>
            <button
              onClick={() => { setEditing(false); setValue(''); setError('') }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors duration-150"
              style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)' }}
            >
              <X size={11} />
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Settings view ─────────────────────────────────────────────────────────────
export default function SettingsView({ onKeyStatusChange }) {
  const [keyStatus, setKeyStatus] = useState({})

  const refreshStatus = useCallback(async () => {
    const result = {}
    await Promise.all(
      PROVIDER_KEYS.map(async (pk) => {
        result[pk] = await invoke('has_api_key', { provider: pk }).catch(() => false)
      })
    )
    setKeyStatus(result)
    onKeyStatusChange?.(result)
  }, [onKeyStatusChange])

  useEffect(() => { refreshStatus() }, [refreshStatus])

  return (
    <div className="flex flex-col h-full anim-fade-up">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Settings size={15} style={{ color: 'rgba(255,255,255,0.5)' }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
            Einstellungen
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            KAYO Mark I Konfiguration
          </p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-lg mx-auto flex flex-col gap-6">

          {/* API Keys section */}
          <section>
            <h2
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              API Keys
            </h2>
            <div className="flex flex-col gap-3">
              {PROVIDER_KEYS.map(pk => (
                <ApiKeyRow
                  key={pk}
                  providerKey={pk}
                  providerName={PROVIDERS[pk].name}
                  isSet={!!keyStatus[pk]}
                  onSaved={refreshStatus}
                  onCleared={refreshStatus}
                />
              ))}
            </div>
          </section>

          {/* Hint */}
          <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.2)' }}>
            API Keys werden verschlüsselt im App-Datenverzeichnis gespeichert und verlassen den
            lokalen Prozess nicht. Sie werden niemals an das Frontend übertragen.
          </p>
        </div>
      </div>
    </div>
  )
}
