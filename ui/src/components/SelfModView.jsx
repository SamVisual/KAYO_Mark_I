import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  GitBranch, Play, Check, X, ChevronDown, ChevronRight,
  Terminal, Trash2, RefreshCw, ExternalLink, AlertCircle,
} from 'lucide-react'

// ── Diff viewer ───────────────────────────────────────────────────────────────
// Parses unified diff output from `diff -u` and renders colour-coded lines.
// Falls back to showing the full new content when diff is empty.
function DiffViewer({ diff, newContent }) {
  if (!diff) {
    // No diff available – show new content with line numbers
    return (
      <div
        className="overflow-auto rounded-lg text-[11px] font-mono leading-5"
        style={{
          background:  'rgba(0,0,0,0.35)',
          border:      '1px solid rgba(255,255,255,0.07)',
          maxHeight:   280,
        }}
      >
        {newContent.split('\n').map((line, i) => (
          <div
            key={i}
            className="flex"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            <span
              className="select-none pr-3 text-right shrink-0"
              style={{ width: 36, color: 'rgba(255,255,255,0.2)', borderRight: '1px solid rgba(255,255,255,0.07)' }}
            >
              {i + 1}
            </span>
            <span className="px-3 whitespace-pre">{line}</span>
          </div>
        ))}
      </div>
    )
  }

  const lines = diff.split('\n')
  return (
    <div
      className="overflow-auto rounded-lg text-[11px] font-mono leading-5"
      style={{
        background: 'rgba(0,0,0,0.35)',
        border:     '1px solid rgba(255,255,255,0.07)',
        maxHeight:  280,
      }}
    >
      {lines.map((line, i) => {
        let bg    = 'transparent'
        let color = 'rgba(255,255,255,0.45)'

        if (line.startsWith('+++') || line.startsWith('---')) {
          color = 'rgba(255,255,255,0.25)'
        } else if (line.startsWith('@@')) {
          bg    = 'rgba(129,140,248,0.08)'
          color = '#818cf8'
        } else if (line.startsWith('+')) {
          bg    = 'rgba(74,222,128,0.08)'
          color = '#86efac'
        } else if (line.startsWith('-')) {
          bg    = 'rgba(248,113,113,0.08)'
          color = '#fca5a5'
        }

        return (
          <div key={i} style={{ background: bg, color, paddingLeft: 12, whiteSpace: 'pre' }}>
            {line || ' '}
          </div>
        )
      })}
    </div>
  )
}

