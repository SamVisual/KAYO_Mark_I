export const IS_TAURI = typeof window !== 'undefined' && '__TAURI__' in window

export async function safeInvoke(cmd, args) {
  if (!IS_TAURI) throw new Error('Kein Tauri-Backend verfügbar (Browser-Vorschau)')
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke(cmd, args)
}
