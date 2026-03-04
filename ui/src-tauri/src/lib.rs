use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::time::{SystemTime, UNIX_EPOCH};
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

// ── Memory types ──────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MemoryEntry {
    pub id:        String,
    pub role:      String,
    pub content:   String,
    pub timestamp: String,
}

// ── App state ─────────────────────────────────────────────────────────────────

/// Shared application state managed by Tauri.
/// Holding the HTTP client here enables TCP connection reuse (keep-alive)
/// across all `chat` calls instead of recreating the pool per request.
pub struct AppState {
    pub client: reqwest::Client,
}

// ── Memory helpers ────────────────────────────────────────────────────────────

fn timestamp_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn make_id(content: &str, ts: u128) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut h = DefaultHasher::new();
    ts.hash(&mut h);
    content[..content.len().min(64)].hash(&mut h);
    format!("{:016x}", h.finish())
}

fn tokenize(text: &str) -> HashSet<String> {
    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|s: &&str| !s.is_empty())
        .map(|s| s.to_string())
        .collect()
}

fn jaccard(a: &HashSet<String>, b: &HashSet<String>) -> f64 {
    let intersection = a.intersection(b).count();
    let union_size   = a.union(b).count();
    if union_size == 0 { 0.0 } else { intersection as f64 / union_size as f64 }
}

fn memory_file(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("kayo_memory.json"))
}

fn load_memories(path: &std::path::Path) -> Vec<MemoryEntry> {
    if !path.exists() {
        return Vec::new();
    }
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
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

/// Retrieve the Tauri app data directory path.
#[tauri::command]
fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

/// Persist the Anthropic API key to the app data directory.
#[tauri::command]
async fn save_api_key(app: tauri::AppHandle, key: String) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::fs::write(dir.join("api_key.txt"), key).map_err(|e| e.to_string())
}

/// Load the stored Anthropic API key, or return an empty string if none saved.
#[tauri::command]
async fn load_api_key(app: tauri::AppHandle) -> Result<String, String> {
    let dir  = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = dir.join("api_key.txt");
    if path.exists() {
        std::fs::read_to_string(path).map_err(|e| e.to_string())
    } else {
        Ok(String::new())
    }
}

/// Append a single message to the JSON memory file (atomic write).
#[tauri::command]
async fn memory_save(
    app:     tauri::AppHandle,
    role:    String,
    content: String,
) -> Result<(), String> {
    let path = memory_file(&app)?;
    let mut entries = load_memories(&path);

    let ts  = timestamp_ms();
    let id  = make_id(&content, ts);
    entries.push(MemoryEntry {
        id,
        role,
        content,
        timestamp: format!("{ts}"),
    });

    let json = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
    let tmp  = path.with_extension("tmp");
    std::fs::write(&tmp, &json).map_err(|e| e.to_string())?;
    std::fs::rename(tmp, path).map_err(|e| e.to_string())
}

/// Return the top-N memory entries most relevant to `query` (Jaccard similarity).
#[tauri::command]
async fn memory_recall(
    app:   tauri::AppHandle,
    query: String,
    n:     Option<usize>,
) -> Result<Vec<MemoryEntry>, String> {
    let path    = memory_file(&app)?;
    let entries = load_memories(&path);
    if entries.is_empty() {
        return Ok(Vec::new());
    }

    let limit     = n.unwrap_or(5);
    let query_tok = tokenize(&query);

    let mut scored: Vec<(f64, &MemoryEntry)> = entries
        .iter()
        .map(|e| (jaccard(&query_tok, &tokenize(&e.content)), e))
        .filter(|(score, _)| *score >= 0.05)
        .collect();

    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    Ok(scored.into_iter().take(limit).map(|(_, e)| e.clone()).collect())
}

/// Return the total number of stored memory entries.
#[tauri::command]
async fn memory_count(app: tauri::AppHandle) -> Result<usize, String> {
    let path = memory_file(&app)?;
    Ok(load_memories(&path).len())
}

/// Delete all stored memories.
#[tauri::command]
async fn memory_clear(app: tauri::AppHandle) -> Result<(), String> {
    let path = memory_file(&app)?;
    if path.exists() {
        std::fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
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
        .invoke_handler(tauri::generate_handler![
            chat,
            save_api_key,
            load_api_key,
            memory_save,
            memory_recall,
            memory_count,
            memory_clear,
        ])
        .run(tauri::generate_context!())
        .expect("error while running KAYO application")
}
