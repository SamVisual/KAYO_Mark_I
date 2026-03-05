import { useState, useEffect, useCallback } from 'react'
import { Settings, Eye, EyeOff, Check, Trash2 } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'

const MODELS = [
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { id: 'claude-opus-4-6',          label: 'Claude Opus 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
]

export default function SettingsView() {
  const [apiKey, setApiKey]       = useState('')
  const [hasKey, setHasKey]       = useState(false)
  const [showKey, setShowKey]     = useState(false)
  const [model, setModel]         = useState(MODELS[0].id)
  const [saving, setSaving]       = useState(false)
  const [status, setStatus]       = useState(null) // { type: 'ok'|'err', msg }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [keyExists, currentModel] = await Promise.all([
          invoke('has_api_key'),
          invoke('get_model'),
        ])
        if (cancelled) return
        setHasKey(keyExists)
        if (MODELS.some(m => m.id === currentModel)) {
          setModel(currentModel)
        }
      } catch {
        // first launch without config
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const flash = useCallback((type, msg) => {
    setStatus({ type, msg })
    setTimeout(() => setStatus(null), 3000)
  }, [])

  const handleSaveKey = useCallback(async () => {
    const trimmed = apiKey.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      await invoke('set_api_key', { key: trimmed })
      setHasKey(true)
      setApiKey('')
      setShowKey(false)
      flash('ok', 'API Key gespeichert')
    } catch (e) {
      flash('err', String(e))
    } finally {
      setSaving(false)
    }
  }, [apiKey, flash])

  const handleClearKey = useCallback(async () => {
    setSaving(true)
    try {
      await invoke('clear_api_key')
      setHasKey(false)
      flash('ok', 'API Key entfernt')
    } catch (e) {
      flash('err', String(e))
    } finally {
      setSaving(false)
    }
  }, [flash])

  const handleModelChange = useCallback(async (id) => {
    setModel(id)
    try {
      await invoke('set_model', { model: id })
      flash('ok', 'Modell geändert')
    } catch (e) {
      flash('err', String(e))
    }
  }, [flash])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(129,140,248,0.14)', border: '1px solid rgba(129,140,248,0.28)' }}
        >
          <Settings size={16} style={{ color: '#818cf8' }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>Einstellungen</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-md mx-auto flex flex-col gap-8">

          {/* Status toast */}
          {status && (
            <div
              className="px-4 py-2.5 rounded-xl text-sm anim-fade-up"
              style={{
                background: status.type === 'ok' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
                border:     `1px solid ${status.type === 'ok' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
                color:      status.type === 'ok' ? '#4ade80' : '#f87171',
              }}
            >
              {status.msg}
            </div>
          )}

          {/* API Key */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Anthropic API Key
            </h3>

            {hasKey ? (
              <div className="flex items-center gap-3">
                <div
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.5)' }}
                >
                  sk-ant-•••••••••••••••
                </div>
                <button
                  onClick={handleClearKey}
                  disabled={saving}
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                  style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}
                  title="Key entfernen"
                >
                  <Trash2 size={14} style={{ color: '#f87171' }} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
                >
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveKey()}
                    placeholder="sk-ant-..."
                    className="flex-1 bg-transparent outline-none text-sm"
                    style={{ color: 'rgba(255,255,255,0.88)', caretColor: '#818cf8' }}
                  />
                  <button
                    onClick={() => setShowKey(v => !v)}
                    className="shrink-0 p-1 rounded transition-colors"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  onClick={handleSaveKey}
                  disabled={!apiKey.trim() || saving}
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all"
                  style={{
                    background: apiKey.trim() ? 'linear-gradient(135deg, #818cf8, #a78bfa)' : 'rgba(255,255,255,0.05)',
                    opacity:    apiKey.trim() ? 1 : 0.4,
                  }}
                  title="Speichern"
                >
                  <Check size={14} className="text-white" />
                </button>
              </div>
            )}
            <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Dein Key wird lokal gespeichert und nie an das Frontend weitergegeben.
            </p>
          </section>

          {/* Model */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Modell
            </h3>
            <div className="flex flex-col gap-1.5">
              {MODELS.map(m => {
                const active = model === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => handleModelChange(m.id)}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all"
                    style={{
                      background: active ? 'rgba(129,140,248,0.12)' : 'rgba(255,255,255,0.03)',
                      border:     `1px solid ${active ? 'rgba(129,140,248,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0 transition-all"
                      style={{
                        background: active ? '#818cf8' : 'transparent',
                        border:     active ? '2px solid #818cf8' : '2px solid rgba(255,255,255,0.2)',
                      }}
                    />
                    <span className="text-sm" style={{ color: active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)' }}>
                      {m.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
