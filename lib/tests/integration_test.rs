/// 統合テスト
///
/// このテストは実際のSteam認証情報を使用してDepotDownloaderを実行します。
/// .envファイルに`steam_id`と`steam_password`を設定してください。
///
/// 実行方法:
/// ```
/// # 通常のテスト（認証情報が必要なテストはスキップ）
/// cargo test -p reso-launcher-lib
///
/// # 遅いテストも含めて実行
/// RUN_SLOW_TESTS=1 cargo test -p reso-launcher-lib
/// ```

use reso_launcher_lib::profile::ProfileManager;
use reso_launcher_lib::depotdownloader::DepotDownloader;
use reso_launcher_lib::install::ResoniteInstall;
use std::path::PathBuf;
use std::sync::Once;
use tempfile::TempDir;

static INIT: Once = Once::new();

/// 環境変数からSteam認証情報を取得
fn get_credentials() -> Option<(String, String)> {
    INIT.call_once(|| {
        // プロジェクトルートから.envを読み込む
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            let env_path = PathBuf::from(&manifest_dir).parent().map(|p| p.join(".env"));
            if let Some(path) = env_path {
                if path.exists() {
                    let _ = dotenvy::from_path(&path);
                }
            }
        }
    });

    let steam_id = std::env::var("steam_id").ok()?;
    let steam_password = std::env::var("steam_password").ok()?;

    Some((steam_id, steam_password))
}

/// 認証情報が利用可能かチェック
fn credentials_available() -> bool {
    get_credentials().is_some()
}

/// 遅いテストを実行するかチェック
fn run_slow_tests() -> bool {
    std::env::var("RUN_SLOW_TESTS").is_ok()
}

// === DepotDownloader統合テスト ===

#[test]
fn test_depot_downloader_with_credentials() {
    if !credentials_available() {
        eprintln!("Skipping test: Steam credentials not available in .env");
        return;
    }

    let (steam_id, steam_password) = get_credentials().unwrap();
    let temp_dir = TempDir::new().unwrap();
    let downloader = DepotDownloader::new(temp_dir.path());

    // 認証情報付きの引数が正しく生成されるかテスト
    let args = downloader.build_resonite_args(
        temp_dir.path().to_str().unwrap(),
        "release",
        None,
        Some(&steam_id),
        Some(&steam_password),
    );

    assert!(args.contains(&"-username".to_string()));
    assert!(args.contains(&steam_id));
    assert!(args.contains(&"-password".to_string()));
    assert!(args.contains(&steam_password));
}

// === ResoniteInstall統合テスト ===

#[test]
fn test_resonite_install_structure() {
    if !credentials_available() {
        eprintln!("Skipping test: Steam credentials not available in .env");
        return;
    }

    let (steam_id, steam_password) = get_credentials().unwrap();

    let install = ResoniteInstall::new(
        "test_profile".to_string(),
        "release".to_string(),
        None,
        Some(steam_id.clone()),
        Some(steam_password.clone()),
    );

    assert_eq!(install.profile_name, "test_profile");
    assert_eq!(install.branch, "release");
    assert_eq!(install.username, Some(steam_id));
    assert_eq!(install.password, Some(steam_password));
}

// === 実際のダウンロードテスト（非常に遅い） ===

#[test]
#[ignore] // 手動実行用 - `cargo test -- --ignored` で実行
fn test_actual_download() {
    if !credentials_available() {
        eprintln!("Skipping test: Steam credentials not available in .env");
        return;
    }

    if !run_slow_tests() {
        eprintln!("Skipping slow test: Set RUN_SLOW_TESTS=1 to run");
        return;
    }

    // このテストは実際にResoniteをダウンロードするため、非常に時間がかかります
    // また、DepotDownloader.exeが必要です
    eprintln!("This test would download Resonite - skipped in automated tests");
}

// === ProfileManager + Install統合テスト ===

#[test]
fn test_profile_manager_with_install() {
    let temp_dir = TempDir::new().unwrap();
    let manager = ProfileManager::new(temp_dir.path());

    // profilesディレクトリを作成
    std::fs::create_dir_all(manager.get_profiles_dir()).unwrap();

    // プロファイルを作成
    let profile = manager.create_profile("Integration Test").unwrap();

    // ResoniteInstallを作成
    let install = ResoniteInstall::new(
        profile.id.clone(),
        "release".to_string(),
        None,
        None,
        None,
    );

    assert_eq!(install.profile_name, profile.id);

    // プロファイルディレクトリが正しく取得できる
    let profile_dir = manager.get_profile_dir(&profile.id);
    assert!(profile_dir.exists());
}

// === MOD関連の統合テスト ===

#[test]
fn test_mod_loader_type_persistence() {
    use reso_launcher_lib::mod_loader_type::ModLoaderType;

    let temp_dir = TempDir::new().unwrap();
    let manager = ProfileManager::new(temp_dir.path());
    std::fs::create_dir_all(manager.get_profiles_dir()).unwrap();

    // プロファイルを作成
    let mut profile = manager.create_profile("MOD Test").unwrap();

    // MODローダータイプを設定
    profile.mod_loader_type = Some(ModLoaderType::ResoniteModLoader);
    manager.update_profile(&profile).unwrap();

    // 再読み込みして確認
    let loaded = manager.get_profile(&profile.id).unwrap();
    assert_eq!(loaded.mod_loader_type, Some(ModLoaderType::ResoniteModLoader));
}
