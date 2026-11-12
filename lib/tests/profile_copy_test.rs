use reso_launcher_lib::{
    bepis_loader::BepisLoader, mod_manager::ModManager, profile::ProfileManager,
    profile_copy::duplicate_profile,
};
use serde_json::{json, Value};
use std::{fs, path::Path};
use tempfile::TempDir;

fn write_json(path: &Path, value: &Value) {
    fs::write(path, serde_json::to_vec_pretty(value).unwrap()).unwrap();
}
fn read_json(path: &Path) -> Value {
    serde_json::from_slice(&fs::read(path).unwrap()).unwrap()
}
fn setup() -> (TempDir, ProfileManager, std::path::PathBuf) {
    let temp = TempDir::new().unwrap();
    let manager = ProfileManager::new(temp.path());
    let profile = manager.create_profile("Original").unwrap();
    let source = manager.get_profile_dir(profile.get_folder_name());
    (temp, manager, source)
}
fn mod_record(path: &Path, enabled: bool) -> Value {
    json!({"name":"Example", "description":"keep this", "source_location":"https://example.invalid/mod", "installed_version":"1.2", "installed_date":"2026-11-12", "dll_path":path, "mod_loader_type":"ResoniteModLoader", "file_format":"dll", "enabled":enabled, "future_field":{"keep":true}})
}

#[test]
fn duplicate_rebases_mods_and_keeps_source_untouched_when_toggling_and_removing() {
    let (_temp, manager, source) = setup();
    let relative = Path::new("Game/rml_mods/Example.dll");
    fs::create_dir_all(source.join("Game/rml_mods")).unwrap();
    fs::write(source.join(relative), b"original mod").unwrap();
    write_json(
        &source.join("installed_mods.json"),
        &json!([mod_record(&source.join(relative), true)]),
    );
    // Nested launchconfig.json belongs to a mod and must not be skipped.
    fs::write(
        source.join("Game/rml_mods/launchconfig.json"),
        b"mod config",
    )
    .unwrap();
    let before = fs::read(source.join("installed_mods.json")).unwrap();
    let copied = duplicate_profile(&manager, "Original", "Copy", "description").unwrap();
    let target = manager.get_profile_dir(copied.get_folder_name());
    let data = read_json(&target.join("installed_mods.json"));
    assert_eq!(data[0]["dll_path"], json!(target.join(relative)));
    assert_eq!(data[0]["future_field"], json!({"keep":true}));
    assert_eq!(data[0]["installed_version"], "1.2");
    assert_eq!(
        fs::read(target.join("Game/rml_mods/launchconfig.json")).unwrap(),
        b"mod config"
    );
    let mods = ModManager::new(target.clone());
    assert_eq!(mods.get_installed_mods().unwrap().len(), 1);
    assert!(mods.scan_mod_folder().unwrap().is_empty());
    mods.disable_mod("Example").unwrap();
    assert!(source.join(relative).exists());
    assert!(!target.join(relative).exists());
    mods.enable_mod("Example").unwrap();
    mods.uninstall_mod("Example").unwrap();
    assert!(source.join(relative).exists());
    assert!(!target.join(relative).exists());
    assert_eq!(
        fs::read(source.join("installed_mods.json")).unwrap(),
        before
    );
}

#[test]
fn duplicate_preserves_disabled_monkeyloader_metadata_even_after_source_is_removed() {
    let (_temp, manager, source) = setup();
    let relative = Path::new("Game/MonkeyLoader/Mods/Example.nupkg.disabled");
    fs::create_dir_all(source.join(relative.parent().unwrap())).unwrap();
    fs::write(source.join(relative), b"mod").unwrap();
    let mut record = mod_record(&source.join(relative), false);
    record["mod_loader_type"] = json!("MonkeyLoader");
    record["file_format"] = json!("nupkg");
    write_json(&source.join("installed_mods.json"), &json!([record]));
    let copied = duplicate_profile(&manager, "Original", "Copy", "").unwrap();
    let target = manager.get_profile_dir(copied.get_folder_name());
    fs::remove_dir_all(&source).unwrap();
    let mods = ModManager::new(target.clone())
        .get_installed_mods()
        .unwrap();
    assert_eq!(mods.len(), 1);
    assert_eq!(mods[0].enabled, Some(false));
    assert_eq!(mods[0].installed_version, "1.2");
    assert_eq!(mods[0].dll_path, target.join(relative));
}

