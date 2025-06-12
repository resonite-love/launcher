// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use std::path::PathBuf;
use tauri::{State, Manager, Window, AppHandle};
use resonite_tools_lib::{
    depotdownloader::DepotDownloader,
    install::{ResoniteInstall, ResoniteInstallManager},
    profile::{Profile, ProfileManager},
    mod_loader::{ModLoader, ModLoaderInfo},
    utils,
};

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
pub struct AppStatus {
    pub initialized: bool,
    pub depot_downloader_available: bool,
    pub exe_dir: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct SteamCredentials {
    pub username: String,
    pub password: String,
}

// Initialize the application
#[tauri::command]
async fn initialize_app(state: State<'_, Mutex<AppState>>) -> Result<AppStatus, String> {
    let mut app_state = state.lock().unwrap();
    
    match utils::get_executable_directory() {
        Ok(dir) => {
            app_state.exe_dir = Some(dir.clone());
            
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
        let has_mod_loader = if p.has_game_installed() {
            let game_dir = p.get_game_dir(&profile_dir);
            let mod_loader = ModLoader::new(game_dir);
            mod_loader.get_status().map(|info| info.installed).unwrap_or(false)
        } else {
            false
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
) -> Result<ModLoaderInfo, String> {
    let app_state = state.lock().unwrap();
    
    let profile_manager = app_state.profile_manager.as_ref()
        .ok_or("Profile manager not initialized")?;
    
    let profile_dir = profile_manager.get_profile_dir(&profile_name);
    let game_path = find_game_path(&profile_dir)?;
    
    let mod_loader = ModLoader::new(game_path);
    mod_loader.get_status()
        .map_err(|e| format!("Failed to get mod loader status: {}", e))
}

// Install mod loader to a profile
#[tauri::command]
async fn install_mod_loader(
    profile_name: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let game_path = {
        let app_state = state.lock().unwrap();
        
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
        
        let profile_dir = profile_manager.get_profile_dir(&profile_name);
        find_game_path(&profile_dir)?
    };
    
    let mod_loader = ModLoader::new(game_path);
    let result = mod_loader.install().await
        .map_err(|e| format!("Failed to install mod loader: {}", e))?;
    
    // プロファイルの起動引数も更新
    {
        let app_state = state.lock().unwrap();
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
            
        let mut profile = profile_manager.get_profile(&profile_name)
            .map_err(|e| format!("Failed to get profile: {}", e))?;
        
        mod_loader.add_launch_args(&mut profile.args);
        
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
    let game_path = {
        let app_state = state.lock().unwrap();
        
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
        
        let profile_dir = profile_manager.get_profile_dir(&profile_name);
        find_game_path(&profile_dir)?
    };
    
    let mod_loader = ModLoader::new(game_path);
    let result = mod_loader.uninstall()
        .map_err(|e| format!("Failed to uninstall mod loader: {}", e))?;
    
    // プロファイルの起動引数からも削除
    {
        let app_state = state.lock().unwrap();
        let profile_manager = app_state.profile_manager.as_ref()
            .ok_or("Profile manager not initialized")?;
            
        let mut profile = profile_manager.get_profile(&profile_name)
            .map_err(|e| format!("Failed to get profile: {}", e))?;
        
        mod_loader.remove_launch_args(&mut profile.args);
        
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
        std::process::Command::new("explorer")
            .arg(&profile_dir)
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
            open_profile_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}