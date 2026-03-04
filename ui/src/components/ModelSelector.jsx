import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Lock } from 'lucide-react'
import { PROVIDERS } from '../config/models.js'

// Badge colours per tier
const TIER_STYLE = {
  premium:   { bg: 'rgba(129,140,248,0.18)', color: '#818cf8' },
  standard:  { bg: 'rgba(99,102,241,0.15)',  color: '#a5b4fc' },
  fast:      { bg: 'rgba(74,222,128,0.15)',  color: '#4ade80' },
  reasoning: { bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24' },
}

function TierBadge({ tier }) {
  const s = TIER_STYLE[tier] ?? TIER_STYLE.standard
  return (
    <span
      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-none"
      style={{ background: s.bg, color: s.color }}
    >
      {tier}
    </span>
  )
}

export default function ModelSelector({
  selectedProvider,
  selectedModel,
  setProvider,
  setModel,
  keyStatus,          // { anthropic: bool, openai: bool, google: bool }
  onOpenSettings,     // () => void – navigates to Settings tab
}) {
  const [open, setOpen]       = useState(false)
  const containerRef           = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (!containerRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const currentModel = PROVIDERS[selectedProvider]?.models.find(
    m => m.id === selectedModel
  )

  function handleSelect(providerKey, modelId) {
    if (!keyStatus[providerKey]) {
      // No key → open Settings
      setOpen(false)
      onOpenSettings()
      return
    }
    if (providerKey !== selectedProvider) setProvider(providerKey)
    else setModel(modelId)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
        style={{
          background: open ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.05)',
          border:     `1px solid ${open ? 'rgba(129,140,248,0.35)' : 'rgba(255,255,255,0.09)'}`,
          color:      'rgba(255,255,255,0.65)',
        }}
        title="Modell wählen"
      >
        <span>{currentModel?.label ?? selectedModel}</span>
        <ChevronDown
          size={11}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute bottom-full mb-2 left-0 z-50 rounded-xl overflow-hidden min-w-[220px]"
          style={{
            background:    'rgba(18,18,30,0.97)',
            border:        '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(16px)',
            boxShadow:     '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {Object.entries(PROVIDERS).map(([provKey, prov]) => {
            const hasKey = !!keyStatus[provKey]
            return (
              <div key={provKey}>
                {/* Provider header */}
                <div
                  className="flex items-center justify-between px-3 pt-2.5 pb-1"
                >
                  <span
                    className="text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                  >
                    {prov.name}
                  </span>
                  {!hasKey && (
                    <Lock size={10} style={{ color: 'rgba(255,255,255,0.25)' }} title="Kein API Key hinterlegt" />
                  )}
                </div>

                {/* Models */}
                {prov.models.map(model => {
                  const active = selectedProvider === provKey && selectedModel === model.id
                  return (
                    <button
                      key={model.id}
                      onClick={() => handleSelect(provKey, model.id)}
                      className="w-full flex items-center justify-between px-4 py-2 text-left transition-colors duration-100"
                      style={{
                        background: active ? 'rgba(129,140,248,0.12)' : 'transparent',
                        color:      active
                          ? 'rgba(255,255,255,0.92)'
                          : hasKey
                            ? 'rgba(255,255,255,0.65)'
                            : 'rgba(255,255,255,0.3)',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => {
                        if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                      }}
                      onMouseLeave={e => {
                        if (!active) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <span className="text-xs font-medium">{model.label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                          {model.context}
                        </span>
                        <TierBadge tier={model.tier} />
                        {!hasKey && <Lock size={9} style={{ color: 'rgba(255,255,255,0.2)' }} />}
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}

          {/* Footer hint */}
          <div
            className="px-3 py-2 mt-1"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <button
              onClick={() => { setOpen(false); onOpenSettings() }}
              className="text-[10px] w-full text-left transition-colors duration-100"
              style={{ color: 'rgba(255,255,255,0.25)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(129,140,248,0.7)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.25)' }}
            >
              API Keys verwalten →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
