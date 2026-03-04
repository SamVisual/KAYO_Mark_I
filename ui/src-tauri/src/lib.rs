use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use tauri::Manager;

// ── API key store helpers ─────────────────────────────────────────────────────
// Keys are persisted as JSON in the Tauri app-data directory.
// The raw key value never leaves the Rust process – JS only sees "set/unset" status.

fn key_store_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|d| d.join("api_keys.json"))
        .map_err(|e| e.to_string())
}

fn load_keys(app: &tauri::AppHandle) -> HashMap<String, String> {
    let path = match key_store_path(app) {
        Ok(p) => p,
        Err(_) => return HashMap::new(),
    };
    let text = match fs::read_to_string(&path) {
        Ok(t) => t,
        Err(_) => return HashMap::new(),
    };
    serde_json::from_str(&text).unwrap_or_default()
}

fn save_keys(app: &tauri::AppHandle, keys: &HashMap<String, String>) -> Result<(), String> {
    let path = key_store_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(keys).map_err(|e| e.to_string())?;
    fs::write(&path, text).map_err(|e| e.to_string())
}

// ── Data types ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role:    String,
    pub content: String,
}

// Anthropic ───────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
struct AnthropicRequest {
    model:      String,
    max_tokens: u32,
    system:     String,
    messages:   Vec<ChatMessage>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AnthropicContent {
    #[serde(rename = "type")]
    kind: String,
    text: String,
}

// OpenAI ──────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
struct OpenAIRequest {
    model:      String,
    messages:   Vec<ChatMessage>,
    max_tokens: u32,
}

// Google Gemini ───────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
struct GeminiPart {
    text: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct GeminiContent {
    role:  Option<String>,
    parts: Vec<GeminiPart>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GeminiRequest {
    contents:           Vec<GeminiContent>,
    #[serde(rename = "systemInstruction", skip_serializing_if = "Option::is_none")]
    system_instruction: Option<GeminiContent>,
}

// ── Tauri Commands ────────────────────────────────────────────────────────────

/// Save an API key for a provider. Key is written to the app-data directory.
#[tauri::command]
fn save_api_key(app: tauri::AppHandle, provider: String, key: String) -> Result<(), String> {
    let mut keys = load_keys(&app);
    keys.insert(provider, key);
    save_keys(&app, &keys)
}

/// Returns true if a key is stored for the given provider, false otherwise.
#[tauri::command]
fn has_api_key(app: tauri::AppHandle, provider: String) -> bool {
    let keys = load_keys(&app);
    keys.get(&provider).map(|k| !k.is_empty()).unwrap_or(false)
}

/// Delete a stored API key.
#[tauri::command]
fn clear_api_key(app: tauri::AppHandle, provider: String) -> Result<(), String> {
    let mut keys = load_keys(&app);
    keys.remove(&provider);
    save_keys(&app, &keys)
}

/// Send a chat message to the chosen provider & model.
/// The Rust process retrieves the API key itself – the key never passes through JS.
/// Error format for missing key: "NO_API_KEY:{provider}"
#[tauri::command]
async fn chat(
    app:        tauri::AppHandle,
    provider:   String,
    model:      String,
    system:     String,
    messages:   Vec<ChatMessage>,
    max_tokens: Option<u32>,
) -> Result<String, String> {
    // Resolve API key ──────────────────────────────────────────────────────────
    let keys = load_keys(&app);
    let api_key = keys
        .get(&provider)
        .filter(|k| !k.is_empty())
        .cloned()
        .ok_or_else(|| format!("NO_API_KEY:{provider}"))?;

    let tokens = max_tokens.unwrap_or(1024);
    let client  = reqwest::Client::new();

    match provider.as_str() {
        // ── Anthropic ─────────────────────────────────────────────────────────
        "anthropic" => {
            let body = AnthropicRequest { model, max_tokens: tokens, system, messages };

            let response = client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key",        &api_key)
                .header("anthropic-version", "2023-06-01")
                .header("content-type",      "application/json")
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
                .ok_or_else(|| "Empty response from Anthropic".to_string())
        }

        // ── OpenAI ────────────────────────────────────────────────────────────
        "openai" => {
            // Prepend system message as OpenAI expects it in the messages array
            let mut all_messages = vec![ChatMessage {
                role:    "system".to_string(),
                content: system,
            }];
            all_messages.extend(messages);

            let body = OpenAIRequest { model, messages: all_messages, max_tokens: tokens };

            let response = client
                .post("https://api.openai.com/v1/chat/completions")
                .header("Authorization", format!("Bearer {api_key}"))
                .header("content-type",  "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Network error: {e}"))?;

            if !response.status().is_success() {
                let status = response.status();
                let text   = response.text().await.unwrap_or_default();
                return Err(format!("API error {status}: {text}"));
            }

            let parsed: Value = response
                .json()
                .await
                .map_err(|e| format!("Parse error: {e}"))?;

            parsed["choices"][0]["message"]["content"]
                .as_str()
                .map(|s| s.to_string())
                .ok_or_else(|| "Empty response from OpenAI".to_string())
        }

        // ── Google Gemini ─────────────────────────────────────────────────────
        "google" => {
            // Convert chat history to Gemini format (user/model roles)
            let contents: Vec<GeminiContent> = messages
                .into_iter()
                .map(|m| GeminiContent {
                    role:  Some(if m.role == "user" { "user".to_string() } else { "model".to_string() }),
                    parts: vec![GeminiPart { text: m.content }],
                })
                .collect();

            let system_instruction = if system.is_empty() {
                None
            } else {
                Some(GeminiContent {
                    role:  None,
                    parts: vec![GeminiPart { text: system }],
                })
            };

            let body = GeminiRequest { contents, system_instruction };

            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            );

            let response = client
                .post(&url)
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Network error: {e}"))?;

            if !response.status().is_success() {
                let status = response.status();
                let text   = response.text().await.unwrap_or_default();
                return Err(format!("API error {status}: {text}"));
            }

            let parsed: Value = response
                .json()
                .await
                .map_err(|e| format!("Parse error: {e}"))?;

            parsed["candidates"][0]["content"]["parts"][0]["text"]
                .as_str()
                .map(|s| s.to_string())
                .ok_or_else(|| "Empty response from Google".to_string())
        }

        other => Err(format!("Unknown provider: {other}")),
    }
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
        .invoke_handler(tauri::generate_handler![
            chat,
            get_app_data_dir,
            save_api_key,
            has_api_key,
            clear_api_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running KAYO application")
}
