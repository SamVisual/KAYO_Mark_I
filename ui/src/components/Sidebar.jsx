import { MessageSquare, CheckSquare, Settings, Zap, GitBranch } from 'lucide-react'

export default function Sidebar({ currentView, onNavigate, stageBadge = 0 }) {
  const NAV = [
    { id: 'chat',     Icon: MessageSquare, label: 'Chat',          badge: 0          },
    { id: 'tasks',    Icon: CheckSquare,   label: 'Aufgaben',      badge: 0          },
    { id: 'code',     Icon: GitBranch,     label: 'Code · Staging', badge: stageBadge },
    { id: 'settings', Icon: Settings,      label: 'Einstellungen', badge: 0          },
  ]

  return (
    <aside
      className="flex flex-col items-center py-4 gap-1 shrink-0"
      style={{
        width:       68,
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
      <nav className="flex flex-col items-center gap-1 flex-1">
        {NAV.map(({ id, Icon, label, badge }) => {
          const active = currentView === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              title={label}
              className="group relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200"
              style={{
                background: active ? 'rgba(129,140,248,0.14)' : 'transparent',
                border:     active ? '1px solid rgba(129,140,248,0.28)' : '1px solid transparent',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <Icon
                size={18}
                style={{ color: active ? '#818cf8' : 'rgba(255,255,255,0.4)', transition: 'color 0.15s' }}
              />

              {/* Staged-count badge */}
              {badge > 0 && (
                <span
                  className="absolute top-1 right-1 min-w-[14px] h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold leading-none px-1"
                  style={{ background: 'linear-gradient(135deg,#818cf8,#a78bfa)', color: 'white' }}
                >
                  {badge > 9 ? '9+' : badge}
                </span>
              )}

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
