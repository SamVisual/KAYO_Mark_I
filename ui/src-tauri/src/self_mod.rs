use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::BufRead;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

// ── Data types ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StagedChange {
    pub file_path:        String,
    pub description:      String,
    pub original_content: String,
    pub new_content:      String,
    pub diff:             String,
    pub timestamp:        u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsoleEntry {
    pub level:   String, // "log" | "warn" | "error"
    pub message: String,
    pub ts:      u64,
}

// ── App State ──────────────────────────────────────────────────────────────────

pub struct SelfModState {
    pub staged:         Mutex<HashMap<String, StagedChange>>,
    pub console_output: Arc<Mutex<Vec<ConsoleEntry>>>,
    pub preview_pid:    Mutex<Option<u32>>,
}

impl Default for SelfModState {
    fn default() -> Self {
        Self {
            staged:         Mutex::new(HashMap::new()),
            console_output: Arc::new(Mutex::new(Vec::new())),
            preview_pid:    Mutex::new(None),
        }
    }
}

// ── Internal helpers ───────────────────────────────────────────────────────────

/// Walk up from cwd until we find a directory containing package.json.
pub fn project_root() -> Option<PathBuf> {
    let mut dir = std::env::current_dir().ok()?;
    for _ in 0..10 {
        if dir.join("package.json").exists() {
            return Some(dir);
        }
        if !dir.pop() {
            break;
        }
    }
    None
}

fn now_ts() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// Compute a unified diff between original and new content using the system `diff` command.
/// Returns an empty string on Windows or if `diff` is unavailable (frontend falls back to
/// showing the full new content).
fn compute_diff(original: &str, new_content: &str, file_path: &str) -> String {
    let safe = file_path.replace(['/', '\\', ':', ' '], "_");
    let tmp_orig = std::env::temp_dir().join(format!("kayo_orig_{safe}"));
    let tmp_new  = std::env::temp_dir().join(format!("kayo_new_{safe}"));

    let _ = std::fs::write(&tmp_orig, original);
    let _ = std::fs::write(&tmp_new,  new_content);

    let out = Command::new("diff")
        .args(["-u", &tmp_orig.to_string_lossy().into_owned(),
                      &tmp_new.to_string_lossy().into_owned()])
        .output()
        .ok();

    let _ = std::fs::remove_file(&tmp_orig);
    let _ = std::fs::remove_file(&tmp_new);

    out.map(|o| String::from_utf8_lossy(&o.stdout).into_owned())
       .unwrap_or_default()
}

/// Recursively copy a directory, skipping any entry whose name is in `excludes`.
fn copy_dir(src: &Path, dst: &Path, excludes: &[&str]) -> Result<(), String> {
    std::fs::create_dir_all(dst).map_err(|e| e.to_string())?;

    for entry in std::fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry    = entry.map_err(|e| e.to_string())?;
        let name     = entry.file_name();
        let name_str = name.to_string_lossy();

        if excludes.iter().any(|ex| *ex == name_str.as_ref()) {
            continue;
        }

        let src_p = entry.path();
        let dst_p = dst.join(&name);

        if src_p.is_dir() {
            copy_dir(&src_p, &dst_p, excludes)?;
        } else {
            std::fs::copy(&src_p, &dst_p)
                .map_err(|e| format!("copy {} → {}: {e}", src_p.display(), dst_p.display()))?;
        }
    }
    Ok(())
}

// ── Tauri Commands ─────────────────────────────────────────────────────────────

/// Stage a proposed file change in memory.
/// Does NOT touch any real project files until `apply_staged_changes` is called.
#[tauri::command]
pub async fn stage_change(
    state:       tauri::State<'_, SelfModState>,
    file_path:   String,
    new_content: String,
    description: String,
) -> Result<StagedChange, String> {
    let root     = project_root().ok_or("Projektverzeichnis nicht gefunden")?;
    let abs_path = root.join(&file_path);

    let original_content = std::fs::read_to_string(&abs_path).unwrap_or_default();
    let diff = compute_diff(&original_content, &new_content, &file_path);

    let change = StagedChange {
        file_path: file_path.clone(),
        description,
        original_content,
        new_content,
        diff,
        timestamp: now_ts(),
    };

    state.staged.lock()
        .map_err(|e| e.to_string())?
        .insert(file_path, change.clone());

    Ok(change)
}

