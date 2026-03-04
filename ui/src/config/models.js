export const PROVIDERS = {
  anthropic: {
    name: "Anthropic",
    models: [
      { id: "claude-opus-4-5",   label: "Claude Opus 4.5",   context: "200k", tier: "premium"   },
      { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", context: "200k", tier: "standard"  },
      { id: "claude-haiku-4-5",  label: "Claude Haiku 4.5",  context: "200k", tier: "fast"      },
    ],
    default: "claude-sonnet-4-5",
  },
  openai: {
    name: "OpenAI",
    models: [
      { id: "gpt-4o",      label: "GPT-4o",      context: "128k", tier: "premium"   },
      { id: "gpt-4o-mini", label: "GPT-4o Mini", context: "128k", tier: "fast"      },
      { id: "o3-mini",     label: "o3 Mini",      context: "128k", tier: "reasoning" },
    ],
    default: "gpt-4o",
  },
  google: {
    name: "Google",
    models: [
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", context: "1M", tier: "fast"    },
      { id: "gemini-2.0-pro",   label: "Gemini 2.0 Pro",   context: "1M", tier: "premium" },
    ],
    default: "gemini-2.0-flash",
  },
}
