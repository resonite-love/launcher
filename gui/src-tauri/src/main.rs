// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use std::path::PathBuf;
use tauri::State;
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

// Install Resonite
#[tauri::command]
async fn install_resonite(
    branch: String,
    install_path: Option<String>,
    username: Option<String>,
    password: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let app_state = state.lock().unwrap();
    
    let depot_downloader = app_state.depot_downloader.as_ref()
        .ok_or("DepotDownloader not initialized")?;
    
    let install_manager = app_state.install_manager.as_ref()
        .ok_or("Install manager not initialized")?;
    
    let install_dir = if let Some(path) = install_path {
        path
    } else {
        install_manager.determine_install_path(None, &branch)
    };
    
    let install = ResoniteInstall::new(
        install_dir.clone(),
        branch.clone(),
        username,
        password,
        None, // auth_code not used with DepotDownloader
    );
    
    install.install(depot_downloader)
        .map_err(|e| format!("Installation failed: {}", e))?;
    
    Ok(format!("Resonite {} branch installed successfully to {}", branch, install_dir))
}

// Update Resonite
#[tauri::command]
async fn update_resonite(
    branch: String,
    install_path: Option<String>,
    username: Option<String>,
    password: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let app_state = state.lock().unwrap();
    
    let depot_downloader = app_state.depot_downloader.as_ref()
        .ok_or("DepotDownloader not initialized")?;
    
    let install_manager = app_state.install_manager.as_ref()
        .ok_or("Install manager not initialized")?;
    
    let install_dir = if let Some(path) = install_path {
        path
    } else {
        install_manager.determine_install_path(None, &branch)
    };
    
    let install = ResoniteInstall::new(
        install_dir.clone(),
        branch.clone(),
        username,
        password,
        None,
    );
    
    install.update(depot_downloader)
        .map_err(|e| format!("Update failed: {}", e))?;
    
    Ok(format!("Resonite {} branch updated successfully", branch))
}

// Check for updates
#[tauri::command]
async fn check_updates(
    branch: String,
    install_path: Option<String>,
    username: Option<String>,
    password: Option<String>,
    state: State<'_, Mutex<AppState>>,
) -> Result<bool, String> {
    let app_state = state.lock().unwrap();
    
    let depot_downloader = app_state.depot_downloader.as_ref()
        .ok_or("DepotDownloader not initialized")?;
    
    let install_manager = app_state.install_manager.as_ref()
        .ok_or("Install manager not initialized")?;
    
    let install_dir = if let Some(path) = install_path {
        path
    } else {
        install_manager.determine_install_path(None, &branch)
    };
    
    let install = ResoniteInstall::new(
        install_dir,
        branch,
        username,
        password,
        None,
    );
    
    install.check_updates(depot_downloader)
        .map_err(|e| format!("Update check failed: {}", e))
}

// Get profiles
#[tauri::command]
async fn get_profiles(state: State<'_, Mutex<AppState>>) -> Result<Vec<ProfileInfo>, String> {
    let app_state = state.lock().unwrap();
    
    let profile_manager = app_state.profile_manager.as_ref()
        .ok_or("Profile manager not initialized")?;
    
    let profiles = profile_manager.list_profiles()
        .map_err(|e| format!("Failed to get profiles: {}", e))?;
    
    Ok(profiles.into_iter().map(|p| ProfileInfo {
        name: p.name,
        description: p.description,
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
    branch: String,
    profile_name: String,
    state: State<'_, Mutex<AppState>>,
) -> Result<String, String> {
    let app_state = state.lock().unwrap();
    
    let install_manager = app_state.install_manager.as_ref()
        .ok_or("Install manager not initialized")?;
    
    let profile_manager = app_state.profile_manager.as_ref()
        .ok_or("Profile manager not initialized")?;
    
    let profiles_dir = profile_manager.get_profiles_dir();
    let profile_dir = profiles_dir.join(&profile_name);
    
    install_manager.launch_with_profile(&branch, &profile_dir)
        .map_err(|e| format!("Launch failed: {}", e))?;
    
    Ok(format!("Resonite launched with profile '{}' on {} branch", profile_name, branch))
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
            install_resonite,
            update_resonite,
            check_updates,
            get_profiles,
            create_profile,
            launch_resonite,
            steam_login
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}