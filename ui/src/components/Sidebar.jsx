import { useState } from 'react'
import { MessageSquare, CheckSquare, Settings, Zap } from 'lucide-react'

const NAV = [
  { id: 'chat',     Icon: MessageSquare, label: 'Chat' },
  { id: 'tasks',    Icon: CheckSquare,   label: 'Aufgaben' },
  { id: 'settings', Icon: Settings,      label: 'Einstellungen' },
]

export default function Sidebar({ currentView, onNavigate }) {
  // Track hovered nav item in React state to avoid direct DOM style mutations.
  const [hoveredId, setHoveredId] = useState(null)

  return (
    <aside
      className="flex flex-col items-center py-4 gap-1 shrink-0"
      style={{
        width: 68,
        borderRight: '1px solid rgba(255,255,255,0.06)',
        background:  'rgba(255,255,255,0.02)',
      }}
    >
      {/* Brand mark */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center mb-5 accent-glow"
        style={{ background: 'linear-gradient(135deg, #818cf8, #a78bfa)' }}
      >
        <Zap size={16} className="text-white" />
      </div>

      {/* Nav items */}
      <nav className="flex flex-col items-center gap-1 flex-1" aria-label="Hauptnavigation">
        {NAV.map(({ id, Icon, label }) => {
          const active  = currentView === id
          const hovered = hoveredId === id

          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              onMouseEnter={() => setHoveredId(id)}
              onMouseLeave={() => setHoveredId(null)}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className="group relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200"
              style={{
                background: active
                  ? 'rgba(129,140,248,0.14)'
                  : hovered
                    ? 'rgba(255,255,255,0.06)'
                    : 'transparent',
                border: active
                  ? '1px solid rgba(129,140,248,0.28)'
                  : '1px solid transparent',
              }}
            >
              <Icon
                size={18}
                style={{ color: active ? '#818cf8' : 'rgba(255,255,255,0.4)', transition: 'color 0.15s' }}
              />

              {/* Active indicator bar */}
              {active && (
                <span
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full"
                  style={{ background: '#818cf8' }}
                />
              )}

              {/* Tooltip */}
              <span
                className="pointer-events-none absolute left-[52px] z-50 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                style={{
                  background:     'rgba(24,24,40,0.96)',
                  border:         '1px solid rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(12px)',
                  color:          'rgba(255,255,255,0.82)',
                }}
              >
                {label}
              </span>
            </button>
          )
        })}
      </nav>

      {/* User avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold select-none"
        style={{
          background: 'linear-gradient(135deg, rgba(129,140,248,0.25), rgba(167,139,250,0.25))',
          border:     '1px solid rgba(129,140,248,0.25)',
          color:      'rgba(255,255,255,0.6)',
        }}
      >
        Du
      </div>
    </aside>
  )
}
