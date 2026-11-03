use reso_launcher_lib::{
    depotdownloader::DepotDownloader,
    install::ResoniteInstall,
    profile::{GameInfo, ProfileManager},
};
use std::fs;
use tempfile::TempDir;

fn exercise_branch_change(exit_code: i32) {
    let directory = TempDir::new().unwrap();
    let manager = ProfileManager::new(directory.path());
    fs::create_dir_all(manager.get_profiles_dir()).unwrap();
    let mut profile = manager.create_profile("Branch switch").unwrap();
    let profile_dir = manager.get_profile_dir(&profile.id);
    let game_dir = profile_dir.join("Game");
    fs::create_dir_all(&game_dir).unwrap();
    fs::write(game_dir.join("Resonite.exe"), b"existing game executable").unwrap();
    profile.args.push("-NeverSaveAnything".into());
    profile.update_game_info(GameInfo {
        branch: "release".into(),
        manifest_id: Some("old-manifest".into()),
        depot_id: "2519832".into(),
        installed: true,
        last_updated: None,
        version: None,
    });
    manager.update_profile(&profile).unwrap();

    #[cfg(target_os = "windows")]
    let executable = {
        let path = directory.path().join("downloader.cmd");
        fs::write(&path, format!("@echo off\r\nexit /b {exit_code}\r\n")).unwrap();
        path
    };
    #[cfg(not(target_os = "windows"))]
    let executable = {
        use std::os::unix::fs::PermissionsExt;
        let path = directory.path().join("downloader.sh");
        fs::write(&path, format!("#!/bin/sh\nexit {exit_code}\n")).unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o700)).unwrap();
        path
    };

    let install = ResoniteInstall::new(profile.id.clone(), "alpha-prime".into(), None, None, None);
    let result = install.update(&DepotDownloader::new(&executable), &manager);
    let saved = manager.get_profile(&profile.id).unwrap();
    let game_info = saved.game_info.unwrap();
    assert_eq!(saved.args, profile.args);
    assert_eq!(saved.display_name, profile.display_name);
    if exit_code == 0 {
        assert!(result.is_ok(), "{result:?}");
        assert_eq!(game_info.branch, "alpha-prime");
        assert_eq!(game_info.manifest_id, None);
    } else {
        assert!(result.is_err());
        assert_eq!(game_info.branch, "release");
        assert_eq!(game_info.manifest_id.as_deref(), Some("old-manifest"));
    }
}

#[test]
fn successful_branch_change_persists_and_clears_old_manifest() {
    exercise_branch_change(0);
}

#[test]
fn failed_branch_change_preserves_metadata_even_with_existing_executable() {
    exercise_branch_change(1);
}
