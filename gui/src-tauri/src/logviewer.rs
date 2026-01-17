use std::collections::HashMap;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::sync::RwLock;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LogSource {
    pub id: String,
    pub name: String,
    pub path: PathBuf,
    pub exists: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LogLine {
    pub source_id: String,
    pub line: String,
    pub level: LogLevel,
    pub timestamp: Option<String>,
}

#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Debug,
    Info,
    Warning,
    Error,
    Message,
    Unknown,
}

/// プロファイルごとのログ監視状態
pub struct LogWatcherState {
    /// 監視中のプロファイル名をキーとしたタスクハンドル
    watchers: HashMap<String, tokio::task::JoinHandle<()>>,
    /// 各ファイルの読み取り位置
    file_positions: HashMap<PathBuf, u64>,
}

impl Default for LogWatcherState {
    fn default() -> Self {
        Self {
            watchers: HashMap::new(),
            file_positions: HashMap::new(),
        }
    }
}

pub type LogWatcherStateHandle = Arc<RwLock<LogWatcherState>>;

/// ログファイルのパスを検出
pub fn detect_log_sources(game_dir: &PathBuf) -> Vec<LogSource> {
    let mut sources = Vec::new();

    // 1. Resonite本体のログ（最新のファイル）
    let logs_dir = game_dir.join("Logs");
    if logs_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&logs_dir) {
            let mut log_files: Vec<_> = entries
                .filter_map(|e| e.ok())
                .filter(|e| {
                    e.path()
                        .extension()
                        .map(|ext| ext == "log")
                        .unwrap_or(false)
                })
                .collect();

            // 更新日時でソート（最新が先）
            log_files.sort_by(|a, b| {
                let time_a = a.metadata().and_then(|m| m.modified()).ok();
                let time_b = b.metadata().and_then(|m| m.modified()).ok();
                time_b.cmp(&time_a)
            });

            if let Some(latest) = log_files.first() {
                sources.push(LogSource {
                    id: "resonite".to_string(),
                    name: "Resonite".to_string(),
                    path: latest.path(),
                    exists: true,
                });
            }
        }
    }

    // 2. BepInExメインログ
    let bepinex_log = game_dir.join("BepInEx").join("LogOutput.log");
    sources.push(LogSource {
        id: "bepinex".to_string(),
        name: "BepInEx".to_string(),
        path: bepinex_log.clone(),
        exists: bepinex_log.exists(),
    });

    // 3. BepInEx Rendererログ
    let renderer_log = game_dir
        .join("Renderer")
        .join("BepInEx")
        .join("LogOutput.log");
    sources.push(LogSource {
        id: "renderer".to_string(),
        name: "Renderer".to_string(),
        path: renderer_log.clone(),
        exists: renderer_log.exists(),
    });

    sources
}

/// ログレベルをパース
fn parse_log_level(line: &str) -> LogLevel {
    // BepInExフォーマット: [Level  :Source] Message
    if line.starts_with('[') {
        if let Some(end) = line.find(':') {
            let level_part = &line[1..end].trim().to_lowercase();
            return match level_part.as_str() {
                "debug" => LogLevel::Debug,
                "info" => LogLevel::Info,
                "warning" | "warn" => LogLevel::Warning,
                "error" => LogLevel::Error,
                "message" => LogLevel::Message,
                _ => LogLevel::Unknown,
            };
        }
    }

    // Resoniteフォーマット: emoji + timestamp
    // ℹ️ = Info, ⚠️ = Warning, ❌ = Error
    if line.contains("ℹ") || line.starts_with("\u{2139}") {
        return LogLevel::Info;
    }
    if line.contains("⚠") || line.starts_with("\u{26A0}") {
        return LogLevel::Warning;
    }
    if line.contains("❌") || line.starts_with("\u{274C}") {
        return LogLevel::Error;
    }

    LogLevel::Unknown
}

/// タイムスタンプを抽出
fn extract_timestamp(line: &str) -> Option<String> {
    // Resoniteフォーマット: "ℹ️ 20:39:32.600 (FPS: N):"
    if let Some(start) = line.find(|c: char| c.is_ascii_digit()) {
        if let Some(fps_start) = line.find("(FPS:") {
            return Some(line[start..fps_start].trim().to_string());
        }
    }
    None
}

/// ファイルからShift-JISとUTF-8両対応で読み込む
fn read_file_content(path: &PathBuf) -> Result<String, std::io::Error> {
    let bytes = std::fs::read(path)?;
    
    // まずUTF-8として試す
    if let Ok(content) = String::from_utf8(bytes.clone()) {
        return Ok(content);
    }
    
    // UTF-8でなければShift-JISとして解釈
    let (decoded, _, _) = encoding_rs::SHIFT_JIS.decode(&bytes);
    Ok(decoded.into_owned())
}