/// Return all currently staged changes, sorted by timestamp.
#[tauri::command]
pub fn get_staged_changes(
    state: tauri::State<'_, SelfModState>,
) -> Result<Vec<StagedChange>, String> {
    let staged = state.staged.lock().map_err(|e| e.to_string())?;
    let mut changes: Vec<StagedChange> = staged.values().cloned().collect();
    changes.sort_by_key(|c| c.timestamp);
    Ok(changes)
}

/// Return how many changes are currently staged (for the sidebar badge).
#[tauri::command]
pub fn get_staged_count(
    state: tauri::State<'_, SelfModState>,
) -> Result<usize, String> {
    Ok(state.staged.lock().map_err(|e| e.to_string())?.len())
}

/// Write all staged changes to the actual project files and create a git commit.
/// Returns the list of applied file paths.
#[tauri::command]
pub async fn apply_staged_changes(
    state: tauri::State<'_, SelfModState>,
) -> Result<Vec<String>, String> {
    let root = project_root().ok_or("Projektverzeichnis nicht gefunden")?;

    let changes: Vec<StagedChange> = {
        let staged = state.staged.lock().map_err(|e| e.to_string())?;
        if staged.is_empty() {
            return Err("Keine gestagten Änderungen vorhanden.".to_string());
        }
        staged.values().cloned().collect()
    };

    for change in &changes {
        let abs_path = root.join(&change.file_path);

        // Backup the original file
        if abs_path.exists() {
            let bk = abs_path.with_extension(format!("bk_{}", change.timestamp));
            let _ = std::fs::copy(&abs_path, &bk);
        }

        // Ensure parent directories exist
        if let Some(parent) = abs_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("mkdir {}: {e}", parent.display()))?;
        }

        std::fs::write(&abs_path, &change.new_content)
            .map_err(|e| format!("Schreiben von {} fehlgeschlagen: {e}", change.file_path))?;
    }

    // Git: stage + commit
    let file_paths: Vec<&str> = changes.iter().map(|c| c.file_path.as_str()).collect();
    let commit_msg = format!(
        "kayo(self-mod): {}",
        changes.iter().map(|c| c.description.as_str()).collect::<Vec<_>>().join("; ")
    );

    let _ = Command::new("git")
        .arg("add").arg("--").args(&file_paths)
        .current_dir(&root)
        .output();

    let _ = Command::new("git")
        .args(["commit", "-m", &commit_msg])
        .current_dir(&root)
        .output();

    // Clear staging area
    state.staged.lock().map_err(|e| e.to_string())?.clear();

    let applied: Vec<String> = changes.into_iter().map(|c| c.file_path).collect();
    Ok(applied)
}

/// Discard all staged changes without touching any files.
#[tauri::command]
pub fn discard_staged_changes(
    state: tauri::State<'_, SelfModState>,
) -> Result<(), String> {
    state.staged.lock().map_err(|e| e.to_string())?.clear();
    Ok(())
}

/// Discard a single staged change by file path.
#[tauri::command]
pub fn discard_single_change(
    state:     tauri::State<'_, SelfModState>,
    file_path: String,
) -> Result<(), String> {
    state.staged.lock().map_err(|e| e.to_string())?.remove(&file_path);
    Ok(())
}

