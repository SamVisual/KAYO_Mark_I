import { useState } from 'react'
import { Settings, Eye, EyeOff, Check } from 'lucide-react'

export default function SettingsView({ apiKey, onApiKeyChange }) {
  const [inputValue, setInputValue] = useState(apiKey || '')
  const [showKey, setShowKey]       = useState(false)
  const [saved, setSaved]           = useState(false)

  const handleSave = () => {
    onApiKeyChange(inputValue.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 anim-fade-up px-6">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <Settings size={24} style={{ color: 'rgba(255,255,255,0.28)' }} />
      </div>

      <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Einstellungen
      </p>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Anthropic API-Key
        </label>

        <div className="flex items-center gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="sk-ant-..."
            className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-transparent outline-none"
            style={{
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.88)',
            }}
          />
          <button
            onClick={() => setShowKey(s => !s)}
            className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={!inputValue.trim()}
          className="w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-150 flex items-center justify-center gap-2"
          style={{
            background: saved
              ? 'rgba(74, 222, 128, 0.2)'
              : inputValue.trim()
                ? 'linear-gradient(135deg, #818cf8, #a78bfa)'
                : 'rgba(255,255,255,0.07)',
            color: saved ? '#4ade80' : inputValue.trim() ? '#fff' : 'rgba(255,255,255,0.35)',
            border: saved ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid transparent',
          }}
        >
          {saved && <Check size={14} />}
          {saved ? 'Gespeichert!' : 'Speichern'}
        </button>

        <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Der Key wird lokal gespeichert und nur an die Anthropic API gesendet.
        </p>
      </div>
    </div>
  )
}