/// ファイルの新しい行を読み取る
pub fn read_new_lines(
    path: &PathBuf,
    last_position: u64,
    source_id: &str,
) -> Result<(Vec<LogLine>, u64), std::io::Error> {
    let file = std::fs::File::open(path)?;
    let metadata = file.metadata()?;
    let file_size = metadata.len();

    // ファイルが小さくなった場合はリセット（ログローテーション）
    let start_pos = if file_size < last_position {
        0
    } else {
        last_position
    };

    let mut reader = BufReader::new(file);
    reader.seek(SeekFrom::Start(start_pos))?;

    let mut lines = Vec::new();
    let mut buffer = Vec::new();
    
    loop {
        buffer.clear();
        match reader.read_until(b'\n', &mut buffer) {
            Ok(0) => break, // EOF
            Ok(_) => {
                // UTF-8とShift-JIS両対応
                let line_str = if let Ok(s) = std::str::from_utf8(&buffer) {
                    s.trim_end_matches(|c| c == '\n' || c == '\r').to_string()
                } else {
                    let (decoded, _, _) = encoding_rs::SHIFT_JIS.decode(&buffer);
                    decoded.trim_end_matches(|c| c == '\n' || c == '\r').to_string()
                };
                
                if !line_str.is_empty() {
                    let level = parse_log_level(&line_str);
                    let timestamp = extract_timestamp(&line_str);
                    lines.push(LogLine {
                        source_id: source_id.to_string(),
                        line: line_str,
                        level,
                        timestamp,
                    });
                }
            }
            Err(e) => return Err(e),
        }
    }

    let new_position = reader.stream_position()?;
    Ok((lines, new_position))
}

/// ログ監視タスクを開始
pub async fn start_log_watcher(
    app_handle: AppHandle,
    profile_name: String,
    game_dir: PathBuf,
    state: LogWatcherStateHandle,
) {
    // 既存の監視を停止
    {
        let mut state_guard = state.write().await;
        if let Some(handle) = state_guard.watchers.remove(&profile_name) {
            handle.abort();
        }
    }

    let profile_name_clone = profile_name.clone();
    let state_clone = state.clone();

    let handle = tokio::spawn(async move {
        let mut positions: HashMap<String, u64> = HashMap::new();
        let window_label = format!("logviewer-{}", profile_name_clone);

        loop {
            // ウィンドウが存在するか確認
            if app_handle.get_window(&window_label).is_none() {
                break;
            }

            let sources = detect_log_sources(&game_dir);
            
            for source in &sources {
                if !source.exists {
                    continue;
                }

                let last_pos = positions.get(&source.id).copied().unwrap_or(0);
                
                match read_new_lines(&source.path, last_pos, &source.id) {
                    Ok((lines, new_pos)) => {
                        positions.insert(source.id.clone(), new_pos);
                        
                        if !lines.is_empty() {
                            // イベントを送信
                            let _ = app_handle.emit_to(
                                &window_label,
                                "log-lines",
                                lines,
                            );
                        }
                    }
                    Err(e) => {
                        eprintln!("Error reading log {}: {}", source.path.display(), e);
                    }
                }
            }

            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        }

        // クリーンアップ
        let mut state_guard = state_clone.write().await;
        state_guard.watchers.remove(&profile_name_clone);
    });

    // ハンドルを保存
    let mut state_guard = state.write().await;
    state_guard.watchers.insert(profile_name, handle);
}

/// ログ監視を停止
pub async fn stop_log_watcher(profile_name: &str, state: LogWatcherStateHandle) {
    let mut state_guard = state.write().await;
    if let Some(handle) = state_guard.watchers.remove(profile_name) {
        handle.abort();
    }
}

/// Resoniteプロセスを検索してKill
pub fn kill_resonite_for_profile(game_dir: &PathBuf) -> Result<u32, String> {
    use std::process::Command;

    #[cfg(target_os = "windows")]
    {
        // ゲームディレクトリのパスを正規化
        let game_dir_str = game_dir.to_string_lossy().to_string();
        
        // PowerShellスクリプト: パスにgame_dirが含まれるResonite/Renderiteプロセスをkill
        let script = format!(
            r#"$gameDir = '{}'; $procs = Get-Process | Where-Object {{ $_.ProcessName -match 'Resonite|Renderite' -and $_.Path -ne $null -and $_.Path.StartsWith($gameDir) }}; $count = @($procs).Count; $procs | Stop-Process -Force -ErrorAction SilentlyContinue; $count"#,
            game_dir_str.replace("'", "''")
        );

        let output = Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .output()
            .map_err(|e| format!("Failed to execute PowerShell: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let killed_count = stdout.parse::<u32>().unwrap_or(0);

        Ok(killed_count)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Not implemented for this platform".to_string())
    }
}
