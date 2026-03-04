import { useState, useEffect, useCallback, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

/**
 * Hook for KAYO's ChromaDB-based semantic memory system.
 * Connects to the memory sidecar via Tauri commands.
 */
export default function useMemory() {
  const [isReady, setIsReady] = useState(false)
  const sessionId = useRef(`session_${Date.now()}`)

  // Listen for memory-ready event from Rust sidecar lifecycle
  useEffect(() => {
    // Check immediately in case sidecar is already up
    invoke('memory_health')
      .then(ok => { if (ok) setIsReady(true) })
      .catch(() => {})

    const unlisten = listen('memory-ready', (event) => {
      setIsReady(Boolean(event.payload))
    })

    return () => { unlisten.then(fn => fn()) }
  }, [])

  const addMessage = useCallback(async (content, role) => {
    if (!isReady) return
    try {
      await invoke('memory_add', {
        content,
        metadata: {
          role,
          timestamp: Math.floor(Date.now() / 1000),
          session_id: sessionId.current,
        },
      })
    } catch (err) {
      console.warn('[useMemory] addMessage failed:', err)
    }
  }, [isReady])

  const searchMemory = useCallback(async (query, n = 5) => {
    if (!isReady) return []
    try {
      return await invoke('memory_search', { query, nResults: n })
    } catch (err) {
      console.warn('[useMemory] searchMemory failed:', err)
      return []
    }
  }, [isReady])

  const getSession = useCallback(async (id) => {
    if (!isReady) return []
    try {
      return await invoke('memory_get_session', { sessionId: id || sessionId.current })
    } catch (err) {
      console.warn('[useMemory] getSession failed:', err)
      return []
    }
  }, [isReady])

  return {
    isReady,
    sessionId: sessionId.current,
    addMessage,
    searchMemory,
    getSession,
  }
}
