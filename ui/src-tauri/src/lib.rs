use serde::{Deserialize, Serialize};
use tauri::Manager;

// ── Constants ─────────────────────────────────────────────────────────────────

/// Hard cap on max_tokens to prevent accidental runaway API spend.
const MAX_TOKENS_LIMIT: u32 = 4096;

// ── Data types ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role:    String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnthropicRequest {
    pub model:      String,
    pub max_tokens: u32,
    pub system:     String,
    pub messages:   Vec<ChatMessage>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnthropicResponse {
    pub content: Vec<AnthropicContent>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnthropicContent {
    #[serde(rename = "type")]
    pub kind: String,
    /// Only present on `type: "text"` blocks; other block types (tool_use,
    /// thinking, etc.) omit this field, so it must be optional.
    pub text: Option<String>,
}

// ── App state ─────────────────────────────────────────────────────────────────

/// Shared application state managed by Tauri.
/// Holding the HTTP client here enables TCP connection reuse (keep-alive)
/// across all `chat` calls instead of recreating the pool per request.
pub struct AppState {
    pub client: reqwest::Client,
}

// ── Tauri Commands ────────────────────────────────────────────────────────────

/// Send a message to the Anthropic API.
/// API key stays in the Rust process – never exposed to the frontend.
#[tauri::command]
async fn chat(
    state:      tauri::State<'_, AppState>,
    api_key:    String,
    system:     String,
    messages:   Vec<ChatMessage>,
    max_tokens: Option<u32>,
) -> Result<String, String> {
    // Validate message roles before sending to the API.
    for msg in &messages {
        if msg.role != "user" && msg.role != "assistant" {
            return Err(format!("Ungültige Nachrichtenrolle: '{}'", msg.role));
        }
    }

    // Cap max_tokens to avoid unintentional runaway API spend.
    let tokens = max_tokens.unwrap_or(1024).min(MAX_TOKENS_LIMIT);

    let body = AnthropicRequest {
        model:      "claude-opus-4-6".to_string(),
        max_tokens: tokens,
        system,
        messages,
    };

    let response = state.client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key",         &api_key)
        .header("anthropic-version",  "2023-06-01")
        .header("content-type",       "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Netzwerkfehler: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let text   = response.text().await.unwrap_or_default();
        return Err(format!("API-Fehler {status}: {text}"));
    }

    let parsed: AnthropicResponse = response
        .json()
        .await
        .map_err(|e| format!("Parsing-Fehler: {e}"))?;

    parsed
        .content
        .into_iter()
        .find(|c| c.kind == "text" && c.text.is_some())
        .and_then(|c| c.text)
        .ok_or_else(|| "Leere Antwort von der API".to_string())
}

/// Retrieve the Tauri app data directory path (for kayo-memory.json).
#[tauri::command]
fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

// ── App entry point ───────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            client: reqwest::Client::new(),
        })
        .setup(|app| {
            let window = app.get_webview_window("main")
                .expect("main window not found");

            // Windows 11: Acrylic blur effect
            #[cfg(target_os = "windows")]
            {
                use window_vibrancy::apply_acrylic;
                // RGBA: very dark navy, 85% opaque – blends with the dark CSS bg
                let _ = apply_acrylic(&window, Some((9, 9, 18, 220)));
            }

            // macOS: vibrancy
            #[cfg(target_os = "macos")]
            {
                use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
                let _ = apply_vibrancy(
                    &window,
                    NSVisualEffectMaterial::HudWindow,
                    None,
                    Some(10.0),
                );
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![chat, get_app_data_dir])
        .run(tauri::generate_context!())
        .expect("error while running KAYO application")
}
