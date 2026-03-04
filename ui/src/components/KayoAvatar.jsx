import { Zap } from 'lucide-react'

export function KayoAvatar({ size = 28 }) {
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0"
      style={{
        width:      size,
        height:     size,
        background: 'linear-gradient(135deg, #00d4ff, #0088ff)',
        boxShadow:  '0 2px 12px rgba(0,212,255,0.3)',
      }}
    >
      <Zap size={Math.round(size * 0.44)} className="text-white" />
    </div>
  )
}
