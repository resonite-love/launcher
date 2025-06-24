// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use std::path::PathBuf;
use tauri::{State, Window, AppHandle};
use reso_launcher_lib::{
    depotdownloader::DepotDownloader,
    install::{ResoniteInstall, ResoniteInstallManager},
    profile::{Profile, ProfileManager},
    mod_loader::ModLoader,
    mod_loader_type::ModLoaderType,
    monkey_loader::MonkeyLoader,
    mod_manager::{ModManager, ModInfo, InstalledMod, GitHubRelease, ModRelease, UnmanagedMod, MultiFileInstallRequest, FileInstallChoice},
    utils,
};
use std::process::Command;

// Application state
struct AppState {
    depot_downloader: Option<DepotDownloader>,
    profile_manager: Option<ProfileManager>,
    install_manager: Option<ResoniteInstallManager>,
    exe_dir: Option<PathBuf>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            depot_downloader: None,
            profile_manager: None,
            install_manager: None,
            exe_dir: None,
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct ProfileInfo {
    /// フォルダ名として使用される内部ID
    pub id: String,
    /// ユーザーに表示される名前
    pub display_name: String,
    /// 互換性のための旧フィールド
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub name: String,
    pub description: String,
    pub has_game: bool,
    pub branch: Option<String>,
    pub manifest_id: Option<String>,
    pub version: Option<String>,
    pub has_mod_loader: bool,
    pub mod_loader_type: Option<ModLoaderType>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct GameInstallRequest {
    pub profile_name: String,
    pub branch: String,
    pub manifest_id: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct UnifiedModLoaderInfo {
    pub installed: bool,
    pub loader_type: Option<ModLoaderType>,
    pub version: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct AppUpdateInfo {
    current_version: String,
    latest_version: String,
    update_available: bool,
    release_notes: String,
    download_url: String,
    published_at: String,
    assets: Vec<UpdateAsset>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct UpdateAsset {
    name: String,
    download_url: String,
    size: i64,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct AppStatus {
    pub initialized: bool,
    pub depot_downloader_available: bool,
    pub exe_dir: Option<String>,
    pub is_first_run: bool,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct SteamCredentials {
    pub username: String,
    pub password: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct YtDlpInfo {
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
}

// Check if this is the first run
fn is_first_run(exe_dir: &std::path::Path) -> bool {
    let first_run_marker = exe_dir.join(".first_run_complete");
    !first_run_marker.exists()
}

// Mark first run as complete
fn mark_first_run_complete(exe_dir: &std::path::Path) -> Result<(), String> {
    let first_run_marker = exe_dir.join(".first_run_complete");
    std::fs::write(first_run_marker, "")
        .map_err(|e| format!("Failed to mark first run complete: {}", e))
}

// Initialize the application
#[tauri::command]
async fn initialize_app(state: State<'_, Mutex<AppState>>) -> Result<AppStatus, String> {
    let mut app_state = state.lock().unwrap();
    
    match utils::get_executable_directory() {
        Ok(dir) => {
            app_state.exe_dir = Some(dir.clone());
            
            // Check if this is the first run
            let is_first_run = is_first_run(&dir);
            
            // Initialize DepotDownloader
            let depot_downloader = DepotDownloader::with_default_path(&dir);
            let depot_available = depot_downloader.check_exists().is_ok();
            
            app_state.depot_downloader = Some(depot_downloader);
            app_state.profile_manager = Some(ProfileManager::new(&dir));
            app_state.install_manager = Some(ResoniteInstallManager::new(&dir));
            
            Ok(AppStatus {
                initialized: true,
                depot_downloader_available: depot_available,
                exe_dir: Some(dir.to_string_lossy().to_string()),
                is_first_run,
            })
        }
        Err(e) => Err(format!("Failed to initialize: {}", e)),
    }
}

// Install Resonite to a profile
#[tauri::command]
async fn install_game_to_profile(
    request: GameInstallRequest,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let app_state = state.lock().unwrap();
    
    let depot_downloader = app_state.depot_downloader.as_ref()
        .ok_or("DepotDownloader not initialized")?;
    
    let profile_manager = app_state.profile_manager.as_ref()
        .ok_or("Profile manager not initialized")?;
    
    let install = ResoniteInstall::new(
        request.profile_name.clone(),
        request.branch.clone(),
        request.manifest_id.clone(),
        request.username,
        request.password,
    );
    
    install.install(depot_downloader, profile_manager)
        .map_err(|e| format!("Installation failed: {}", e))?;
    
    Ok(format!("Resonite {} branch installed successfully to profile '{}'", request.branch, request.profile_name))
}

// Install Resonite to a profile (Auto-fallback Mode)
#[tauri::command]
async fn install_game_to_profile_interactive(
    request: GameInstallRequest,
    state: State<'_, Mutex<AppState>>,
    window: Window,
) -> Result<String, String> {
    let app_state = state.lock().unwrap();
    
    let depot_downloader = app_state.depot_downloader.as_ref()
        .ok_or("DepotDownloader not initialized")?;
    
    let profile_manager = app_state.profile_manager.as_ref()
        .ok_or("Profile manager not initialized")?;
    
    let install = ResoniteInstall::new(
        request.profile_name.clone(),
        request.branch.clone(),
        request.manifest_id.clone(),
        request.username,
        request.password,
    );

    let profile_name = request.profile_name.clone();
    let branch = request.branch.clone();
    let window_clone = window.clone();
    
    // 自動フォールバック機能を使用
    install.install_with_fallback(depot_downloader, profile_manager, move |status_message, is_complete| {
        // ステータス更新をGUIに送信
        let _ = window_clone.emit("installation-status", serde_json::json!({
            "profile_name": profile_name,
            "branch": branch,
            "message": status_message,
            "is_complete": is_complete
        }));

        if is_complete {
            let success = status_message.contains("完了しました") && !status_message.contains("失敗");
            let final_message = if success {
                format!("Installation completed for profile '{}' ({})", profile_name, branch)
            } else {
                format!("Installation failed for profile '{}' ({})", profile_name, branch)
            };

            let _ = window_clone.emit("installation-completed", serde_json::json!({
                "profile_name": profile_name,
                "branch": branch,
                "success": success,
                "message": final_message
            }));
        }
    }).map_err(|e| format!("Installation failed: {}", e))?;
    
    Ok(format!("Resonite {} branch installation started for profile '{}' (auto-fallback enabled)", request.branch, request.profile_name))
}

// Update Resonite in a profile
#[tauri::command]
async fn update_profile_game(
    request: GameInstallRequest,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let app_state = state.lock().unwrap();
    
    let depot_downloader = app_state.depot_downloader.as_ref()
        .ok_or("DepotDownloader not initialized")?;
    
    let profile_manager = app_state.profile_manager.as_ref()
        .ok_or("Profile manager not initialized")?;
    
    let install = ResoniteInstall::new(
        request.profile_name.clone(),
        request.branch.clone(),
        request.manifest_id.clone(),
        request.username,
        request.password,
    );
    
    install.update(depot_downloader, profile_manager)
        .map_err(|e| format!("Update failed: {}", e))?;
    
    Ok(format!("Resonite {} branch updated successfully in profile '{}'", request.branch, request.profile_name))
}

// Update Resonite in a profile (Auto-fallback Mode)
#[tauri::command]
async fn update_profile_game_interactive(
    request: GameInstallRequest,
    state: State<'_, Mutex<AppState>>,
    window: Window,
) -> Result<String, String> {
    let app_state = state.lock().unwrap();
    
    let depot_downloader = app_state.depot_downloader.as_ref()
        .ok_or("DepotDownloader not initialized")?;
    
    let profile_manager = app_state.profile_manager.as_ref()
        .ok_or("Profile manager not initialized")?;
    
    let install = ResoniteInstall::new(
        request.profile_name.clone(),
        request.branch.clone(),
        request.manifest_id.clone(),
        request.username,
        request.password,
    );

    let profile_name = request.profile_name.clone();
    let branch = request.branch.clone();
    let window_clone = window.clone();
    
    // 自動フォールバック機能を使用
    install.update_with_fallback(depot_downloader, profile_manager, move |status_message, is_complete| {
        // ステータス更新をGUIに送信
        let _ = window_clone.emit("installation-status", serde_json::json!({
            "profile_name": profile_name,
            "branch": branch,
            "message": status_message,
            "is_complete": is_complete
        }));

        if is_complete {
            let success = status_message.contains("完了しました") && !status_message.contains("失敗");
            let final_message = if success {
                format!("Update completed for profile '{}' ({})", profile_name, branch)
            } else {
                format!("Update failed for profile '{}' ({})", profile_name, branch)
            };

            let _ = window_clone.emit("installation-completed", serde_json::json!({
                "profile_name": profile_name,
                "branch": branch,
                "success": success,
                "message": final_message
            }));
        }
    }).map_err(|e| format!("Update failed: {}", e))?;
    
    Ok(format!("Resonite {} branch update started for profile '{}' (auto-fallback enabled)", request.branch, request.profile_name))
}

// Check for updates in a profile
#[tauri::command]
async fn check_profile_updates(
    request: GameInstallRequest,
    state: State<'_, Mutex<AppState>>,
) -> Result<bool, String> {
    let app_state = state.lock().unwrap();
    
    let depot_downloader = app_state.depot_downloader.as_ref()
        .ok_or("DepotDownloader not initialized")?;
    
    let profile_manager = app_state.profile_manager.as_ref()
        .ok_or("Profile manager not initialized")?;
    
    let install = ResoniteInstall::new(
        request.profile_name.clone(),
        request.branch.clone(),
        request.manifest_id.clone(),
        request.username,
        request.password,
    );
    
    install.check_updates(depot_downloader, profile_manager)
        .map_err(|e| format!("Update check failed: {}", e))
}

// Get profiles with game info
#[tauri::command]
async fn get_profiles(state: State<'_, Mutex<AppState>>) -> Result<Vec<ProfileInfo>, String> {
    let app_state = state.lock().unwrap();
    
    let profile_manager = app_state.profile_manager.as_ref()
        .ok_or("Profile manager not initialized")?;
    
    let profiles = profile_manager.list_profiles()
        .map_err(|e| format!("Failed to get profiles: {}", e))?;
    
    Ok(profiles.into_iter().map(|p| {
        let profile_dir = profile_manager.get_profile_dir(p.get_folder_name());
        let current_version = if p.has_game_installed() {
            p.get_game_version(&profile_dir)
        } else {
            None
        };
        
        // MODローダーの状態をチェック
        let (has_mod_loader, mod_loader_type) = if p.has_game_installed() {
            let game_dir = p.get_game_dir(&profile_dir);
            
            // プロファイルに保存されているMODローダータイプを優先
            if let Some(saved_type) = p.mod_loader_type {
                (true, Some(saved_type))
            } else {
                // 実際にインストールされているMODローダーを検出
                let rml = ModLoader::new(game_dir.clone());
                let ml = MonkeyLoader::new(game_dir);
                
                let rml_installed = rml.get_status().map(|info| info.installed).unwrap_or(false);
                let ml_installed = ml.get_status().map(|info| info.installed).unwrap_or(false);
                
                if rml_installed {
                    (true, Some(ModLoaderType::ResoniteModLoader))
                } else if ml_installed {
                    (true, Some(ModLoaderType::MonkeyLoader))
                } else {
                    (false, None)
                }
            }
        } else {
            (false, None)
        };
        
        ProfileInfo {
            id: p.get_folder_name().to_string(),
            display_name: p.get_display_name().to_string(),
            name: p.name.clone(), // 互換性のため
            description: p.description.clone(),
            has_game: p.has_game_installed(),
            branch: p.game_info.as_ref().map(|info| info.branch.clone()),
            manifest_id: p.game_info.as_ref().and_then(|info| info.manifest_id.clone()),
            version: current_version,
            has_mod_loader,
            mod_loader_type,
        }
    }).collect())
}

// Create profile
#[tauri::command]
async fn create_profile(
    name: String,
    description: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let app_state = state.lock().unwrap();
    
    let profile_manager = app_state.profile_manager.as_ref()
        .ok_or("Profile manager not initialized")?;
    
    let mut profile = profile_manager.create_profile(&name)
        .map_err(|e| format!("Failed to create profile: {}", e))?;
    
    profile.description = description;
    
    let profile_dir = profile_manager.get_profile_dir(profile.get_folder_name());
    
    profile.save(&profile_dir)
        .map_err(|e| format!("Failed to save profile: {}", e))?;
    
    Ok(format!("Profile '{}' created successfully", name))
}

// Launch Resonite with profile
#[tauri::command]
async fn launch_resonite(
    profile_name: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let app_state = state.lock().unwrap();
    
    let install_manager = app_state.install_manager.as_ref()
        .ok_or("Install manager not initialized")?;
    
    let profile_manager = app_state.profile_manager.as_ref()
        .ok_or("Profile manager not initialized")?;
    
    install_manager.launch_with_profile(&profile_name, profile_manager)
        .map_err(|e| format!("Launch failed: {}", e))?;
    
    Ok(format!("Resonite launched with profile '{}'", profile_name))
}

// Interactive Steam login
#[tauri::command]
async fn steam_login(
    username: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let app_state = state.lock().unwrap();
    
    let depot_downloader = app_state.depot_downloader.as_ref()
        .ok_or("DepotDownloader not initialized")?;
    
    depot_downloader.interactive_login(&username)
        .map_err(|e| format!("Login failed: {}", e))?;
    
    Ok("Steam login successful".to_string())
}

// Save Steam credentials
#[tauri::command]
async fn save_steam_credentials(
    credentials: SteamCredentials,
    app: AppHandle,
) -> Result<String, String> {
    let app_data_dir = app.path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;
    
    // Create app data directory if it doesn't exist
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    
    let credentials_path = app_data_dir.join("steam_credentials.json");
    let json = serde_json::to_string_pretty(&credentials)
        .map_err(|e| format!("Failed to serialize credentials: {}", e))?;
    
    std::fs::write(credentials_path, json)
        .map_err(|e| format!("Failed to save credentials: {}", e))?;
    
    Ok("Steam credentials saved successfully".to_string())
}

// Load Steam credentials
#[tauri::command]
async fn load_steam_credentials(app: AppHandle) -> Result<Option<SteamCredentials>, String> {
    let app_data_dir = app.path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;
    
    let credentials_path = app_data_dir.join("steam_credentials.json");
    
    if !credentials_path.exists() {
        return Ok(None);
    }
    
    let json = std::fs::read_to_string(credentials_path)
        .map_err(|e| format!("Failed to read credentials: {}", e))?;
    
    let credentials: SteamCredentials = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse credentials: {}", e))?;
    
    Ok(Some(credentials))
}

// Clear Steam credentials
#[tauri::command]
async fn clear_steam_credentials(app: AppHandle) -> Result<String, String> {
    let app_data_dir = app.path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;
    
    let credentials_path = app_data_dir.join("steam_credentials.json");
    
    if credentials_path.exists() {
        std::fs::remove_file(credentials_path)
            .map_err(|e| format!("Failed to remove credentials: {}", e))?;
    }
    
    Ok("Steam credentials cleared successfully".to_string())
}

// Get profile configuration
#[tauri::command]
async fn get_profile_config(
    profile_name: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<Profile, String> {
    let app_state = state.lock().unwrap();
    
    let profile_manager = app_state.profile_manager.as_ref()
        .ok_or("Profile manager not initialized")?;
    
    profile_manager.get_profile(&profile_name)
        .map_err(|e| format!("Failed to get profile: {}", e))
}

// Update profile configuration
#[tauri::command]
async fn update_profile_config(
    profile: Profile,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let app_state = state.lock().unwrap();
    
    let profile_manager = app_state.profile_manager.as_ref()
        .ok_or("Profile manager not initialized")?;
    
    profile_manager.update_profile(&profile)
        .map_err(|e| format!("Failed to update profile: {}", e))?;
    
    Ok(format!("Profile '{}' updated successfully", profile.name))
}

// Helper function to find the game installation path for a profile
fn find_game_path(profile_dir: &std::path::Path) -> Result<std::path::PathBuf, String> {
    println!("Searching for game in profile dir: {:?}", profile_dir);
    
    let release_path = profile_dir.join("Game");
    let release_exe = release_path.join("Resonite.exe");
    println!("Checking release path: {:?}, exe exists: {}", release_path, release_exe.exists());
    
    if release_path.exists() && release_exe.exists() {
        println!("Found game in: {:?}", release_path);
        return Ok(release_path);
    }
    
    Err(format!("Game not installed in this profile. Searched in: {:?}", profile_dir))
}

// Get mod loader status for a profile
#[tauri::command]
async fn get_mod_loader_status(
    profile_name: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<UnifiedModLoaderInfo, String> {
    let app_state = state.lock().unwrap();
    
    let profile_manager = app_state.profile_manager.as_ref()
        .ok_or("Profile manager not initialized")?;
    
    let profile = profile_manager.get_profile(&profile_name)
        .map_err(|e| format!("Failed to get profile: {}", e))?;
    
    let profile_dir = profile_manager.get_profile_dir(&profile_name);
    let game_path = find_game_path(&profile_dir)?;
    
    // Check ResoniteModLoader
    let rml = ModLoader::new(game_path.clone());
    let rml_status = rml.get_status()
        .map_err(|e| format!("Failed to get RML status: {}", e))?;
    
    // Check MonkeyLoader
    let ml = MonkeyLoader::new(game_path);
    let ml_status = ml.get_status()
        .map_err(|e| format!("Failed to get MonkeyLoader status: {}", e))?;
    
    // Determine which loader is installed
    let (installed, loader_type, version) = if rml_status.installed {
        (true, Some(ModLoaderType::ResoniteModLoader), rml_status.version)
    } else if ml_status.installed {
        (true, Some(ModLoaderType::MonkeyLoader), ml_status.version)
    } else {
        (false, None, None)
    };
    
    // If profile has a loader type stored, use that, otherwise use detected
    let loader_type = if installed {
        profile.mod_loader_type.or(loader_type)
    } else {
        // プロファイルにローダータイプが保存されているが実際にはインストールされていない場合
        profile.mod_loader_type
    };
    
    Ok(UnifiedModLoaderInfo {
        installed,
        loader_type,
        version,
    })
}

// Install mod loader to a profile
#[tauri::command]
async fn install_mod_loader(
    profile_name: String,
    loader_type: ModLoaderType,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let game_path = {
        let app_state = state.lock().unwrap();
        
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
        
        let profile_dir = profile_manager.get_profile_dir(&profile_name);
        find_game_path(&profile_dir)?
    };
    
    let result = match loader_type {
        ModLoaderType::ResoniteModLoader => {
            let mod_loader = ModLoader::new(game_path.clone());
            mod_loader.install().await
                .map_err(|e| format!("Failed to install ResoniteModLoader: {}", e))?
        },
        ModLoaderType::MonkeyLoader => {
            let monkey_loader = MonkeyLoader::new(game_path.clone());
            monkey_loader.install().await
                .map_err(|e| format!("Failed to install MonkeyLoader: {}", e))?
        }
    };
    
    // プロファイルの起動引数も更新
    {
        let app_state = state.lock().unwrap();
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
            
        let mut profile = profile_manager.get_profile(&profile_name)
            .map_err(|e| format!("Failed to get profile: {}", e))?;
        
        // Update launch args based on loader type
        match loader_type {
            ModLoaderType::ResoniteModLoader => {
                let mod_loader = ModLoader::new(game_path.clone());
                mod_loader.add_launch_args(&mut profile.args);
            },
            ModLoaderType::MonkeyLoader => {
                // MonkeyLoader doesn't need special launch args
                let monkey_loader = MonkeyLoader::new(game_path.clone());
                monkey_loader.remove_disable_args(&mut profile.args);
            }
        }
        
        // Save the mod loader type to the profile
        profile.mod_loader_type = Some(loader_type);
        
        profile_manager.update_profile(&profile)
            .map_err(|e| format!("Failed to update profile args: {}", e))?;
    }
    
    Ok(result)
}

// Uninstall mod loader from a profile
#[tauri::command]
async fn uninstall_mod_loader(
    profile_name: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let (game_path, mod_loader_type) = {
        let app_state = state.lock().unwrap();
        
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
        
        let profile = profile_manager.get_profile(&profile_name)
            .map_err(|e| format!("Failed to get profile: {}", e))?;
        
        let profile_dir = profile_manager.get_profile_dir(&profile_name);
        let game_path = find_game_path(&profile_dir)?;
        
        (game_path, profile.mod_loader_type)
    };
    
    // Detect which loader is installed if not specified in profile
    let loader_type = if let Some(loader_type) = mod_loader_type {
        loader_type
    } else {
        // Auto-detect
        let rml = ModLoader::new(game_path.clone());
        let ml = MonkeyLoader::new(game_path.clone());
        
        if rml.get_status().map_or(false, |s| s.installed) {
            ModLoaderType::ResoniteModLoader
        } else if ml.get_status().map_or(false, |s| s.installed) {
            ModLoaderType::MonkeyLoader
        } else {
            return Err("No mod loader installed".to_string());
        }
    };
    
    // Uninstall the appropriate loader
    let result = match loader_type {
        ModLoaderType::ResoniteModLoader => {
            let mod_loader = ModLoader::new(game_path.clone());
            mod_loader.uninstall()
                .map_err(|e| format!("Failed to uninstall ResoniteModLoader: {}", e))?
        },
        ModLoaderType::MonkeyLoader => {
            let monkey_loader = MonkeyLoader::new(game_path.clone());
            monkey_loader.uninstall()
                .map_err(|e| format!("Failed to uninstall MonkeyLoader: {}", e))?
        }
    };
    
    // プロファイルの起動引数からも削除
    {
        let app_state = state.lock().unwrap();
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
            
        let mut profile = profile_manager.get_profile(&profile_name)
            .map_err(|e| format!("Failed to get profile: {}", e))?;
        
        // Remove launch args based on loader type
        match loader_type {
            ModLoaderType::ResoniteModLoader => {
                let mod_loader = ModLoader::new(game_path.clone());
                mod_loader.remove_launch_args(&mut profile.args);
            },
            ModLoaderType::MonkeyLoader => {
                // MonkeyLoader doesn't have special launch args to remove
            }
        }
        
        // Clear mod loader type from profile
        profile.mod_loader_type = None;
        
        profile_manager.update_profile(&profile)
            .map_err(|e| format!("Failed to update profile args: {}", e))?;
    }
    
    Ok(result)
}

// Open profile folder in system file explorer
#[tauri::command]
async fn open_profile_folder(
    profile_name: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let app_state = state.lock().unwrap();
    
    let profile_manager = app_state.profile_manager.as_ref()
        .ok_or("Profile manager not initialized")?;
    
    let profile_dir = profile_manager.get_profile_dir(&profile_name);
    
    if !profile_dir.exists() {
        return Err(format!("Profile directory '{}' does not exist", profile_name));
    }
    
    // Open folder in system file explorer
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        
        std::process::Command::new("explorer")
            .arg(&profile_dir)
            .creation_flags(if cfg!(debug_assertions) { 0 } else { 0x08000000 }) // CREATE_NO_WINDOW in release
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&profile_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&profile_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }
    
    Ok(format!("Opened profile folder: {}", profile_dir.display()))
}

// Duplicate a profile and all its data
#[tauri::command]
async fn duplicate_profile(
    source_profile_name: String,
    new_profile_name: String,
    new_description: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let app_state = state.lock().unwrap();
    
    let profile_manager = app_state.profile_manager.as_ref()
        .ok_or("Profile manager not initialized")?;
    
    // Check if source profile exists
    let source_profile = profile_manager.get_profile(&source_profile_name)
        .map_err(|e| format!("Source profile not found: {}", e))?;
    
    // Check if target profile name already exists
    if profile_manager.get_profile(&new_profile_name).is_ok() {
        return Err(format!("Profile '{}' already exists", new_profile_name));
    }
    
    // Create new profile with unique folder name
    let mut new_profile = profile_manager.create_profile(&new_profile_name)
        .map_err(|e| format!("Failed to create new profile: {}", e))?;
    
    // Copy all settings from source profile
    new_profile.description = new_description;
    new_profile.args = source_profile.args.clone();
    new_profile.game_info = source_profile.game_info.clone();
    new_profile.mod_loader_type = source_profile.mod_loader_type;
    
    // Get profile directories
    let source_profile_dir = profile_manager.get_profile_dir(&source_profile_name);
    let new_profile_dir = profile_manager.get_profile_dir(&new_profile.get_folder_name());
    
    // Save the new profile configuration first
    new_profile.save(&new_profile_dir)
        .map_err(|e| format!("Failed to save new profile: {}", e))?;
    
    // Copy all profile data (Game, DataPath, mods, etc.)
    if source_profile_dir.exists() {
        copy_directory_recursive(&source_profile_dir, &new_profile_dir, &new_profile.get_folder_name())
            .map_err(|e| format!("Failed to copy profile data: {}", e))?;
    }
    
    Ok(format!("Profile '{}' duplicated successfully as '{}'", source_profile_name, new_profile_name))
}

// Helper function to recursively copy directory contents
fn copy_directory_recursive(src: &std::path::Path, dst: &std::path::Path, new_profile_id: &str) -> Result<(), String> {
    if !src.exists() {
        return Ok(());
    }
    
    // Create destination directory if it doesn't exist
    std::fs::create_dir_all(dst)
        .map_err(|e| format!("Failed to create destination directory: {}", e))?;
    
    // Iterate through source directory
    for entry in std::fs::read_dir(src)
        .map_err(|e| format!("Failed to read source directory: {}", e))? {
        let entry = entry
            .map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let entry_path = entry.path();
        let file_name = entry.file_name();
        
        // Skip the launchconfig.json file as it's already created with new profile data
        if file_name == "launchconfig.json" {
            continue;
        }
        
        let dst_path = dst.join(&file_name);
        
        if entry_path.is_dir() {
            copy_directory_recursive(&entry_path, &dst_path, new_profile_id)?;
        } else {
            std::fs::copy(&entry_path, &dst_path)
                .map_err(|e| format!("Failed to copy file '{}': {}", entry_path.display(), e))?;
        }
    }
    
    Ok(())
}

// Delete a profile and all its data
#[tauri::command]
fn delete_profile(
    profile_name: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let mut app_state = state.lock().unwrap();
    
    let profile_manager = app_state.profile_manager.as_mut()
        .ok_or("Profile manager not initialized")?;
    
    // Prevent deletion of default profile
    if profile_name == "default" {
        return Err("Cannot delete the default profile".to_string());
    }
    
    // Get profile directory path before deletion
    let profile_dir = profile_manager.get_profile_dir(&profile_name);
    
    // Delete profile from manager (this removes from profiles list)
    profile_manager.delete_profile(&profile_name)
        .map_err(|e| format!("Failed to delete profile: {}", e))?;
    
    // Delete profile directory and all its contents
    if profile_dir.exists() {
        std::fs::remove_dir_all(&profile_dir)
            .map_err(|e| format!("Failed to delete profile directory: {}", e))?;
    }
    
    Ok(format!("Profile '{}' deleted successfully", profile_name))
}

// Check for application updates
#[tauri::command]
async fn check_for_app_update() -> Result<AppUpdateInfo, String> {
    // Get current version from Cargo.toml
    let current_version = env!("CARGO_PKG_VERSION");
    
    // Fetch latest release from GitHub
    let client = reqwest::Client::new();
    let url = "https://api.github.com/repos/resonite-love/launcher/releases/latest";
    
    let response = client
        .get(url)
        .header("User-Agent", "reso-launcher")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch update info: {}", e))?;
    
    if !response.status().is_success() {
        return Err("Failed to fetch update information from GitHub".to_string());
    }
    
    let release: GitHubRelease = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse release info: {}", e))?;
    
    // Compare versions (remove 'v' prefix if present)
    let latest_version = release.tag_name.trim_start_matches('v');
    let current_clean = current_version.trim_start_matches('v');
    
    // Simple version comparison
    let update_available = latest_version != current_clean && 
        version_compare(latest_version, current_clean) > 0;
    
    // Convert assets
    let assets: Vec<UpdateAsset> = release.assets
        .into_iter()
        .map(|asset| UpdateAsset {
            name: asset.name,
            download_url: asset.browser_download_url,
            size: asset.size.unwrap_or(0) as i64,
        })
        .collect();
    
    // Build release page URL
    let download_url = format!("https://github.com/resonite-love/launcher/releases/tag/{}", release.tag_name);
    
    Ok(AppUpdateInfo {
        current_version: current_version.to_string(),
        latest_version: latest_version.to_string(),
        update_available,
        release_notes: release.body.unwrap_or_else(|| "No release notes available".to_string()),
        download_url,
        published_at: release.published_at.unwrap_or_else(|| "Unknown".to_string()),
        assets,
    })
}

// Simple version comparison helper
fn version_compare(a: &str, b: &str) -> i32 {
    let a_parts: Vec<u32> = a.split('.').filter_map(|s| s.parse().ok()).collect();
    let b_parts: Vec<u32> = b.split('.').filter_map(|s| s.parse().ok()).collect();
    
    for i in 0..std::cmp::max(a_parts.len(), b_parts.len()) {
        let a_part = a_parts.get(i).unwrap_or(&0);
        let b_part = b_parts.get(i).unwrap_or(&0);
        
        if a_part > b_part {
            return 1;
        } else if a_part < b_part {
            return -1;
        }
    }
    
    0
}

// Fetch available MODs from manifest
#[tauri::command]
async fn fetch_mod_manifest(
    profile_name: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<ModInfo>, String> {
    let profile_dir = {
        let app_state = state.lock().unwrap();
        
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
        
        profile_manager.get_profile_dir(&profile_name)
    }; // MutexGuard is dropped here
    
    let mod_manager = ModManager::new(profile_dir);
    
    mod_manager.fetch_mod_manifest().await
        .map_err(|e| format!("Failed to fetch mod manifest: {}", e))
}

// Get installed MODs for a profile
#[tauri::command]
async fn get_installed_mods(
    profile_name: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<InstalledMod>, String> {
    let profile_dir = {
        let app_state = state.lock().unwrap();
        
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
        
        profile_manager.get_profile_dir(&profile_name)
    }; // MutexGuard is dropped here
    
    let mod_manager = ModManager::new(profile_dir);
    
    mod_manager.get_installed_mods()
        .map_err(|e| format!("Failed to get installed mods: {}", e))
}

// Install MOD from cache information
#[tauri::command]
async fn install_mod_from_cache(
    profile_name: String,
    mod_info: ModInfo,
    version: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<InstalledMod, String> {
    let (profile_dir, mod_loader_type) = {
        let app_state = state.lock().unwrap();
        
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
        
        let profile_dir = profile_manager.get_profile_dir(&profile_name);
        let profile = profile_manager.get_profile(&profile_name)
            .map_err(|e| format!("Failed to get profile: {}", e))?;
        
        let mod_loader_type = profile.mod_loader_type.map(|t| match t {
            crate::ModLoaderType::ResoniteModLoader => "ResoniteModLoader".to_string(),
            crate::ModLoaderType::MonkeyLoader => "MonkeyLoader".to_string(),
        });
        
        (profile_dir, mod_loader_type)
    }; // MutexGuard is dropped here
    
    let mod_manager = ModManager::new(profile_dir);
    
    mod_manager.install_mod_from_cache(&mod_info, version.as_deref(), mod_loader_type.as_deref()).await
        .map_err(|e| format!("Failed to install mod: {}", e))
}

// Install MOD from GitHub repository (fallback)
#[tauri::command]
async fn install_mod_from_github(
    profile_name: String,
    repo_url: String,
    version: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<InstalledMod, String> {
    let (profile_dir, mod_loader_type) = {
        let app_state = state.lock().unwrap();
        
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
        
        let profile_dir = profile_manager.get_profile_dir(&profile_name);
        let profile = profile_manager.get_profile(&profile_name)
            .map_err(|e| format!("Failed to get profile: {}", e))?;
        
        let mod_loader_type = profile.mod_loader_type.map(|t| match t {
            crate::ModLoaderType::ResoniteModLoader => "ResoniteModLoader".to_string(),
            crate::ModLoaderType::MonkeyLoader => "MonkeyLoader".to_string(),
        });
        
        (profile_dir, mod_loader_type)
    }; // MutexGuard is dropped here
    
    let mod_manager = ModManager::new(profile_dir);
    
    mod_manager.install_mod_from_github(&repo_url, version.as_deref(), mod_loader_type.as_deref()).await
        .map_err(|e| format!("Failed to install mod: {}", e))
}

// Check if a GitHub repository requires multi-file installation
#[tauri::command]
async fn check_multi_file_install(
    repo_url: String,
    version: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Option<MultiFileInstallRequest>, String> {
    let profile_dir = {
        let app_state = state.lock().unwrap();
        
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
        
        profile_manager.get_profile_dir("default")
    }; // MutexGuard is dropped here
    
    let mod_manager = ModManager::new(profile_dir);
    
    mod_manager.check_multi_file_install(&repo_url, version.as_deref()).await
        .map_err(|e| format!("Failed to check multi-file install: {}", e))
}

// Install multiple files with user choices
#[tauri::command]
async fn install_multiple_files(
    profile_name: String,
    repo_url: String,
    version: Option<String>,
    choices: Vec<FileInstallChoice>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<InstalledMod>, String> {
    let profile_dir = {
        let app_state = state.lock().unwrap();
        
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
        
        profile_manager.get_profile_dir(&profile_name)
    }; // MutexGuard is dropped here
    
    let mod_manager = ModManager::new(profile_dir);
    
    mod_manager.install_multiple_files(&repo_url, version.as_deref(), choices).await
        .map_err(|e| format!("Failed to install multiple files: {}", e))
}

// Uninstall a MOD
#[tauri::command]
async fn uninstall_mod(
    profile_name: String,
    mod_name: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let profile_dir = {
        let app_state = state.lock().unwrap();
        
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
        
        profile_manager.get_profile_dir(&profile_name)
    }; // MutexGuard is dropped here
    
    let mod_manager = ModManager::new(profile_dir);
    
    mod_manager.uninstall_mod(&mod_name)
        .map_err(|e| format!("Failed to uninstall mod: {}", e))?;
    
    Ok(format!("Successfully uninstalled mod: {}", mod_name))
}

// Disable a MOD (rename to .disabled)
#[tauri::command]
async fn disable_mod(
    profile_name: String,
    mod_name: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let profile_dir = {
        let app_state = state.lock().unwrap();
        
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
        
        profile_manager.get_profile_dir(&profile_name)
    }; // MutexGuard is dropped here
    
    let mod_manager = ModManager::new(profile_dir);
    
    mod_manager.disable_mod(&mod_name)
        .map_err(|e| format!("Failed to disable mod: {}", e))?;
    
    Ok(format!("Successfully disabled mod: {}", mod_name))
}

// Enable a MOD (remove .disabled extension)
#[tauri::command]
async fn enable_mod(
    profile_name: String,
    mod_name: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let profile_dir = {
        let app_state = state.lock().unwrap();
        
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
        
        profile_manager.get_profile_dir(&profile_name)
    }; // MutexGuard is dropped here
    
    let mod_manager = ModManager::new(profile_dir);
    
    mod_manager.enable_mod(&mod_name)
        .map_err(|e| format!("Failed to enable mod: {}", e))?;
    
    Ok(format!("Successfully enabled mod: {}", mod_name))
}

// Migrate installed MODs data
#[tauri::command]
async fn migrate_installed_mods(
    profile_name: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let profile_dir = {
        let app_state = state.lock().unwrap();
        
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
        
        profile_manager.get_profile_dir(&profile_name)
    }; // MutexGuard is dropped here
    
    let mod_manager = ModManager::new(profile_dir);
    
    // インストール済みMODを取得（自動的にマイグレーションが実行される）
    mod_manager.get_installed_mods()
        .map_err(|e| format!("Failed to migrate installed mods: {}", e))?;
    
    Ok("Successfully migrated installed mods data".to_string())
}

// Migrate profile configuration to latest version
#[tauri::command]
async fn migrate_profile_config(
    profile_name: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let profile_manager = {
        let app_state = state.lock().unwrap();
        app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?
            .clone()
    };
    
    // プロファイルを再読み込み（マイグレーションが自動実行される）
    match profile_manager.get_profile(&profile_name) {
        Ok(profile) => {
            // プロファイルをリロードして保存することでマイグレーションを強制実行
            let profile_dir = profile_manager.get_profile_dir(&profile_name);
            match profile.save(&profile_dir) {
                Ok(_) => Ok(format!("プロファイル '{}' の設定を正常にマイグレーションしました", profile_name)),
                Err(e) => Err(format!("プロファイル設定の保存に失敗しました: {}", e)),
            }
        },
        Err(e) => Err(format!("プロファイルの読み込みに失敗しました: {}", e)),
    }
}

// Get all available versions for a MOD
#[tauri::command]
async fn get_mod_versions(
    profile_name: String,
    mod_info: ModInfo,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<ModRelease>, String> {
    let profile_dir = {
        let app_state = state.lock().unwrap();
        
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
        
        profile_manager.get_profile_dir(&profile_name)
    };
    
    let mod_manager = ModManager::new(profile_dir);
    
    mod_manager.get_mod_versions(&mod_info).await
        .map_err(|e| format!("Failed to get mod versions: {}", e))
}

#[tauri::command]
async fn get_github_releases(repo_url: String) -> Result<Vec<ModRelease>, String> {
    // GitHub リポジトリURLからAPI URLに変換
    let api_url = if repo_url.contains("github.com") {
        let parts: Vec<&str> = repo_url.split('/').collect();
        if parts.len() >= 5 {
            let owner = parts[parts.len() - 2];
            let repo = parts[parts.len() - 1];
            format!("https://api.github.com/repos/{}/{}/releases", owner, repo)
        } else {
            return Err("Invalid GitHub repository URL".to_string());
        }
    } else {
        return Err("Not a valid GitHub repository URL".to_string());
    };

    // GitHub APIからリリース情報を取得
    let client = reqwest::Client::new();
    let response = client
        .get(&api_url)
        .header("User-Agent", "RESO-Launcher")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch releases: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("GitHub API error: {}", response.status()));
    }

    let releases: Vec<serde_json::Value> = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse releases: {}", e))?;

    // ModRelease形式に変換
    let mod_releases: Vec<ModRelease> = releases
        .into_iter()
        .map(|release| ModRelease {
            version: release["tag_name"].as_str().unwrap_or("").to_string(),
            download_url: None,
            release_url: release["html_url"].as_str().unwrap_or("").to_string(),
            published_at: release["published_at"].as_str().unwrap_or("").to_string(),
            prerelease: release["prerelease"].as_bool().unwrap_or(false),
            draft: release["draft"].as_bool().unwrap_or(false),
            changelog: release["body"].as_str().map(|s| s.to_string()),
            file_name: None,
            file_size: None,
            sha256: None,
        })
        .collect();

    Ok(mod_releases)
}

// Update MOD to a specific version
#[tauri::command]
async fn update_mod(
    profile_name: String,
    mod_name: String,
    target_version: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<InstalledMod, String> {
    let profile_dir = {
        let app_state = state.lock().unwrap();
        
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
        
        profile_manager.get_profile_dir(&profile_name)
    };
    
    let mod_manager = ModManager::new(profile_dir);
    
    mod_manager.update_mod(&mod_name, &target_version).await
        .map_err(|e| format!("Failed to update mod: {}", e))
}

// Downgrade MOD to a specific version
#[tauri::command]
async fn downgrade_mod(
    profile_name: String,
    mod_name: String,
    target_version: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<InstalledMod, String> {
    let profile_dir = {
        let app_state = state.lock().unwrap();
        
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
        
        profile_manager.get_profile_dir(&profile_name)
    };
    
    let mod_manager = ModManager::new(profile_dir);
    
    mod_manager.downgrade_mod(&mod_name, &target_version).await
        .map_err(|e| format!("Failed to downgrade mod: {}", e))
}

// Upgrade MOD to latest or specific version
#[tauri::command]
async fn upgrade_mod(
    profile_name: String,
    mod_name: String,
    target_version: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<InstalledMod, String> {
    let profile_dir = {
        let app_state = state.lock().unwrap();
        
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
        
        profile_manager.get_profile_dir(&profile_name)
    };
    
    let mod_manager = ModManager::new(profile_dir);
    
    mod_manager.upgrade_mod(&mod_name, target_version.as_deref()).await
        .map_err(|e| format!("Failed to upgrade mod: {}", e))
}

// Get all releases for a GitHub repository
#[tauri::command]
async fn get_all_github_releases(
    repo_url: String,
    _state: State<'_, Mutex<AppState>>,
) -> Result<Vec<GitHubRelease>, String> {
    let temp_dir = std::env::temp_dir();
    let mod_manager = ModManager::new(temp_dir);
    
    mod_manager.get_all_releases(&repo_url).await
        .map_err(|e| format!("Failed to get releases: {}", e))
}

// Scan for unmanaged MODs in rml_mods folder
#[tauri::command]
async fn scan_unmanaged_mods(
    profile_name: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<UnmanagedMod>, String> {
    let profile_dir = {
        let app_state = state.lock().unwrap();
        
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
        
        profile_manager.get_profile_dir(&profile_name)
    };
    
    let mod_manager = ModManager::new(profile_dir);
    
    // MODフォルダをスキャン
    let unmanaged_mods = mod_manager.scan_mod_folder()
        .map_err(|e| format!("Failed to scan mod folder: {}", e))?;
    
    // マニフェストとのマッチングを試行
    let matched_mods = mod_manager.match_unmanaged_mods(unmanaged_mods).await
        .map_err(|e| format!("Failed to match unmanaged mods: {}", e))?;
    
    Ok(matched_mods)
}

// Add single unmanaged MOD to management system
#[tauri::command]
async fn add_unmanaged_mod_to_system(
    profile_name: String,
    unmanaged_mod: UnmanagedMod,
    state: State<'_, Mutex<AppState>>,
) -> Result<InstalledMod, String> {
    let profile_dir = {
        let app_state = state.lock().unwrap();
        
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
        
        profile_manager.get_profile_dir(&profile_name)
    };
    
    let mod_manager = ModManager::new(profile_dir);
    
    mod_manager.add_unmanaged_mod_to_system(&unmanaged_mod).await
        .map_err(|e| format!("Failed to add unmanaged mod: {}", e))
}

// Add all unmanaged MODs to management system
#[tauri::command]
async fn add_all_unmanaged_mods_to_system(
    profile_name: String,
    unmanaged_mods: Vec<UnmanagedMod>,
    state: State<'_, Mutex<AppState>>,
) -> Result<Vec<InstalledMod>, String> {
    let profile_dir = {
        let app_state = state.lock().unwrap();
        
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
        
        profile_manager.get_profile_dir(&profile_name)
    };
    
    let mod_manager = ModManager::new(profile_dir);
    
    mod_manager.add_multiple_unmanaged_mods(&unmanaged_mods).await
        .map_err(|e| format!("Failed to add unmanaged mods: {}", e))
}

// Get latest release info from GitHub repository
#[tauri::command]
async fn get_github_release_info(
    repo_url: String,
    _state: State<'_, Mutex<AppState>>,
) -> Result<GitHubRelease, String> {
    // 任意のプロファイルディレクトリを使用（API呼び出しのみなので実際のパスは不要）
    let temp_dir = std::env::temp_dir();
    
    let mod_manager = ModManager::new(temp_dir);
    
    let (version, _download_url) = mod_manager.get_latest_release_info(&repo_url).await
        .map_err(|e| format!("Failed to get release info: {}", e))?;
    
    // 簡易的なGitHubRelease構造体を作成
    Ok(GitHubRelease {
        tag_name: version.unwrap_or_default(),
        name: None,
        body: None,
        assets: vec![],
        published_at: None,
        draft: None,
        prerelease: None,
    })
}

// Get available game versions from version monitor
#[tauri::command]
async fn get_game_versions() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = "https://raw.githubusercontent.com/resonite-love/resonite-version-monitor/refs/heads/master/data/versions.json";
    
    let response = client.get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch game versions: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Failed to fetch game versions: HTTP {}", response.status()));
    }
    
    let json_data = response.json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse game versions: {}", e))?;
    
    Ok(json_data)
}

// Get Resonite steam news from version monitor
#[tauri::command]
async fn fetch_steam_news() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = "https://raw.githubusercontent.com/resonite-love/resonite-version-monitor/refs/heads/master/data/steam_news.json";
    
    let response = client.get(url)
        .header("User-Agent", "RESO-Launcher")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch steam news: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Failed to fetch steam news: HTTP {}", response.status()));
    }
    
    let json_data = response.json::<serde_json::Value>()
        .await
        .map_err(|e| format!("Failed to parse steam news: {}", e))?;
    
    Ok(json_data)
}

// Get yt-dlp status for a profile
#[tauri::command]
async fn get_yt_dlp_status(
    profile_name: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<YtDlpInfo, String> {
    let app_state = state.lock().unwrap();
    
    let profile_manager = app_state.profile_manager.as_ref()
        .ok_or("Profile manager not initialized")?;
    
    let profile_dir = profile_manager.get_profile_dir(&profile_name);
    let game_path = find_game_path(&profile_dir)?;
    let yt_dlp_path = game_path.join("RuntimeData").join("yt-dlp.exe");
    
    if !yt_dlp_path.exists() {
        return Ok(YtDlpInfo {
            installed: false,
            version: None,
            path: None,
        });
    }
    
    // Get version by running yt-dlp --version
    let version = {
        let mut cmd = Command::new(&yt_dlp_path);
        cmd.arg("--version");
        
        // リリースビルドではウィンドウを非表示にする
        #[cfg(all(target_os = "windows", not(debug_assertions)))]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        
        match cmd.output() {
            Ok(output) => {
                if output.status.success() {
                    Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
                } else {
                    None
                }
            }
            Err(_) => None,
        }
    };
    
    Ok(YtDlpInfo {
        installed: true,
        version,
        path: Some(yt_dlp_path.to_string_lossy().to_string()),
    })
}

// Download yt-dlp using ModManager
async fn download_yt_dlp(yt_dlp_path: &std::path::Path) -> Result<(), String> {
    let temp_dir = std::env::temp_dir();
    let _mod_manager = ModManager::new(temp_dir);
    
    // Create a temporary HTTP client through ModManager
    let client = reqwest::Client::new();
    let download_url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
    
    let response = client.get(download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download yt-dlp: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Failed to download yt-dlp: HTTP {}", response.status()));
    }
    
    let content = response.bytes()
        .await
        .map_err(|e| format!("Failed to read yt-dlp content: {}", e))?;
    
    std::fs::write(yt_dlp_path, content)
        .map_err(|e| format!("Failed to write yt-dlp.exe: {}", e))?;
    
    Ok(())
}

// Update yt-dlp to the latest version using yt-dlp -U
#[tauri::command]
async fn update_yt_dlp(
    profile_name: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let (_profile_dir, game_path) = {
        let app_state = state.lock().unwrap();
        
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
        
        let profile_dir = profile_manager.get_profile_dir(&profile_name);
        let game_path = find_game_path(&profile_dir)?;
        
        (profile_dir, game_path)
    }; // MutexGuard is dropped here
    
    let runtime_data_path = game_path.join("RuntimeData");
    let yt_dlp_path = runtime_data_path.join("yt-dlp.exe");
    
    if !yt_dlp_path.exists() {
        // If yt-dlp doesn't exist, download it first
        std::fs::create_dir_all(&runtime_data_path)
            .map_err(|e| format!("Failed to create RuntimeData directory: {}", e))?;
        
        download_yt_dlp(&yt_dlp_path).await?;
        
        let version = {
            let mut cmd = Command::new(&yt_dlp_path);
            cmd.arg("--version");
            
            // リリースビルドではウィンドウを非表示にする
            #[cfg(all(target_os = "windows", not(debug_assertions)))]
            {
                use std::os::windows::process::CommandExt;
                cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
            }
            
            match cmd.output() {
            Ok(output) => {
                if output.status.success() {
                    String::from_utf8_lossy(&output.stdout).trim().to_string()
                } else {
                    "unknown".to_string()
                }
            }
            Err(_) => "unknown".to_string(),
            }
        };
        
        return Ok(format!("yt-dlp installed successfully (version {})", version));
    }
    
    // Use yt-dlp's built-in update functionality
    let output = {
        let mut cmd = Command::new(&yt_dlp_path);
        cmd.arg("-U");
        
        // リリースビルドではウィンドウを非表示にする
        #[cfg(all(target_os = "windows", not(debug_assertions)))]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        
        cmd.output()
            .map_err(|e| format!("Failed to run yt-dlp update: {}", e))?
    };
    
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp update failed: {}", error_msg));
    }
    
    // Get the updated version
    let version_output = {
        let mut cmd = Command::new(&yt_dlp_path);
        cmd.arg("--version");
        
        // リリースビルドではウィンドウを非表示にする
        #[cfg(all(target_os = "windows", not(debug_assertions)))]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        
        cmd.output()
            .map_err(|e| format!("Failed to get yt-dlp version: {}", e))?
    };
    
    let version = if version_output.status.success() {
        String::from_utf8_lossy(&version_output.stdout).trim().to_string()
    } else {
        "unknown".to_string()
    };
    
    let update_msg = String::from_utf8_lossy(&output.stdout);
    
    // Check if update was needed
    if update_msg.contains("already up to date") || update_msg.contains("up-to-date") {
        Ok(format!("yt-dlp is already up to date (version {})", version))
    } else {
        Ok(format!("yt-dlp updated successfully to version {}", version))
    }
}

// Download and setup DepotDownloader
#[tauri::command]
async fn download_depot_downloader(state: State<'_, Mutex<AppState>>) -> Result<String, String> {
    let exe_dir = {
        let app_state = state.lock().unwrap();
        app_state.exe_dir.as_ref()
            .ok_or("Application not initialized")?
            .clone()
    };
    
    let depot_path = std::path::Path::new(&exe_dir).join("DepotDownloader.exe");
    
    // Download DepotDownloader from GitHub releases
    let client = reqwest::Client::new();
    let download_url = "https://github.com/SteamRE/DepotDownloader/releases/latest/download/DepotDownloader-windows-x64.zip";
    
    let response = client.get(download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download DepotDownloader: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Failed to download DepotDownloader: HTTP {}", response.status()));
    }
    
    let content = response.bytes()
        .await
        .map_err(|e| format!("Failed to read DepotDownloader content: {}", e))?;
    
    // Extract ZIP file
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(content))
        .map_err(|e| format!("Failed to open DepotDownloader ZIP: {}", e))?;
    
    // Extract DepotDownloader.exe
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read ZIP entry: {}", e))?;
        
        if file.name() == "DepotDownloader.exe" {
            let mut out_file = std::fs::File::create(&depot_path)
                .map_err(|e| format!("Failed to create DepotDownloader.exe: {}", e))?;
            
            std::io::copy(&mut file, &mut out_file)
                .map_err(|e| format!("Failed to extract DepotDownloader.exe: {}", e))?;
            
            // Update state
            {
                let mut app_state = state.lock().unwrap();
                if let Some(depot_downloader) = &mut app_state.depot_downloader {
                    *depot_downloader = DepotDownloader::with_default_path(&std::path::PathBuf::from(&exe_dir));
                }
            }
            
            return Ok("DepotDownloader downloaded and extracted successfully".to_string());
        }
    }
    
    Err("DepotDownloader.exe not found in the downloaded ZIP file".to_string())
}

// Complete first run setup
#[tauri::command]
async fn complete_first_run_setup(state: State<'_, Mutex<AppState>>) -> Result<String, String> {
    let exe_dir = {
        let app_state = state.lock().unwrap();
        app_state.exe_dir.as_ref()
            .ok_or("Application not initialized")?
            .clone()
    };
    
    mark_first_run_complete(&std::path::PathBuf::from(&exe_dir))?;
    
    Ok("First run setup completed successfully".to_string())
}

// Check if this is a portable version
fn is_portable_build() -> bool {
    // Primary method: Check compile-time flag set during build
    #[cfg(portable_build)]
    {
        return true;
    }
    
    #[cfg(not(portable_build))]
    {
        // Fallback method: Check for portable marker file at runtime
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                let portable_marker = exe_dir.join(".portable");
                if portable_marker.exists() {
                    return true;
                }
            }
        }
        
        // Additional fallback: Check if executable name contains "Portable"
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_name) = exe_path.file_name() {
                if let Some(name_str) = exe_name.to_str() {
                    if name_str.contains("Portable") {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
}

// Check for app updates using Tauri updater
#[tauri::command]
async fn check_app_updates(app: AppHandle) -> Result<bool, String> {
    // Check if this is a portable version
    if is_portable_build() {
        return Ok(false);
    }
    
    match app.updater().check().await {
        Ok(update) => {
            Ok(update.is_update_available())
        }
        Err(e) => Err(format!("Failed to check for updates: {}", e)),
    }
}

// Install app update
#[tauri::command]
async fn install_app_update(app: AppHandle, window: Window) -> Result<String, String> {
    // Check if this is a portable version
    if is_portable_build() {
        return Err("Auto-update is disabled in portable version".to_string());
    }
    
    match app.updater().check().await {
        Ok(update) => {
            if !update.is_update_available() {
                return Err("No update available".to_string());
            }
            
            // Download and install the update
            update.download_and_install().await
                .map_err(|e| format!("Failed to install update: {}", e))?;
            
            // Emit completion event
            let _ = window.emit("update-complete", ());
            
            Ok("Update installed successfully. Please restart the application.".to_string())
        }
        Err(e) => Err(format!("Failed to check for updates: {}", e)),
    }
}

// Check if the app is running in portable mode
#[tauri::command]
fn is_portable_version() -> bool {
    is_portable_build()
}

fn main() {
    tauri::Builder::default()
        .manage(Mutex::new(AppState::default()))
        .invoke_handler(tauri::generate_handler![
            initialize_app,
            install_game_to_profile,
            install_game_to_profile_interactive,
            update_profile_game,
            update_profile_game_interactive,
            check_profile_updates,
            get_profiles,
            create_profile,
            launch_resonite,
            steam_login,
            save_steam_credentials,
            load_steam_credentials,
            clear_steam_credentials,
            get_profile_config,
            update_profile_config,
            get_mod_loader_status,
            install_mod_loader,
            uninstall_mod_loader,
            open_profile_folder,
            duplicate_profile,
            delete_profile,
            check_for_app_update,
            fetch_mod_manifest,
            get_installed_mods,
            install_mod_from_cache,
            install_mod_from_github,
            check_multi_file_install,
            install_multiple_files,
            uninstall_mod,
            disable_mod,
            enable_mod,
            migrate_installed_mods,
            migrate_profile_config,
            get_mod_versions,
            get_github_releases,
            update_mod,
            downgrade_mod,
            upgrade_mod,
            get_all_github_releases,
            scan_unmanaged_mods,
            add_unmanaged_mod_to_system,
            add_all_unmanaged_mods_to_system,
            get_github_release_info,
            get_game_versions,
            fetch_steam_news,
            get_yt_dlp_status,
            update_yt_dlp,
            download_depot_downloader,
            complete_first_run_setup,
            check_app_updates,
            install_app_update,
            is_portable_version
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}