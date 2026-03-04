use serde::{Deserialize, Serialize};
use tauri::Manager;

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
    pub text: String,
}

// ── Tauri Commands ────────────────────────────────────────────────────────────

/// Send a message to the Anthropic API.
/// API key stays in the Rust process – never exposed to the frontend.
#[tauri::command]
async fn chat(
    api_key:    String,
    system:     String,
    messages:   Vec<ChatMessage>,
    max_tokens: Option<u32>,
) -> Result<String, String> {
    let client = reqwest::Client::new();

    let body = AnthropicRequest {
        model:      "claude-opus-4-6".to_string(),
        max_tokens: max_tokens.unwrap_or(1024),
        system,
        messages,
    };

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key",         &api_key)
        .header("anthropic-version",  "2023-06-01")
        .header("content-type",       "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let text   = response.text().await.unwrap_or_default();
        return Err(format!("API error {status}: {text}"));
    }

    let parsed: AnthropicResponse = response
        .json()
        .await
        .map_err(|e| format!("Parse error: {e}"))?;

    parsed
        .content
        .into_iter()
        .find(|c| c.kind == "text")
        .map(|c| c.text)
        .ok_or_else(|| "Empty response from API".to_string())
}

/// Read ANTHROPIC_API_KEY from the environment (if set).
#[tauri::command]
fn get_env_api_key() -> Option<String> {
    std::env::var("ANTHROPIC_API_KEY").ok()
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
        .invoke_handler(tauri::generate_handler![chat, get_env_api_key, get_app_data_dir])
        .run(tauri::generate_context!())
        .expect("error while running KAYO application")
}