#[test]
fn duplicate_rebases_all_bepis_paths_without_changing_other_fields() {
    let (_temp, manager, source) = setup();
    let relatives = [
        "Game/BepInEx/plugins/Example.dll",
        "Game/BepInEx/config/Example.cfg",
    ];
    for relative in relatives {
        fs::create_dir_all(source.join(relative).parent().unwrap()).unwrap();
        fs::write(source.join(relative), b"file").unwrap();
    }
    write_json(
        &source.join("bepis_installed_mods.json"),
        &json!({"future":42,"mods":[{"name":"Example","full_name":"Author-Example","description":"test","version":"2.0","install_date":"date","is_dependency":true,"installed_files":relatives.map(|r| source.join(r))}]}),
    );
    let before = fs::read(source.join("bepis_installed_mods.json")).unwrap();
    let copied = duplicate_profile(&manager, "Original", "Copy", "").unwrap();
    let target = manager.get_profile_dir(copied.get_folder_name());
    let data = read_json(&target.join("bepis_installed_mods.json"));
    assert_eq!(data["future"], 42);
    assert_eq!(
        data["mods"][0]["installed_files"],
        json!(relatives.map(|r| target.join(r)))
    );
    assert_eq!(data["mods"][0]["is_dependency"], true);
    BepisLoader::new(target.clone())
        .uninstall_mod("Author-Example")
        .unwrap();
    for relative in relatives {
        assert!(source.join(relative).exists());
        assert!(!target.join(relative).exists());
    }
    assert_eq!(
        fs::read(source.join("bepis_installed_mods.json")).unwrap(),
        before
    );
}

#[test]
fn duplicate_accepts_profiles_without_mod_management_files() {
    let (_temp, manager, source) = setup();
    fs::write(source.join("DataPath/settings.json"), b"settings").unwrap();
    let copied = duplicate_profile(&manager, "Original", "Copy", "description").unwrap();
    let target = manager.get_profile_dir(copied.get_folder_name());
    assert_eq!(
        fs::read(target.join("DataPath/settings.json")).unwrap(),
        b"settings"
    );
    assert_eq!(copied.description, "description");
    assert_ne!(copied.id, "original");
    assert!(duplicate_profile(&manager, "Original", "Copy", "").is_err());
    assert!(target.join("launchconfig.json").exists());
}

#[test]
fn invalid_metadata_or_paths_abort_and_remove_only_incomplete_copy() {
    let (_temp, manager, source) = setup();
    let foreign = source.with_file_name("original-other").join("Game/mod.dll");
    let traversal = source.join("../other/Game/mod.dll");
    let cases = vec![
        b"not json".to_vec(),
        serde_json::to_vec(&json!([mod_record(&foreign, true)])).unwrap(),
        serde_json::to_vec(&json!([mod_record(&traversal, true)])).unwrap(),
        serde_json::to_vec(&json!([mod_record(Path::new("Game/mod.dll"), true)])).unwrap(),
        serde_json::to_vec(&json!([{"dll_path":42}])).unwrap(),
        serde_json::to_vec(&json!({})).unwrap(),
    ];
    for bytes in cases {
        fs::write(source.join("installed_mods.json"), &bytes).unwrap();
        assert!(duplicate_profile(&manager, "Original", "Copy", "").is_err());
        assert!(!manager.get_profile_dir("copy").exists());
        assert_eq!(fs::read(source.join("installed_mods.json")).unwrap(), bytes);
        assert!(source.join("launchconfig.json").exists());
    }
    fs::remove_file(source.join("installed_mods.json")).unwrap();
    write_json(
        &source.join("bepis_installed_mods.json"),
        &json!({"mods":[{"installed_files":[null]}]}),
    );
    assert!(duplicate_profile(&manager, "Original", "Copy", "").is_err());
    assert!(!manager.get_profile_dir("copy").exists());
}

#[cfg(unix)]
#[test]
fn linked_files_abort_instead_of_copying_outside_the_profile() {
    let (_temp, manager, source) = setup();
    std::os::unix::fs::symlink(&source, source.join("Game/loop")).unwrap();
    assert!(duplicate_profile(&manager, "Original", "Copy", "")
        .unwrap_err()
        .contains("linked"));
    assert!(source.join("launchconfig.json").exists());
    assert!(!manager.get_profile_dir("copy").exists());
}

#[cfg(windows)]
#[test]
fn mixed_case_metadata_names_are_rebased_on_windows() {
    let (_temp, manager, source) = setup();
    let relative = Path::new("Game/rml_mods/Example.dll");
    fs::create_dir_all(source.join(relative).parent().unwrap()).unwrap();
    fs::write(source.join(relative), b"mod").unwrap();
    write_json(
        &source.join("Installed_Mods.json"),
        &json!([mod_record(&source.join(relative), true)]),
    );
    write_json(
        &source.join("Bepis_Installed_Mods.json"),
        &json!({"mods":[{"installed_files":[source.join(relative)]}]}),
    );
    fs::rename(
        source.join("launchconfig.json"),
        source.join("LaunchConfig.json"),
    )
    .unwrap();
    let copied = duplicate_profile(&manager, "Original", "Copy", "").unwrap();
    let target = manager.get_profile_dir(copied.get_folder_name());
    assert_eq!(
        read_json(&target.join("installed_mods.json"))[0]["dll_path"],
        json!(target.join(relative))
    );
    assert_eq!(
        read_json(&target.join("bepis_installed_mods.json"))["mods"][0]["installed_files"][0],
        json!(target.join(relative))
    );
    assert_eq!(manager.get_profile("Copy").unwrap().id, copied.id);
}
