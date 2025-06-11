// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use std::path::PathBuf;
use tauri::{State, Manager, Window};
use resonite_tools_lib::{
    depotdownloader::DepotDownloader,
    install::{ResoniteInstall, ResoniteInstallManager},
    profile::{Profile, ProfileManager},
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
    pub name: String,
    pub description: String,
    pub has_game: bool,
    pub branch: Option<String>,
    pub manifest_id: Option<String>,
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
    
    Ok(profiles.into_iter().map(|p| ProfileInfo {
        name: p.name.clone(),
        description: p.description.clone(),
        has_game: p.has_game_installed(),
        branch: p.game_info.as_ref().map(|info| info.branch.clone()),
        manifest_id: p.game_info.as_ref().and_then(|info| info.manifest_id.clone()),
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
    
    let profiles_dir = profile_manager.get_profiles_dir();
    let profile_dir = profiles_dir.join(&name);
    
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
            steam_login
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}