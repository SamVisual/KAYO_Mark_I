import { KeyRound, Settings } from 'lucide-react'

export default function SettingsView({ settings, models, onChange }) {
  const update = (patch) => onChange((prev) => ({ ...prev, ...patch }))

  return (
    <div className="h-full overflow-y-auto px-8 py-8 anim-fade-up">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Settings size={22} style={{ color: 'rgba(255,255,255,0.5)' }} />
          </div>
          <div>
            <p className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.86)' }}>
              Einstellungen
            </p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.42)' }}>
              API-Key speichern und Standardmodell festlegen
            </p>
          </div>
        </div>

        <section
          className="rounded-2xl p-5 space-y-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <label className="block space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>
              API-Key (Anthropic)
            </span>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.15)' }}>
              <KeyRound size={15} style={{ color: 'rgba(255,255,255,0.45)' }} />
              <input
                type="password"
                value={settings.apiKey}
                onChange={(event) => update({ apiKey: event.target.value })}
                placeholder="sk-ant-..."
                className="w-full bg-transparent outline-none text-sm"
                style={{ color: 'rgba(255,255,255,0.9)' }}
              />
            </div>
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Standardmodell
            </span>
            <select
              value={settings.model}
              onChange={(event) => update({ model: event.target.value })}
              className="w-full text-sm rounded-xl px-3 py-2 outline-none"
              style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
            >
              {models.map((entry) => (
                <option key={entry.value} value={entry.value}>{entry.label}</option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.45)' }}>
              System Prompt
            </span>
            <textarea
              rows={4}
              value={settings.systemPrompt}
              onChange={(event) => update({ systemPrompt: event.target.value })}
              className="w-full text-sm rounded-xl px-3 py-2 outline-none resize-y"
              style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' }}
            />
          </label>
        </section>
      </div>
    </div>
  )
}
