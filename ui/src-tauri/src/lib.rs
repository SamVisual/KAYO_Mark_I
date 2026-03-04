use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

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

// ── Memory types ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MemoryMetadata {
    pub role:       String,
    pub timestamp:  i64,
    pub session_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryAddRequest {
    pub content:  String,
    pub metadata: MemoryMetadata,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemorySearchRequest {
    pub query:     String,
    pub n_results: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MemoryResult {
    pub id:       String,
    pub content:  String,
    pub metadata: serde_json::Value,
    pub distance: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemorySearchResponse {
    pub results: Vec<MemoryResult>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryAddResponse {
    pub id:    String,
    pub count: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemorySessionItem {
    pub id:       String,
    pub content:  String,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemorySessionResponse {
    pub results: Vec<MemorySessionItem>,
}

// ── Sidecar state ────────────────────────────────────────────────────────────

const MEMORY_PORT: u16 = 7437;

fn memory_url(path: &str) -> String {
    format!("http://127.0.0.1:{MEMORY_PORT}{path}")
}

/// Shared HTTP client for memory server requests.
struct MemoryClient {
    client: reqwest::Client,
}

// ── Tauri Commands ────────────────────────────────────────────────────────────

/// Send a message to the Anthropic API.
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

/// Retrieve the Tauri app data directory path.
#[tauri::command]
fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

// ── Memory Commands ──────────────────────────────────────────────────────────

/// Add a message to the memory store.
#[tauri::command]
async fn memory_add(
    state: tauri::State<'_, MemoryClient>,
    content: String,
    metadata: MemoryMetadata,
) -> Result<MemoryAddResponse, String> {
    let body = MemoryAddRequest { content, metadata };
    let resp = state.client
        .post(memory_url("/memory/add"))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Memory server error: {e}"))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Memory add failed: {text}"));
    }

    resp.json::<MemoryAddResponse>()
        .await
        .map_err(|e| format!("Memory parse error: {e}"))
}

/// Search memory semantically.
#[tauri::command]
async fn memory_search(
    state: tauri::State<'_, MemoryClient>,
    query: String,
    n_results: Option<u32>,
) -> Result<Vec<MemoryResult>, String> {
    let body = MemorySearchRequest {
        query,
        n_results: Some(n_results.unwrap_or(10)),
    };
    let resp = state.client
        .post(memory_url("/memory/search"))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Memory server error: {e}"))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Memory search failed: {text}"));
    }

    let parsed: MemorySearchResponse = resp
        .json()
        .await
        .map_err(|e| format!("Memory parse error: {e}"))?;

    Ok(parsed.results)
}

/// Get all messages from a specific session.
#[tauri::command]
async fn memory_get_session(
    state: tauri::State<'_, MemoryClient>,
    session_id: String,
) -> Result<Vec<MemorySessionItem>, String> {
    let resp = state.client
        .get(memory_url(&format!("/memory/session/{session_id}")))
        .send()
        .await
        .map_err(|e| format!("Memory server error: {e}"))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Memory session failed: {text}"));
    }

    let parsed: MemorySessionResponse = resp
        .json()
        .await
        .map_err(|e| format!("Memory parse error: {e}"))?;

    Ok(parsed.results)
}

/// Check if memory sidecar is running.
#[tauri::command]
async fn memory_health(
    state: tauri::State<'_, MemoryClient>,
) -> Result<bool, String> {
    match state.client.get(memory_url("/health")).send().await {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_)   => Ok(false),
    }
}

// ── Sidecar lifecycle ────────────────────────────────────────────────────────

/// Wait for the memory server to become healthy (max ~10s).
async fn wait_for_memory_server(client: &reqwest::Client) -> bool {
    for i in 0..20 {
        if let Ok(resp) = client.get(memory_url("/health")).send().await {
            if resp.status().is_success() {
                println!("[KAYO] Memory server ready after ~{}ms", i * 500);
                return true;
            }
        }
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }
    eprintln!("[KAYO] Memory server did not become healthy within 10s");
    false
}

// ── App entry point ───────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(MemoryClient {
            client: reqwest::Client::new(),
        })
        .manage(Mutex::new(Option::<tauri_plugin_shell::process::CommandChild>::None))
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

            // ── Spawn memory sidecar ─────────────────────────────────────
            let app_handle = app.handle().clone();
            let sidecar_state = app.state::<Mutex<Option<tauri_plugin_shell::process::CommandChild>>>();

            // Set KAYO_MEMORY_PATH to app data dir
            let memory_path = app.path()
                .app_data_dir()
                .map(|p| p.join("memory"))
                .unwrap_or_default();

            let sidecar_cmd = app_handle
                .shell()
                .sidecar("memory_server")
                .expect("failed to create sidecar command")
                .env("KAYO_MEMORY_PATH", memory_path.to_string_lossy().to_string());

            match sidecar_cmd.spawn() {
                Ok((mut rx, child)) => {
                    println!("[KAYO] Memory sidecar spawned (pid: {:?})", child.pid());
                    *sidecar_state.lock().unwrap() = Some(child);

                    // Log sidecar output in background
                    tauri::async_runtime::spawn(async move {
                        use tauri_plugin_shell::process::CommandEvent;
                        while let Some(event) = rx.recv().await {
                            match event {
                                CommandEvent::Stdout(line) => {
                                    println!("[memory-sidecar] {}", String::from_utf8_lossy(&line));
                                }
                                CommandEvent::Stderr(line) => {
                                    eprintln!("[memory-sidecar] {}", String::from_utf8_lossy(&line));
                                }
                                CommandEvent::Terminated(payload) => {
                                    println!("[memory-sidecar] terminated: {:?}", payload);
                                    break;
                                }
                                _ => {}
                            }
                        }
                    });

                    // Wait for health in background, then emit ready event
                    let handle2 = app_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        let client = reqwest::Client::new();
                        let ready = wait_for_memory_server(&client).await;
                        let _ = handle2.emit("memory-ready", ready);
                    });
                }
                Err(e) => {
                    eprintln!("[KAYO] Failed to spawn memory sidecar: {e}");
                    let _ = app_handle.emit("memory-ready", false);
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // Kill sidecar when app closes
            if let tauri::WindowEvent::Destroyed = event {
                let state = window.state::<Mutex<Option<tauri_plugin_shell::process::CommandChild>>>();
                if let Some(child) = state.lock().unwrap().take() {
                    println!("[KAYO] Killing memory sidecar...");
                    let _ = child.kill();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            chat,
            get_env_api_key,
            get_app_data_dir,
            memory_add,
            memory_search,
            memory_get_session,
            memory_health,
        ])
        .run(tauri::generate_context!())
        .expect("error while running KAYO application")
}
