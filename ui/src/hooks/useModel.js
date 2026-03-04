import { useState } from 'react'
import { PROVIDERS } from '../config/models.js'

const LS_PROVIDER = 'kayo_provider'
const LS_MODEL    = 'kayo_model'

function readLS(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback }
  catch { return fallback }
}

function writeLS(key, value) {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

export function useModel() {
  const [selectedProvider, setSelectedProviderState] = useState(
    () => readLS(LS_PROVIDER, 'anthropic')
  )
  const [selectedModel, setSelectedModelState] = useState(() => {
    const provider = readLS(LS_PROVIDER, 'anthropic')
    const fallback = PROVIDERS[provider]?.default ?? 'claude-sonnet-4-5'
    return readLS(LS_MODEL, fallback)
  })

  function setProvider(provider) {
    if (!PROVIDERS[provider]) return
    const model = PROVIDERS[provider].default
    setSelectedProviderState(provider)
    setSelectedModelState(model)
    writeLS(LS_PROVIDER, provider)
    writeLS(LS_MODEL, model)
  }

  function setModel(model) {
    setSelectedModelState(model)
    writeLS(LS_MODEL, model)
  }

  const currentProviderModels = PROVIDERS[selectedProvider]?.models ?? []

  return { selectedProvider, selectedModel, setProvider, setModel, currentProviderModels }
}
