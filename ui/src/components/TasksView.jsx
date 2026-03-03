import { CheckSquare } from 'lucide-react'

export default function TasksView() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 anim-fade-up">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <CheckSquare size={24} style={{ color: 'rgba(255,255,255,0.28)' }} />
      </div>
      <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Aufgaben · kommt bald
      </p>
    </div>
  )
}