// ── Single change card ────────────────────────────────────────────────────────
function ChangeCard({ change, onDiscard, disabled }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          {expanded
            ? <ChevronDown size={13} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
            : <ChevronRight size={13} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
          }
          <span
            className="text-xs font-mono truncate"
            style={{ color: 'rgba(129,140,248,0.9)' }}
          >
            {change.file_path}
          </span>
        </button>

        <span
          className="text-[10px] shrink-0 max-w-[180px] truncate"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          title={change.description}
        >
          {change.description}
        </span>

        <button
          onClick={() => onDiscard(change.file_path)}
          disabled={disabled}
          title="Änderung verwerfen"
          className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-colors duration-150"
          style={{ color: 'rgba(255,100,100,0.6)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,100,100,0.12)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <X size={12} />
        </button>
      </div>

      {/* Diff */}
      {expanded && (
        <div className="px-4 pb-4">
          <DiffViewer diff={change.diff} newContent={change.new_content} />
        </div>
      )}
    </div>
  )
}

// ── Console output panel ──────────────────────────────────────────────────────
function ConsolePanel({ entries }) {
  const COLOR = { log: 'rgba(255,255,255,0.6)', warn: '#fbbf24', error: '#f87171' }

  return (
    <div
      className="rounded-xl overflow-auto font-mono text-[10px] leading-5"
      style={{
        background: 'rgba(0,0,0,0.45)',
        border:     '1px solid rgba(255,255,255,0.08)',
        maxHeight:  160,
      }}
    >
      {entries.length === 0 ? (
        <p className="px-3 py-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Warte auf Vite-Ausgabe…
        </p>
      ) : (
        entries.map((e, i) => (
          <div key={i} className="px-3 flex gap-2" style={{ color: COLOR[e.level] ?? COLOR.log }}>
            <span style={{ color: 'rgba(255,255,255,0.2)', userSelect: 'none' }}>›</span>
            <span className="whitespace-pre-wrap">{e.message}</span>
          </div>
        ))
      )}
    </div>
  )
}

// ── Status banner ─────────────────────────────────────────────────────────────
function StatusBanner({ status }) {
  if (!status) return null
  const isError = status.type === 'error'
  return (
    <div
      className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-xs"
      style={{
        background: isError ? 'rgba(239,68,68,0.1)' : 'rgba(74,222,128,0.1)',
        border:     `1px solid ${isError ? 'rgba(239,68,68,0.25)' : 'rgba(74,222,128,0.25)'}`,
        color:      isError ? '#fca5a5' : '#86efac',
      }}
    >
      <AlertCircle size={14} className="shrink-0 mt-0.5" />
      <span>{status.text}</span>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────
export default function SelfModView({ onStageCountChange }) {
  const [changes,       setChanges]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [busy,          setBusy]          = useState(false)
  const [previewUrl,    setPreviewUrl]    = useState(null)
  const [consoleOutput, setConsoleOutput] = useState([])
  const [showConsole,   setShowConsole]   = useState(false)
  const [status,        setStatus]        = useState(null)

  const refresh = useCallback(async () => {
    try {
      const data = await invoke('get_staged_changes')
      setChanges(data)
      onStageCountChange?.(data.length)
    } catch (e) {
      setStatus({ type: 'error', text: String(e) })
    }
  }, [onStageCountChange])

  // Initial load
  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  // Poll console output while preview is active
  useEffect(() => {
    if (!previewUrl) return
    const id = setInterval(async () => {
      const entries = await invoke('get_console_output').catch(() => [])
      setConsoleOutput(entries)
    }, 1000)
    return () => clearInterval(id)
  }, [previewUrl])

  async function handleDiscard(filePath) {
    setBusy(true)
    try {
      await invoke('discard_single_change', { filePath })
      await refresh()
      setStatus(null)
    } catch (e) {
      setStatus({ type: 'error', text: String(e) })
    } finally {
      setBusy(false)
    }
  }

  async function handleDiscardAll() {
    setBusy(true)
    try {
      await invoke('discard_staged_changes')
      setChanges([])
      onStageCountChange?.(0)
      setStatus(null)
    } catch (e) {
      setStatus({ type: 'error', text: String(e) })
    } finally {
      setBusy(false)
    }
  }

  async function handleApply() {
    setBusy(true)
    setStatus(null)
    try {
      const applied = await invoke('apply_staged_changes')
      setChanges([])
      onStageCountChange?.(0)
      setStatus({
        type: 'success',
        text: `${applied.length} Datei${applied.length !== 1 ? 'en' : ''} angewendet: ${applied.join(', ')}`,
      })
    } catch (e) {
      setStatus({ type: 'error', text: String(e) })
    } finally {
      setBusy(false)
    }
  }

  async function handlePreview() {
    setBusy(true)
    setStatus(null)
    try {
      const url = await invoke('run_staged_preview')
      setPreviewUrl(url)
      setShowConsole(true)
      setStatus({ type: 'success', text: `Vorschau gestartet auf ${url}` })
    } catch (e) {
      setStatus({ type: 'error', text: String(e) })
    } finally {
      setBusy(false)
    }
  }

  async function handleStopPreview() {
    await invoke('stop_preview').catch(() => {})
    setPreviewUrl(null)
    setConsoleOutput([])
    setShowConsole(false)
  }

  const noChanges = changes.length === 0

  return (
    <div className="flex flex-col h-full anim-fade-up">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <GitBranch size={15} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Code · Staging
            </p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {changes.length === 0
                ? 'Keine gestagten Änderungen'
                : `${changes.length} Änderung${changes.length !== 1 ? 'en' : ''} zur Überprüfung`}
            </p>
          </div>
        </div>

        <button
          onClick={refresh}
          disabled={loading}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-150"
          style={{ color: 'rgba(255,255,255,0.3)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          title="Aktualisieren"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
        <div className="max-w-2xl mx-auto flex flex-col gap-4">

          <StatusBanner status={status} />

          {loading ? (
            <p className="text-xs text-center py-8" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Lade…
            </p>
          ) : noChanges ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <GitBranch size={20} style={{ color: 'rgba(255,255,255,0.2)' }} />
              </div>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Keine gestagten Änderungen
              </p>
              <p className="text-xs text-center max-w-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.15)' }}>
                Bitte KAYO im Chat, den Code zu modifizieren. Vorschläge erscheinen hier zur Überprüfung.
              </p>
            </div>
          ) : (
            <>
              {/* Change cards */}
              <section className="flex flex-col gap-2">
                <h2
                  className="text-[10px] font-semibold uppercase tracking-widest mb-1"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                >
                  Vorgeschlagene Änderungen
                </h2>
                {changes.map(change => (
                  <ChangeCard
                    key={change.file_path}
                    change={change}
                    onDiscard={handleDiscard}
                    disabled={busy}
                  />
                ))}
              </section>

              {/* Safety hint */}
              <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.18)' }}>
                Originaldateien werden vor dem Anwenden gesichert (.bk_* Dateien). Jede Änderung
                erzeugt einen Git-Commit – vollständig reversibel über <code>git revert</code>.
              </p>
            </>
          )}

          {/* Console output */}
          {showConsole && (
            <section>
              <button
                onClick={() => setShowConsole(v => !v)}
                className="flex items-center gap-2 mb-2"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                <Terminal size={12} />
                <span className="text-[10px] font-semibold uppercase tracking-widest">
                  Vorschau-Konsole
                </span>
                {previewUrl && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="ml-auto flex items-center gap-1 text-[10px]"
                    style={{ color: 'rgba(129,140,248,0.7)' }}
                  >
                    <ExternalLink size={10} />
                    {previewUrl}
                  </a>
                )}
              </button>
              <ConsolePanel entries={consoleOutput} />
            </section>
          )}
        </div>
      </div>

      {/* Action bar */}
      {!noChanges && (
        <div
          className="shrink-0 px-6 py-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            {/* Preview */}
            {!previewUrl ? (
              <button
                onClick={handlePreview}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border:     '1px solid rgba(255,255,255,0.1)',
                  color:      'rgba(255,255,255,0.65)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              >
                <Play size={12} />
                Vorschau starten
              </button>
            ) : (
              <button
                onClick={handleStopPreview}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150"
                style={{
                  background: 'rgba(251,191,36,0.1)',
                  border:     '1px solid rgba(251,191,36,0.25)',
                  color:      '#fbbf24',
                }}
              >
                <X size={12} />
                Vorschau stoppen
              </button>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Discard all */}
            <button
              onClick={handleDiscardAll}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150"
              style={{
                background: 'rgba(255,100,100,0.08)',
                border:     '1px solid rgba(255,100,100,0.18)',
                color:      'rgba(255,130,130,0.8)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,100,100,0.14)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,100,100,0.08)' }}
            >
              <Trash2 size={12} />
              Alle verwerfen
            </button>

            {/* Apply */}
            <button
              onClick={handleApply}
              disabled={busy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150"
              style={{
                background: 'linear-gradient(135deg, #818cf8, #a78bfa)',
                color:      'white',
                boxShadow:  '0 2px 12px rgba(129,140,248,0.35)',
                opacity:    busy ? 0.6 : 1,
              }}
            >
              <Check size={12} />
              Änderungen anwenden
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