/// Copy the project to a temp dir with staged changes applied, then start a
/// second Vite dev server on port 5174 for side-by-side preview.
/// Returns the preview URL ("http://localhost:5174").
#[tauri::command]
pub async fn run_staged_preview(
    state: tauri::State<'_, SelfModState>,
) -> Result<String, String> {
    let root        = project_root().ok_or("Projektverzeichnis nicht gefunden")?;
    let preview_dir = std::env::temp_dir().join("kayo_preview");

    // Kill any existing preview process
    {
        let mut pid_lock = state.preview_pid.lock().map_err(|e| e.to_string())?;
        if let Some(pid) = *pid_lock {
            let _ = Command::new("kill").arg(pid.to_string()).output();
        }
        *pid_lock = None;
    }

    // Recreate preview directory with a fresh copy of the project
    if preview_dir.exists() {
        std::fs::remove_dir_all(&preview_dir).map_err(|e| e.to_string())?;
    }
    copy_dir(&root, &preview_dir, &["node_modules", "target", "dist", ".git", "src-tauri"])?;

    // Symlink node_modules for a fast startup
    let src_nm = root.join("node_modules");
    let dst_nm = preview_dir.join("node_modules");
    if src_nm.exists() && !dst_nm.exists() {
        #[cfg(unix)]
        std::os::unix::fs::symlink(&src_nm, &dst_nm)
            .map_err(|e| format!("node_modules symlink fehlgeschlagen: {e}"))?;

        #[cfg(windows)]
        std::os::windows::fs::symlink_dir(&src_nm, &dst_nm)
            .map_err(|e| format!("node_modules symlink fehlgeschlagen: {e}"))?;
    }

    // Overlay staged changes on top of the copy
    {
        let staged = state.staged.lock().map_err(|e| e.to_string())?;
        for change in staged.values() {
            let pf = preview_dir.join(&change.file_path);
            if let Some(parent) = pf.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            std::fs::write(&pf, &change.new_content)
                .map_err(|e| format!("Vorschaudatei {} schreiben: {e}", change.file_path))?;
        }
    }

    // Reset captured console output
    state.console_output.lock().map_err(|e| e.to_string())?.clear();

    // Spawn Vite on port 5174 with output capture
    let mut child = Command::new("npx")
        .args(["vite", "--port", "5174", "--strictPort"])
        .current_dir(&preview_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Vite konnte nicht gestartet werden: {e}"))?;

    let pid = child.id();

    // Capture stdout in a background thread
    let console_out = Arc::clone(&state.console_output);
    if let Some(stdout) = child.stdout.take() {
        thread::spawn(move || {
            for line in std::io::BufReader::new(stdout).lines().flatten() {
                if let Ok(mut out) = console_out.lock() {
                    out.push(ConsoleEntry { level: "log".into(), message: line, ts: now_ts() });
                }
            }
        });
    }

    // Capture stderr in a background thread
    let console_err = Arc::clone(&state.console_output);
    if let Some(stderr) = child.stderr.take() {
        thread::spawn(move || {
            for line in std::io::BufReader::new(stderr).lines().flatten() {
                if let Ok(mut out) = console_err.lock() {
                    out.push(ConsoleEntry { level: "warn".into(), message: line, ts: now_ts() });
                }
            }
        });
    }

    // Intentionally leak the child so Vite keeps running; we track by PID to kill later.
    std::mem::forget(child);
    *state.preview_pid.lock().map_err(|e| e.to_string())? = Some(pid);

    Ok("http://localhost:5174".to_string())
}

/// Stop the running preview server.
#[tauri::command]
pub fn stop_preview(
    state: tauri::State<'_, SelfModState>,
) -> Result<(), String> {
    let mut pid_lock = state.preview_pid.lock().map_err(|e| e.to_string())?;
    if let Some(pid) = *pid_lock {
        let _ = Command::new("kill").arg(pid.to_string()).output();
        *pid_lock = None;
    }
    Ok(())
}

/// Poll the captured console output from the preview server.
#[tauri::command]
pub fn get_console_output(
    state: tauri::State<'_, SelfModState>,
) -> Result<Vec<ConsoleEntry>, String> {
    Ok(state.console_output.lock().map_err(|e| e.to_string())?.clone())
}
