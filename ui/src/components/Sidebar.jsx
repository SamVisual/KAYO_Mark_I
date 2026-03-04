import { useState } from 'react'
import {
  MessageSquare,
  Bot,
  Brain,
  FolderOpen,
  Clock,
  Settings,
  Plus,
  Zap,
} from 'lucide-react'

// ── Navigation definition ─────────────────────────────────────────────────────

const NAV_MAIN = [
  { id: 'chat',     Icon: MessageSquare, label: 'Chat' },
  { id: 'agents',   Icon: Bot,           label: 'Agenten' },
  { id: 'memory',   Icon: Brain,         label: 'Gedächtnis' },
  { id: 'files',    Icon: FolderOpen,    label: 'Dateien' },
  { id: 'history',  Icon: Clock,         label: 'Verlauf' },
]

const CONTEXTS = [
  { id: 'coding',   label: 'Coding' },
  { id: 'alltag',   label: 'Alltag' },
  { id: 'finanzen', label: 'Finanzen' },
]

// Maps sidebar context IDs to the agent keys used in App.jsx
const CONTEXT_TO_AGENT = {
  coding:   'coder',
  alltag:   'alltag',
  finanzen: 'finanzen',
}
const AGENT_TO_CONTEXT = Object.fromEntries(
  Object.entries(CONTEXT_TO_AGENT).map(([c, a]) => [a, c])
)

// ── Component ─────────────────────────────────────────────────────────────────

export default function Sidebar({ currentView, onNavigate, onNewChat, activeAgent, onContextChange }) {
  const [hoveredId, setHoveredId] = useState(null)

  // Derive active context from the parent's activeAgent state (BUG #3)
  const activeContext = AGENT_TO_CONTEXT[activeAgent] ?? null

  // 'chat' and 'home' views both correspond to the Chat nav item
  const effectiveView = currentView === 'home' ? 'chat' : currentView

  return (
    <aside
      className="flex flex-col shrink-0 py-4"
      style={{
        width:       220,
        background:  'rgba(255,255,255,0.015)',
        borderRight: '1px solid rgba(255,255,255,0.055)',
      }}
    >
      {/* ── Logo ── */}
      <div className="flex items-center gap-2.5 px-5 mb-6">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 cyan-glow"
          style={{ background: 'linear-gradient(135deg, #00d4ff, #0088ff)' }}
        >
          <Zap size={13} className="text-white" />
        </div>
        <div>
          <span className="text-sm font-semibold tracking-tight text-white/80">KAYO</span>
          <span className="font-mono-label text-white/30 ml-1.5">Mark I</span>
        </div>
      </div>

      {/* ── New Chat button ── */}
      <div className="px-3 mb-4">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
          style={{
            border:  '1px dashed rgba(255,255,255,0.12)',
            color:   'rgba(255,255,255,0.5)',
            background: 'transparent',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor  = 'rgba(0,212,255,0.35)'
            e.currentTarget.style.color        = '#00d4ff'
            e.currentTarget.style.background   = 'rgba(0,212,255,0.06)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor  = 'rgba(255,255,255,0.12)'
            e.currentTarget.style.color        = 'rgba(255,255,255,0.5)'
            e.currentTarget.style.background   = 'transparent'
          }}
        >
          <Plus size={14} />
          Neuer Chat
        </button>
      </div>

      {/* ── Main nav ── */}
      <nav className="flex flex-col px-2 gap-0.5 flex-1" aria-label="Hauptnavigation">
        {NAV_MAIN.map(({ id, Icon, label }) => {
          const active  = effectiveView === id
          const hovered = hoveredId === id

          return (
            <button
              key={id}
              onClick={() => onNavigate(id === 'chat' ? 'home' : id)}
              onMouseEnter={() => setHoveredId(id)}
              onMouseLeave={() => setHoveredId(null)}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className="relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 text-left w-full"
              style={{
                color:      active ? '#00d4ff' : hovered ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.4)',
                background: active
                  ? 'rgba(0,212,255,0.07)'
                  : hovered
                    ? 'rgba(255,255,255,0.04)'
                    : 'transparent',
              }}
            >
              {/* Left cyan border when active */}
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-full"
                  style={{ height: 18, background: '#00d4ff' }}
                />
              )}

              <Icon
                size={15}
                style={{
                  color:      active ? '#00d4ff' : 'inherit',
                  transition: 'color 0.15s',
                }}
              />
              <span className="font-medium">{label}</span>
            </button>
          )
        })}
      </nav>

      {/* ── Kontexte ── */}
      <div className="px-4 pb-3">
        <p className="font-mono-label text-white/25 uppercase tracking-widest mb-2.5">
          Kontexte
        </p>
        <div className="flex flex-wrap gap-1.5">
          {CONTEXTS.map(({ id, label }) => {
            const on = activeContext === id
            return (
              <button
                key={id}
                onClick={() => onContextChange(on ? 'claude' : CONTEXT_TO_AGENT[id])}
                className="font-mono-label px-2 py-1 rounded-md transition-all duration-150"
                style={{
                  background: on ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)',
                  border:     `1px solid ${on ? 'rgba(0,212,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  color:      on ? '#00d4ff' : 'rgba(255,255,255,0.38)',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.055)', margin: '0 16px 12px' }} />

      {/* ── Settings + User ── */}
      <div className="px-2">
        <button
          onClick={() => onNavigate('settings')}
          onMouseEnter={() => setHoveredId('settings')}
          onMouseLeave={() => setHoveredId(null)}
          className="relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full transition-all duration-150 mb-2"
          style={{
            color:      effectiveView === 'settings' ? '#00d4ff' : hoveredId === 'settings' ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.4)',
            background: effectiveView === 'settings'
              ? 'rgba(0,212,255,0.07)'
              : hoveredId === 'settings'
                ? 'rgba(255,255,255,0.04)'
                : 'transparent',
          }}
        >
          {effectiveView === 'settings' && (
            <span
              className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-full"
              style={{ height: 18, background: '#00d4ff' }}
            />
          )}
          <Settings size={15} style={{ color: effectiveView === 'settings' ? '#00d4ff' : 'inherit' }} />
          <span className="font-medium">Einstellungen</span>
        </button>

        {/* User row */}
        <div className="flex items-center gap-2.5 px-3 py-1.5">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 select-none"
            style={{
              background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,136,255,0.2))',
              border:     '1px solid rgba(0,212,255,0.2)',
              color:      'rgba(0,212,255,0.8)',
            }}
          >
            S
          </div>
          <span className="text-xs font-medium text-white/35">Sam</span>
          <span
            className="ml-auto w-1.5 h-1.5 rounded-full status-glow"
            style={{ background: '#4ade80', marginTop: 1 }}
          />
        </div>
      </div>
    </aside>
  )
}
