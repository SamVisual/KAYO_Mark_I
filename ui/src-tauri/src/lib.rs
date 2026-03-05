use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::Manager;

// ── Data types ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role:    String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct AnthropicRequest {
    model:      String,
    max_tokens: u32,
    system:     String,
    messages:   Vec<ChatMessage>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AnthropicResponse {
    content: Option<Vec<AnthropicContent>>,
    error:   Option<AnthropicError>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AnthropicContent {
    #[serde(rename = "type")]
    kind: String,
    text: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AnthropicError {
    message: String,
}

// ── Persisted config (app data dir) ──────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
struct AppConfig {
    api_key: Option<String>,
    model:   String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            api_key: None,
            model:   "claude-sonnet-4-20250514".to_string(),
        }
    }
}

fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| format!("Cannot create config dir: {e}"))?;
    Ok(dir.join("config.json"))
}

fn load_config(app: &tauri::AppHandle) -> AppConfig {
    config_path(app)
        .ok()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_config(app: &tauri::AppHandle, cfg: &AppConfig) -> Result<(), String> {
    let path = config_path(app)?;
    let json = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| format!("Cannot write config: {e}"))
}

// ── Managed state ────────────────────────────────────────────────────────────

struct HttpClient(reqwest::Client);
struct Config(Mutex<AppConfig>);

// ── Tauri Commands ───────────────────────────────────────────────────────────

/// Send a message to the Anthropic API.
/// API key is read from Rust-side config – never sent from the frontend.
#[tauri::command]
async fn chat(
    system:     String,
    messages:   Vec<ChatMessage>,
    max_tokens: Option<u32>,
    client:     tauri::State<'_, HttpClient>,
    config:     tauri::State<'_, Config>,
) -> Result<String, String> {
    let (api_key, model) = {
        let cfg = config.0.lock().map_err(|e| e.to_string())?;
        let key = cfg.api_key.clone()
            .filter(|k| !k.is_empty())
            .ok_or("Kein API Key gesetzt. Bitte in den Einstellungen hinterlegen.")?;
        (key, cfg.model.clone())
    };

    let body = AnthropicRequest {
        model,
        max_tokens: max_tokens.unwrap_or(1024),
        system,
        messages,
    };

    let response = client.0
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key",        &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type",      "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "Zeitüberschreitung – API antwortet nicht. Bitte Netzwerk prüfen.".to_string()
            } else {
                format!("Netzwerkfehler: {e}")
            }
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let text   = response.text().await.unwrap_or_default();
        return Err(format!("API Fehler {status}: {text}"));
    }

    let parsed: AnthropicResponse = response
        .json()
        .await
        .map_err(|e| format!("Antwort konnte nicht gelesen werden: {e}"))?;

    if let Some(err) = parsed.error {
        return Err(format!("API Fehler: {}", err.message));
    }

    parsed
        .content
        .unwrap_or_default()
        .into_iter()
        .find(|c| c.kind == "text")
        .and_then(|c| c.text)
        .ok_or_else(|| "Leere Antwort von der API".to_string())
}

/// Store the API key in the Rust-side config file.
#[tauri::command]
fn set_api_key(
    key:    String,
    app:    tauri::AppHandle,
    config: tauri::State<'_, Config>,
) -> Result<(), String> {
    let mut cfg = config.0.lock().map_err(|e| e.to_string())?;
    cfg.api_key = Some(key);
    save_config(&app, &cfg)
}

/// Check whether an API key is configured (without exposing it).
#[tauri::command]
fn has_api_key(config: tauri::State<'_, Config>) -> Result<bool, String> {
    let cfg = config.0.lock().map_err(|e| e.to_string())?;
    Ok(cfg.api_key.as_ref().is_some_and(|k| !k.is_empty()))
}

/// Remove the stored API key.
#[tauri::command]
fn clear_api_key(
    app:    tauri::AppHandle,
    config: tauri::State<'_, Config>,
) -> Result<(), String> {
    let mut cfg = config.0.lock().map_err(|e| e.to_string())?;
    cfg.api_key = None;
    save_config(&app, &cfg)
}

/// Get the currently configured model name.
#[tauri::command]
fn get_model(config: tauri::State<'_, Config>) -> Result<String, String> {
    let cfg = config.0.lock().map_err(|e| e.to_string())?;
    Ok(cfg.model.clone())
}

/// Set the model to use for API calls.
#[tauri::command]
fn set_model(
    model:  String,
    app:    tauri::AppHandle,
    config: tauri::State<'_, Config>,
) -> Result<(), String> {
    let mut cfg = config.0.lock().map_err(|e| e.to_string())?;
    cfg.model = model;
    save_config(&app, &cfg)
}

/// Retrieve the Tauri app data directory path.
#[tauri::command]
fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

// ── App entry point ──────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Load persisted config
            let cfg = load_config(&app.handle());
            app.manage(Config(Mutex::new(cfg)));

            // Shared HTTP client with 30s timeout
            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .map_err(|e| anyhow::anyhow!("HTTP client init failed: {e}"))?;
            app.manage(HttpClient(client));

            // Window vibrancy effects
            if let Some(window) = app.get_webview_window("main") {
                #[cfg(target_os = "windows")]
                {
                    use window_vibrancy::apply_acrylic;
                    let _ = apply_acrylic(&window, Some((9, 9, 18, 220)));
                }

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
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            chat,
            set_api_key,
            has_api_key,
            clear_api_key,
            get_model,
            set_model,
            get_app_data_dir,
        ])
        .run(tauri::generate_context!())
        .expect("KAYO konnte nicht gestartet werden")
}
